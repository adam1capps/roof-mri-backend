import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || ''

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!email.toLowerCase().trim().endsWith('@re-dry.com')) {
      setError('Only @re-dry.com email addresses are allowed')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')

      localStorage.setItem('roofmri_token', data.token)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="logo">ROOF <span className="accent">MRI</span></span>
        <span className="tagline">Admin Dashboard</span>
      </header>
      <div className="card" style={{ borderRadius: '0 0 8px 8px' }}>
        <h2 className="admin-page-title">Sign In</h2>
        <form onSubmit={handleSubmit} className="admin-form">
          {error && <div className="admin-error">{error}</div>}
          <div className="admin-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@re-dry.com"
              required
            />
          </div>
          <div className="admin-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
