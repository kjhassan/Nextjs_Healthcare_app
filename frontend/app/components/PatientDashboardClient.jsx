'use client'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export default function PatientDashboard({ initialMe }) {
  const [me, setMe] = useState(initialMe || null)
  const [timeslot, setTimeslot] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!initialMe && typeof window !== 'undefined') window.location.href = '/'
    loadAppointments()
    loadNotifications()
    loadDoctors()

    // connect socket.io to receive real-time notifications
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const socket = io(process.env.NEXT_PUBLIC_NOTIFICATION_URL || '', { auth: { token }, transports: ['websocket'] })
      socket.on('connect', () => console.log('Connected to notification socket'))
      socket.on('notification', (n) => {
        setNotifications(prev => [n, ...prev])
      })
      // cleanup
      return () => socket.disconnect()
    } catch (err) {
      console.warn('Socket init failed', err)
    }
  }, [initialMe])

  async function loadDoctors() {
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_AUTH_URL + '/doctors')
      if (res.ok) setDoctors(await res.json())
    } catch (err) {
      console.error('Failed to load doctors', err)
    }
  }

  async function book(e) {
    e.preventDefault()
    setMsg('')
    setLoading(true)
    try {
      // convert datetime-local value to ISO string for server
      const isoTimeslot = timeslot ? new Date(timeslot).toISOString() : null
      const res = await fetch(process.env.NEXT_PUBLIC_APPT_URL + '/appointments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: doctorId ? parseInt(doctorId) : null, timeslot: isoTimeslot })
      })
      if (res.ok) {
        setMsg('✓ Appointment booked successfully!')
        setTimeslot('')
        setDoctorId('')
        await loadAppointments()
        await loadNotifications()
      } else if (res.status === 409) {
        const data = await res.json()
        setMsg('✗ ' + (data.error || 'Doctor not available at this timeslot'))
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg('✗ ' + (data.error || 'Failed to book'))
      }
    } catch (err) {
      console.error('Booking failed', err)
      setMsg('✗ Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadAppointments() {
    const res = await fetch(process.env.NEXT_PUBLIC_APPT_URL + '/appointments', { credentials: 'include' })
    if (res.ok) setAppointments(await res.json())
  }

  async function loadNotifications() {
    const res = await fetch(process.env.NEXT_PUBLIC_NOTIFICATION_URL + '/notifications', { credentials: 'include' })
    if (res.ok) setNotifications(await res.json())
  }

  async function logout() {
    await fetch(process.env.NEXT_PUBLIC_AUTH_URL + '/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="header">
        <h1>👤 Patient Dashboard</h1>
        <div className="user-info">
          {me && (
            <>
              <p className="user-name">{me.name}</p>
              <p>{me.email}</p>
              <button className="danger" onClick={logout} style={{ marginTop: '10px', fontSize: '12px', padding: '8px 16px' }}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>

      <div className="container">
        {msg && (
          <div className={msg.includes('✓') ? 'message success' : 'message error'}>
            {msg}
          </div>
        )}

        <div className="grid">
          <div className="section">
            <h2>📅 Book an Appointment</h2>
            <form onSubmit={book}>
                <div className="form-group">
                  <label>Select Doctor (Optional)</label>
                  <select value={doctorId} onChange={e => setDoctorId(e.target.value)}>
                    <option value="">Any available</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} — {d.email}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Preferred Date & Time</label>
                  <input
                    type="datetime-local"
                    value={timeslot}
                    onChange={e => setTimeslot(e.target.value)}
                    required
                  />
                  <small style={{ color: '#666' }}>Times will be sent in ISO format (local timezone)</small>
                </div>
              <div className="form-group">
                <label>Preferred Date & Time</label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD HH:MM (e.g., 2025-12-15 10:30)"
                  value={timeslot}
                  onChange={e => setTimeslot(e.target.value)}
                  required
                />
              </div>
              <button type="submit" style={{ width: '100%' }}>
                Book Appointment
              </button>
            </form>
          </div>

          <div className="section">
            <h2>📋 Your Appointments ({appointments.length})</h2>
            {appointments.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No appointments yet</p>
            ) : (
              <ul>
                {appointments.map(a => (
                  <li key={a.id}>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {new Date(a.timeslot).toLocaleDateString()} at {new Date(a.timeslot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Doctor ID: {a.doctor_id || 'Not assigned'}</div>
                    </div>
                    <span className={`badge ${a.status}`}>{a.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="section" style={{ marginTop: '20px' }}>
          <h2>🔔 Notifications ({notifications.length})</h2>
          {notifications.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No notifications yet</p>
          ) : (
            <div>
              {notifications.map(n => (
                <div key={n.id} className="notification success">
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{n.message}</div>
                  <div style={{ fontSize: '12px', opacity: '0.8' }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
