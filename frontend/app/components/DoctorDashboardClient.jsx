'use client'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export default function DoctorDashboard({ initialMe }) {
  const [me, setMe] = useState(initialMe || null)
  const [appointments, setAppointments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!initialMe && typeof window !== 'undefined') window.location.href = '/'
    loadAppointments()
    loadNotifications()
  }, [initialMe])

  // connect to socket for real-time notifications
  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const socket = io(process.env.NEXT_PUBLIC_NOTIFICATION_URL || '', { auth: { token }, transports: ['websocket'] })
      socket.on('connect', () => console.log('Doctor connected to notification socket'))
      socket.on('notification', (n) => {
        setNotifications(prev => [n, ...prev])
        // reload appointments when relevant
        if (n.metadata && n.metadata.appointment) loadAppointments()
      })
      return () => socket.disconnect()
    } catch (err) {
      console.warn('Socket init failed', err)
    }
  }, [])

  async function loadAppointments() {
    const res = await fetch(process.env.NEXT_PUBLIC_APPT_URL + '/appointments', { credentials: 'include' })
    if (res.ok) setAppointments(await res.json())
  }

  async function loadNotifications() {
    const res = await fetch(process.env.NEXT_PUBLIC_NOTIFICATION_URL + '/notifications', { credentials: 'include' })
    if (res.ok) setNotifications(await res.json())
  }

  async function approve(id) {
    setMsg('')
    const res = await fetch(process.env.NEXT_PUBLIC_APPT_URL + `/appointments/${id}/approve`, {
      method: 'PUT',
      credentials: 'include'
    })
    if (res.ok) {
      setMsg('✓ Appointment approved!')
      await loadAppointments()
      await loadNotifications()
    } else {
      setMsg('✗ Failed to approve')
    }
  }

  async function cancel(id) {
    setMsg('')
    const res = await fetch(process.env.NEXT_PUBLIC_APPT_URL + `/appointments/${id}/cancel`, {
      method: 'PUT',
      credentials: 'include'
    })
    if (res.ok) {
      setMsg('✓ Appointment cancelled')
      await loadAppointments()
      await loadNotifications()
    } else {
      setMsg('✗ Failed to cancel')
    }
  }

  async function reschedule(id) {
    setMsg('')
    const newTime = prompt('Enter new timeslot (YYYY-MM-DD HH:MM)', '')
    if (!newTime) return
    const res = await fetch(process.env.NEXT_PUBLIC_APPT_URL + `/appointments/${id}/reschedule`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeslot: newTime })
    })
    if (res.ok) {
      setMsg('✓ Appointment rescheduled')
      await loadAppointments()
      await loadNotifications()
    } else {
      setMsg('✗ Failed to reschedule')
    }
  }

  async function logout() {
    await fetch(process.env.NEXT_PUBLIC_AUTH_URL + '/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/'
  }

  const pendingCount = appointments.filter(a => a.status === 'pending').length
  const approvedCount = appointments.filter(a => a.status === 'approved').length

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="header">
        <h1>👨‍⚕️ Doctor Dashboard</h1>
        <div className="user-info">
          {me && (
            <>
              <p className="user-name">Dr. {me.name}</p>
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

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="section" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px' }}>{pendingCount}</div>
            <div style={{ fontSize: '14px', opacity: '0.9' }}>Pending Requests</div>
          </div>
          <div className="section" style={{ background: 'linear-gradient(135deg, #6bcf7f 0%, #4caf50 100%)', color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px' }}>{approvedCount}</div>
            <div style={{ fontSize: '14px', opacity: '0.9' }}>Approved Appointments</div>
          </div>
          <div className="section" style={{ background: 'linear-gradient(135deg, #ffd93d 0%, #ffb700 100%)', color: '#333', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px' }}>{appointments.length}</div>
            <div style={{ fontSize: '14px' }}>Total Appointments</div>
          </div>
        </div>

        <div className="section" style={{ marginTop: '30px' }}>
          <h2>📋 Appointment Requests</h2>
          {appointments.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No appointments</p>
          ) : (
            <ul>
              {appointments.map(a => (
                <li key={a.id} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ width: '100%', marginBottom: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '16px' }}>
                      {new Date(a.timeslot).toLocaleDateString()} at {new Date(a.timeslot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      Patient ID: <strong>{a.patient_id}</strong> • Status: <strong>{a.status}</strong>
                    </div>
                  </div>
                  <div style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`badge ${a.status}`}>{a.status}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                      {a.status === 'pending' && (
                        <button
                          onClick={() => approve(a.id)}
                          style={{ background: '#6bcf7f', padding: '6px 12px', fontSize: '12px' }}
                        >
                          ✓ Approve
                        </button>
                      )}
                      <button onClick={() => reschedule(a.id)} style={{ background: '#ffb347', padding: '6px 12px', fontSize: '12px' }}>⟳ Reschedule</button>
                      <button onClick={() => cancel(a.id)} style={{ background: '#ff6b6b', padding: '6px 12px', fontSize: '12px' }}>✗ Cancel</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
