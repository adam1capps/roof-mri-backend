import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || ''

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSetup, setIsSetup] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email.toLowerCase().trim().endsWith('@re-dry.com')) {
      setError('Only @re-dry.com email addresses are allowed')
      return
    }

    if (isSetup && password.length < 10) {
      setError('Password must be at least 10 characters')
      return
    }

    setLoading(true)
    try {
      const endpoint = isSetup ? '/api/admin/setup' : '/api/admin/login'
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (isSetup ? 'Setup failed' : 'Login failed'))

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
        <h2 className="admin-page-title">{isSetup ? 'Create Admin Account' : 'Sign In'}</h2>
        <form onSubmit={handleSubmit} className="admin-form">
          {error && <div className="admin-error">{error}</div>}
          {success && <div className="admin-error" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>{success}</div>}
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
            <label>{isSetup ? 'Choose Password (10+ characters)' : 'Password'}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isSetup ? 'Choose a password' : 'Enter password'}
              required
              minLength={isSetup ? 10 : undefined}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (isSetup ? 'Creating account...' : 'Signing in...') : (isSetup ? 'Create Account' : 'Sign In')}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#64748b' }}>
          {isSetup ? (
            <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setIsSetup(false); setError('') }} style={{ color: '#00bd70' }}>Sign in</a></>
          ) : (
            <>First time? <a href="#" onClick={e => { e.preventDefault(); setIsSetup(true); setError('') }} style={{ color: '#00bd70' }}>Create admin account</a></>
          )}
        </p>
      </div>
    </div>
  )
}
