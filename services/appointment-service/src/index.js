const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { pool, init } = require('./db');
const { createClient } = require('redis');

const PORT = process.env.PORT || 4001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://frontend:3000'], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

let redis;

function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function start() {
  await init();
  redis = createClient({ url: REDIS_URL });
  await redis.connect();

  app.post('/appointments', authMiddleware, async (req, res) => {
    const { doctor_id, timeslot } = req.body;
    const patient_id = req.user.id;
    if (!timeslot) return res.status(400).json({ error: 'Missing timeslot' });
    try {
      // if doctor_id provided, check for conflict (prevent double-booking)
      if (doctor_id) {
        const conflict = await pool.query(
          `SELECT 1 FROM appointments WHERE doctor_id=$1 AND timeslot=$2 AND status != 'cancelled' LIMIT 1`,
          [doctor_id, timeslot]
        );
        if (conflict.rows.length > 0) {
          return res.status(409).json({ error: 'Doctor not available at the selected timeslot' });
        }
      }

      const r = await pool.query('INSERT INTO appointments (patient_id, doctor_id, timeslot, status) VALUES ($1,$2,$3,$4) RETURNING *', [patient_id, doctor_id || null, timeslot, 'pending']);
      const appt = r.rows[0];
      // publish event
      await redis.publish('appointments', JSON.stringify({ type: 'booking_created', data: appt }));
      res.json(appt);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create' });
    }
  });

  app.get('/appointments', authMiddleware, async (req, res) => {
    const user = req.user;
    try {
      let r;
      if (user.role === 'doctor') {
        r = await pool.query('SELECT * FROM appointments WHERE doctor_id=$1 ORDER BY timeslot DESC', [user.id]);
      } else {
        r = await pool.query('SELECT * FROM appointments WHERE patient_id=$1 ORDER BY timeslot DESC', [user.id]);
      }
      res.json(r.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch' });
    }
  });

  app.put('/appointments/:id/approve', authMiddleware, async (req, res) => {
    const user = req.user;
    const id = req.params.id;
    if (user.role !== 'doctor') return res.status(403).json({ error: 'Forbidden' });
    try {
      const r = await pool.query('UPDATE appointments SET status=$1, doctor_id=$2 WHERE id=$3 RETURNING *', ['approved', user.id, id]);
      const appt = r.rows[0];
      if (!appt) return res.status(404).json({ error: 'Not found' });
      await redis.publish('appointments', JSON.stringify({ type: 'booking_approved', data: appt }));
      res.json(appt);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to approve' });
    }
  });

  app.put('/appointments/:id/cancel', authMiddleware, async (req, res) => {
    const user = req.user;
    const id = req.params.id;
    // both doctor and patient can cancel (but patients can only cancel their own)
    try {
      const check = await pool.query('SELECT * FROM appointments WHERE id=$1', [id]);
      const appt0 = check.rows[0];
      if (!appt0) return res.status(404).json({ error: 'Not found' });
      if (user.role === 'patient' && appt0.patient_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
      if (user.role === 'doctor' && appt0.doctor_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
      const r = await pool.query('UPDATE appointments SET status=$1 WHERE id=$2 RETURNING *', ['cancelled', id]);
      const appt = r.rows[0];
      await redis.publish('appointments', JSON.stringify({ type: 'booking_cancelled', data: appt }));
      res.json(appt);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to cancel' });
    }
  });

  app.put('/appointments/:id/reschedule', authMiddleware, async (req, res) => {
    const user = req.user;
    const id = req.params.id;
    const { timeslot } = req.body;
    if (!timeslot) return res.status(400).json({ error: 'Missing timeslot' });
    try {
      const check = await pool.query('SELECT * FROM appointments WHERE id=$1', [id]);
      const appt0 = check.rows[0];
      if (!appt0) return res.status(404).json({ error: 'Not found' });
      // allow doctor or patient (own) to reschedule
      if (user.role === 'patient' && appt0.patient_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
      if (user.role === 'doctor' && appt0.doctor_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
      const r = await pool.query('UPDATE appointments SET timeslot=$1, status=$2 WHERE id=$3 RETURNING *', [timeslot, 'rescheduled', id]);
      const appt = r.rows[0];
      await redis.publish('appointments', JSON.stringify({ type: 'booking_rescheduled', data: appt }));
      res.json(appt);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to reschedule' });
    }
  });

  app.listen(PORT, () => console.log('Appointment service listening on', PORT));
}

start().catch(err => { console.error(err); process.exit(1); });
