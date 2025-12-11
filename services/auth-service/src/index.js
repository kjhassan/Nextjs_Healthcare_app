const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, init } = require('./db');

const PORT = process.env.PORT || 4000;

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://frontend:3000'], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

async function start() {
  await init();

  app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
    const hashed = await bcrypt.hash(password, 10);
    try {
      const result = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
        [name, email, hashed, role || 'patient']
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const r = await pool.query('SELECT id, name, email, password_hash, role FROM users WHERE email=$1', [email]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '8h' });
    res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, token });
  });

  app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
  });

  // Return list of registered doctors
  app.get('/doctors', async (req, res) => {
    try {
      const r = await pool.query("SELECT id, name, email FROM users WHERE role='doctor' ORDER BY name");
      res.json(r.rows);
    } catch (err) {
      console.error('Failed to fetch doctors', err);
      res.status(500).json({ error: 'Failed to fetch doctors' });
    }
  });

  app.get('/me', (req, res) => {
    let token = req.cookies && req.cookies.token;
    
    // Also check Authorization header for Bearer token
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
      res.json(payload);
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  app.listen(PORT, () => console.log('Auth service listening on', PORT));
}

start().catch(err => { console.error(err); process.exit(1); });
