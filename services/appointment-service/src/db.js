const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER,
      timeslot TIMESTAMP NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);
}

module.exports = { pool, init };
