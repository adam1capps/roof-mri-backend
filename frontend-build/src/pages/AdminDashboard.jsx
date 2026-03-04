import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('roofmri_token')
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  }
}

// ── Proposal Form ──────────────────────────────────────────────────
function ProposalForm({ onSent }) {
  const [form, setForm] = useState({
    contactName: '', company: '', email: '', tier: 'professional',
    totalPrice: '', extraTrainees: '0', extraKits: '0',
    videography: false, onRoofDay: false, vimeoUrl: '',
    letClientChoose: false, proposalNum: '',
    professionalPrice: '10000', regionalPrice: '35000', enterprisePrice: '75000'
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function set(field) {
    return e => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(f => ({ ...f, [field]: val }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    setSending(true)

    try {
      // Validate prices
      if (form.letClientChoose) {
        const hasProPrice = Number(form.professionalPrice) > 0
        const hasRegPrice = Number(form.regionalPrice) > 0
        const hasEntPrice = Number(form.enterprisePrice) > 0
        if (!hasProPrice && !hasRegPrice && !hasEntPrice) {
          setError('Please enter a price for at least one package tier.')
          setSending(false)
          return
        }
      } else {
        if (!Number(form.totalPrice) || Number(form.totalPrice) <= 0) {
          setError('Please enter the total price for the proposal.')
          setSending(false)
          return
        }
      }

      const body = {
        contactName: form.contactName,
        company: form.company,
        email: form.email,
        tier: form.letClientChoose ? null : form.tier,
        totalPrice: form.letClientChoose ? null : Number(form.totalPrice) || 0,
        extraTrainees: Number(form.extraTrainees) || 0,
        extraKits: Number(form.extraKits) || 0,
        videography: form.videography,
        onRoofDay: form.onRoofDay,
        vimeoUrl: form.vimeoUrl || null,
        letClientChoose: form.letClientChoose,
        proposalNum: form.proposalNum || null,
        professionalPrice: form.letClientChoose ? (Number(form.professionalPrice) || null) : null,
        regionalPrice: form.letClientChoose ? (Number(form.regionalPrice) || null) : null,
        enterprisePrice: form.letClientChoose ? (Number(form.enterprisePrice) || null) : null,
      }

      const res = await fetch(`${API}/api/send-proposal`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send proposal')

      setResult(data)
      setForm({
        contactName: '', company: '', email: '', tier: 'professional',
        totalPrice: '', extraTrainees: '0', extraKits: '0',
        videography: false, onRoofDay: false, vimeoUrl: '',
        letClientChoose: false, proposalNum: '',
        professionalPrice: '10000', regionalPrice: '35000', enterprisePrice: '75000'
      })
      if (onSent) onSent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Send a Proposal</h3>
      <form onSubmit={handleSubmit} className="admin-form">
        {error && <div className="admin-error">{error}</div>}
        {result && (
          <div className="admin-success">
            Proposal sent to {form.email || 'client'}!
            <br />
            <a href={result.proposal?.proposalUrl || result.proposal?.proposal_url}
               target="_blank" rel="noopener noreferrer">
              View proposal
            </a>
          </div>
        )}

        <div className="admin-row">
          <div className="admin-field">
            <label>Contact Name *</label>
            <input value={form.contactName} onChange={set('contactName')} required />
          </div>
          <div className="admin-field">
            <label>Company *</label>
            <input value={form.company} onChange={set('company')} required />
          </div>
        </div>

        <div className="admin-row">
          <div className="admin-field">
            <label>Client Email *</label>
            <input type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="admin-field">
            <label>Proposal # (optional)</label>
            <input value={form.proposalNum} onChange={set('proposalNum')} placeholder="e.g. P-2026-001" />
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-checkbox">
            <input type="checkbox" checked={form.letClientChoose} onChange={set('letClientChoose')} />
            Let client choose their package
          </label>
        </div>

        {!form.letClientChoose ? (
          <>
            <div className="admin-row">
              <div className="admin-field">
                <label>Package Tier</label>
                <select value={form.tier} onChange={set('tier')}>
                  <option value="professional">Professional (3 trainees, 1 kit)</option>
                  <option value="regional">Regional (10 trainees, 2 kits)</option>
                  <option value="enterprise">Enterprise (25 trainees, 4 kits)</option>
                </select>
              </div>
              <div className="admin-field">
                <label>Total Price ($)</label>
                <input type="number" value={form.totalPrice} onChange={set('totalPrice')} min="0" step="0.01" />
              </div>
            </div>

            <div className="admin-row">
              <div className="admin-field">
                <label>Extra Trainees</label>
                <input type="number" value={form.extraTrainees} onChange={set('extraTrainees')} min="0" />
              </div>
              <div className="admin-field">
                <label>Extra Kits</label>
                <input type="number" value={form.extraKits} onChange={set('extraKits')} min="0" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="admin-row" style={{ gap: '10px' }}>
              <div className="admin-field">
                <label>Professional Price ($)</label>
                <input type="number" value={form.professionalPrice} onChange={set('professionalPrice')} min="0" step="0.01" placeholder="3 trainees, 1 kit" />
              </div>
              <div className="admin-field">
                <label>Regional Price ($)</label>
                <input type="number" value={form.regionalPrice} onChange={set('regionalPrice')} min="0" step="0.01" placeholder="10 trainees, 2 kits" />
              </div>
              <div className="admin-field">
                <label>Enterprise Price ($)</label>
                <input type="number" value={form.enterprisePrice} onChange={set('enterprisePrice')} min="0" step="0.01" placeholder="25 trainees, 4 kits" />
              </div>
            </div>
          </>
        )}

        <div className="admin-row">
          <div className="admin-field">
            <label className="admin-checkbox">
              <input type="checkbox" checked={form.videography} onChange={set('videography')} />
              Include Videography
            </label>
          </div>
          <div className="admin-field">
            <label className="admin-checkbox">
              <input type="checkbox" checked={form.onRoofDay} onChange={set('onRoofDay')} />
              Include On-Roof Training Day
            </label>
          </div>
        </div>

        <div className="admin-field">
          <label>Vimeo URL (optional)</label>
          <input value={form.vimeoUrl} onChange={set('vimeoUrl')} placeholder="https://vimeo.com/123456789" />
        </div>

        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? 'Sending...' : 'Send Proposal'}
        </button>
      </form>
    </div>
  )
}

// ── Proposals List ─────────────────────────────────────────────────
function ProposalsList({ proposals, loading }) {
  if (loading) {
    return (
      <div className="card">
        <h3 className="section-title">All Proposals</h3>
        <div className="loading"><div className="spinner"></div></div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="section-title">All Proposals ({proposals.length})</h3>
      {proposals.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>No proposals sent yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>{p.company}</td>
                  <td>{p.contact_name}</td>
                  <td>{p.total_price ? `$${Number(p.total_price).toLocaleString()}` : '—'}</td>
                  <td>
                    <span className={`admin-badge badge-${p.status}`}>{p.status}</span>
                  </td>
                  <td>
                    <span className={`admin-badge badge-${p.payment_status}`}>{p.payment_status}</span>
                  </td>
                  <td>
                    <a href={`/p/${p.id}`} target="_blank" rel="noopener noreferrer" className="admin-link">
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate()
  const [proposals, setProposals] = useState([])
  const [loadingProposals, setLoadingProposals] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/proposals`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      if (res.status === 401) {
        localStorage.removeItem('roofmri_token')
        navigate('/admin/login')
        return
      }
      const data = await res.json()
      setProposals(Array.isArray(data) ? data : data.proposals || [])
    } catch {
      // silently fail — list will just be empty
    } finally {
      setLoadingProposals(false)
    }
  }, [navigate])

  useEffect(() => {
    // Verify auth
    const token = getToken()
    if (!token) { navigate('/admin/login'); return }

    fetch(`${API}/api/admin/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (!res.ok) {
        localStorage.removeItem('roofmri_token')
        navigate('/admin/login')
        return
      }
      return res.json()
    }).then(data => {
      if (data?.email) setAdminEmail(data.email)
    }).catch(() => {
      localStorage.removeItem('roofmri_token')
      navigate('/admin/login')
    })

    fetchProposals()
  }, [navigate, fetchProposals])

  function handleLogout() {
    localStorage.removeItem('roofmri_token')
    navigate('/admin/login')
  }

  return (
    <div className="page-wrapper admin-wide">
      <header className="site-header admin-header">
        <div>
          <span className="logo">ROOF <span className="accent">MRI</span></span>
          <span className="tagline">Admin Dashboard</span>
        </div>
        <div className="admin-header-right">
          {adminEmail && <span className="admin-email">{adminEmail}</span>}
          <button onClick={handleLogout} className="admin-logout-btn">Log out</button>
        </div>
      </header>
      <ProposalForm onSent={fetchProposals} />
      <ProposalsList proposals={proposals} loading={loadingProposals} />
    </div>
  )
}
