'use client'
import { useState } from 'react'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('patient')
  const [msg, setMsg] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  async function register(e) {
    e.preventDefault()
    setMsg('')
    
    if (password !== confirmPassword) {
      setMsg('✗ Passwords do not match')
      return
    }
    
    setLoading(true)
    
    try {
      console.log('Registering:', { name, email, role })
      const res = await fetch(process.env.NEXT_PUBLIC_AUTH_URL + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      })
      
      console.log('Register response status:', res.status)
      const data = await res.json()
      console.log('Register response:', data)
      
      if (res.ok) {
        setMsg('✓ Registered successfully! Switching to login...')
        setName('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          setIsLogin(true)
          setMsg('✓ You can now login with your credentials')
        }, 1500)
      } else {
        setMsg('✗ ' + (data.error || 'Registration failed'))
      }
    } catch (error) {
      console.error('Register error:', error)
      setMsg('✗ Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function login(e) {
    e.preventDefault()
    setMsg('')
    setLoading(true)
    
    try {
      console.log('Logging in:', { email })
      const res = await fetch(process.env.NEXT_PUBLIC_AUTH_URL + '/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      console.log('Login response status:', res.status)
      const data = await res.json()
      console.log('Login response:', data)
      
      if (res.ok) {
          // Store token in localStorage (if provided)
          if (data && data.token) {
            try { localStorage.setItem('token', data.token) } catch (e) { /* ignore */ }
          }

          setMsg('✓ Login successful! Determining dashboard...')

          // Determine role: prefer login response, otherwise call /me
          let role = data && data.role
          if (!role) {
            try {
              const meRes = await fetch((process.env.NEXT_PUBLIC_AUTH_URL || '') + '/me', {
                method: 'GET',
                credentials: 'include'
              })
              if (meRes.ok) {
                const me = await meRes.json()
                role = me.role
                console.log('Role from /me:', role)
              } else {
                console.warn('/me returned', meRes.status)
              }
            } catch (err) {
              console.error('Failed to fetch /me after login', err)
            }
          }

          // Fallback to patient if role still unknown
          const redirectUrl = role === 'doctor' ? '/doctor' : '/patient'
          console.log('Redirecting to:', redirectUrl, 'role=', role)
          window.location.href = redirectUrl
      } else {
        setMsg('✗ ' + (data.error || 'Login failed'))
        setLoading(false)
      }
    } catch (error) {
      console.error('Login error:', error)
      setMsg('✗ Error: ' + error.message)
      setLoading(false)
    }
  }

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL
  if (!authUrl) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <p>❌ Environment Error: NEXT_PUBLIC_AUTH_URL not set</p>
        <p>Value: {authUrl}</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ maxWidth: '450px', width: '100%' }}>
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '32px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 10px 0' }}>
              🏥 Smart Healthcare
            </h1>
            <p style={{ color: '#666', margin: '0' }}>Manage your health appointments seamlessly</p>
          </div>

          {msg && (
            <div className={msg.includes('✓') ? 'message success' : 'message error'} style={{ marginBottom: '20px' }}>
              {msg}
            </div>
          )}

          {isLogin ? (
            <form onSubmit={login}>
              <h2 style={{ marginBottom: '20px', textAlign: 'center', borderBottom: 'none' }}>Sign In</h2>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '16px', color: '#666' }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  className="secondary"
                onClick={() => { setIsLogin(false); setMsg(''); setEmail(''); setPassword(''); setConfirmPassword(''); }}
                disabled={loading}
                  style={{ background: 'none', color: '#667eea', padding: '0', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: 'none', margin: '0', transform: 'none', boxShadow: 'none' }}
                >
                  Create Account
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={register}>
              <h2 style={{ marginBottom: '20px', textAlign: 'center', borderBottom: 'none' }}>Create Account</h2>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Account Type</label>
                <select value={role} onChange={e => setRole(e.target.value)} disabled={loading}>
                  <option value="patient">👤 Patient</option>
                  <option value="doctor">👨‍⚕️ Doctor</option>
                </select>
              </div>
              <button type="submit" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '16px', color: '#666' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => { setIsLogin(true); setMsg(''); setEmail(''); setPassword(''); setName(''); }}
                  disabled={loading}
                  style={{ background: 'none', color: '#667eea', padding: '0', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: 'none', margin: '0', transform: 'none', boxShadow: 'none' }}
                >
                  Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
