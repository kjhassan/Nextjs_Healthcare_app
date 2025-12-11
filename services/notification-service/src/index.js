const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const { pool, init } = require('./db');

const PORT = process.env.PORT || 4002;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://frontend:3000'], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
  const redis = createClient({ url: REDIS_URL });
  await redis.connect();

  const sub = redis.duplicate();
  await sub.connect();

  // create HTTP server and attach socket.io
  const http = require('http');
  const server = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // userId -> Set of socket ids
  const userSockets = new Map();

  io.use((socket, next) => {
    // authenticate socket via token sent in handshake auth or header
    const token = socket.handshake.auth && socket.handshake.auth.token || (socket.handshake.headers && socket.handshake.headers.authorization && socket.handshake.headers.authorization.split(' ')[1]);
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
      socket.user = payload;
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user && socket.user.id;
    if (!userId) return;
    // add socket id to user's set
    const set = userSockets.get(userId) || new Set();
    set.add(socket.id);
    userSockets.set(userId, set);
    socket.join(`user:${userId}`);
    console.log('Socket connected for user', userId, socket.id);

    socket.on('disconnect', () => {
      const s = userSockets.get(userId);
      if (s) {
        s.delete(socket.id);
        if (s.size === 0) userSockets.delete(userId);
      }
      console.log('Socket disconnected', socket.id, 'for user', userId);
    });
  });

  // subscribe to appointment events and create notifications + emit via sockets
  await sub.subscribe('appointments', async (message) => {
    try {
      const ev = JSON.parse(message);
      if (ev.type === 'booking_created') {
        const appt = ev.data;
        // notify patient
        const r1 = await pool.query('INSERT INTO notifications (user_id, message, metadata) VALUES ($1,$2,$3) RETURNING id, user_id, message, metadata, created_at', [appt.patient_id, `Appointment created for ${appt.timeslot}`, { appointment: appt }]);
        const n1 = r1.rows[0];
        io.to(`user:${n1.user_id}`).emit('notification', n1);
        if (appt.doctor_id) {
          const r2 = await pool.query('INSERT INTO notifications (user_id, message, metadata) VALUES ($1,$2,$3) RETURNING id, user_id, message, metadata, created_at', [appt.doctor_id, `New appointment request at ${appt.timeslot}`, { appointment: appt }]);
          const n2 = r2.rows[0];
          io.to(`user:${n2.user_id}`).emit('notification', n2);
        }
        console.log('Handled booking_created event');
      } else if (ev.type === 'booking_approved') {
        const appt = ev.data;
        const r = await pool.query('INSERT INTO notifications (user_id, message, metadata) VALUES ($1,$2,$3) RETURNING id, user_id, message, metadata, created_at', [appt.patient_id, `Your appointment at ${appt.timeslot} was approved`, { appointment: appt }]);
        const n = r.rows[0];
        io.to(`user:${n.user_id}`).emit('notification', n);
        console.log('Handled booking_approved event');
      } else if (ev.type === 'booking_cancelled') {
        const appt = ev.data;
        const r = await pool.query('INSERT INTO notifications (user_id, message, metadata) VALUES ($1,$2,$3) RETURNING id, user_id, message, metadata, created_at', [appt.patient_id, `Your appointment at ${appt.timeslot} was cancelled`, { appointment: appt }]);
        const n = r.rows[0];
        io.to(`user:${n.user_id}`).emit('notification', n);
        console.log('Handled booking_cancelled event');
      } else if (ev.type === 'booking_rescheduled') {
        const appt = ev.data;
        const r = await pool.query('INSERT INTO notifications (user_id, message, metadata) VALUES ($1,$2,$3) RETURNING id, user_id, message, metadata, created_at', [appt.patient_id, `Your appointment was rescheduled to ${appt.timeslot}`, { appointment: appt }]);
        const n = r.rows[0];
        io.to(`user:${n.user_id}`).emit('notification', n);
        console.log('Handled booking_rescheduled event');
      }
    } catch (err) {
      console.error('Failed handling event', err);
    }
  });

  app.get('/notifications', authMiddleware, async (req, res) => {
    try {
      const r = await pool.query('SELECT id, message, metadata, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
      res.json(r.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch' });
    }
  });

  server.listen(PORT, () => console.log('Notification service listening on', PORT));
}

start().catch(err => { console.error(err); process.exit(1); });
