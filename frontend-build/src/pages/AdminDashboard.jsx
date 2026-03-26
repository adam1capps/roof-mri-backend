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

// ── Invoice Form ──────────────────────────────────────────────────
function InvoiceForm({ onSent }) {
  const [form, setForm] = useState({
    contactName: '', company: '', email: '', accountingEmail: '',
    invoiceNum: '', dueDate: '', notes: '', taxRate: '0', proposalId: ''
  })
  const [lineItems, setLineItems] = useState([{ description: '', quantity: '1', rate: '' }])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function updateItem(index, field, value) {
    setLineItems(items => items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function addItem() {
    setLineItems(items => [...items, { description: '', quantity: '1', rate: '' }])
  }

  function removeItem(index) {
    if (lineItems.length <= 1) return
    setLineItems(items => items.filter((_, i) => i !== index))
  }

  const subtotal = lineItems.reduce((sum, item) => {
    return sum + (Math.max(1, parseInt(item.quantity) || 1) * (Number(item.rate) || 0))
  }, 0)
  const taxAmount = Math.round(subtotal * (Number(form.taxRate) || 0)) / 100
  const total = subtotal + taxAmount

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    setSending(true)

    try {
      const validItems = lineItems.filter(item => item.description && Number(item.rate) > 0)
      if (validItems.length === 0) {
        setError('Add at least one line item with a description and rate.')
        setSending(false)
        return
      }

      const body = {
        contactName: form.contactName,
        company: form.company,
        email: form.email,
        accountingEmail: form.accountingEmail || null,
        invoiceNum: form.invoiceNum || null,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
        taxRate: Number(form.taxRate) || 0,
        proposalId: form.proposalId || null,
        lineItems: validItems.map(item => ({
          description: item.description,
          quantity: Math.max(1, parseInt(item.quantity) || 1),
          rate: Number(item.rate) || 0,
        }))
      }

      const res = await fetch(`${API}/api/invoices`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice')

      setResult(data)
      if (onSent) onSent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleSendInvoice(invoiceId) {
    try {
      const res = await fetch(`${API}/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setResult(prev => ({ ...prev, sent: true, sentMessage: data.message }))
      if (onSent) onSent()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Create Invoice</h3>
      <form onSubmit={handleSubmit} className="admin-form">
        {error && <div className="admin-error">{error}</div>}
        {result && (
          <div className="admin-success">
            Invoice created!
            {result.sent ? (
              <span> {result.sentMessage}</span>
            ) : (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => handleSendInvoice(result.invoice?.id)}
                  style={{ background: '#00bd70', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', marginLeft: 8 }}
                >
                  Send to {form.accountingEmail || form.email || 'client'}
                </button>
                {' '}
                <a href={`/invoice/${result.invoice?.id}`} target="_blank" rel="noopener noreferrer">
                  View invoice
                </a>
              </>
            )}
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
            <label>Accounting/AP Email</label>
            <input type="email" value={form.accountingEmail} onChange={set('accountingEmail')} placeholder="accounting@company.com" />
          </div>
        </div>

        <div className="admin-row">
          <div className="admin-field">
            <label>Invoice # (optional)</label>
            <input value={form.invoiceNum} onChange={set('invoiceNum')} placeholder="e.g. INV-2026-001" />
          </div>
          <div className="admin-field">
            <label>Due Date</label>
            <input type="date" value={form.dueDate} onChange={set('dueDate')} />
          </div>
        </div>

        {/* Line Items */}
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#1B2A4A', fontSize: 14 }}>
            Line Items
          </label>
          {lineItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                value={item.description}
                onChange={e => updateItem(i, 'description', e.target.value)}
                placeholder="Description"
                style={{ flex: 3, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
              <input
                type="number"
                value={item.quantity}
                onChange={e => updateItem(i, 'quantity', e.target.value)}
                placeholder="Qty"
                min="1"
                style={{ flex: 0.5, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, textAlign: 'center' }}
              />
              <input
                type="number"
                value={item.rate}
                onChange={e => updateItem(i, 'rate', e.target.value)}
                placeholder="Rate ($)"
                min="0"
                step="0.01"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
              <span style={{ flex: 0.8, textAlign: 'right', fontSize: 14, color: '#1B2A4A', fontWeight: 600, minWidth: 80 }}>
                ${((Math.max(1, parseInt(item.quantity) || 1)) * (Number(item.rate) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={lineItems.length <= 1}
                style={{ background: 'none', border: 'none', color: lineItems.length <= 1 ? '#d1d5db' : '#ef4444', cursor: lineItems.length <= 1 ? 'default' : 'pointer', fontSize: 18, padding: '4px 8px' }}
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            style={{ background: 'none', border: '1px dashed #94a3b8', color: '#64748b', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginTop: 4 }}
          >
            + Add Line Item
          </button>
        </div>

        <div className="admin-row">
          <div className="admin-field">
            <label>Tax Rate (%)</label>
            <input type="number" value={form.taxRate} onChange={set('taxRate')} min="0" max="100" step="0.1" />
          </div>
          <div className="admin-field">
            <label>Linked Proposal ID (optional)</label>
            <input value={form.proposalId} onChange={set('proposalId')} placeholder="e.g. abc123" />
          </div>
        </div>

        <div className="admin-field">
          <label>Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            placeholder="Payment terms, special instructions, etc."
            rows={3}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, resize: 'vertical' }}
          />
        </div>

        {/* Totals summary */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b', marginBottom: 4 }}>
            <span>Subtotal</span>
            <span>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          {taxAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b', marginBottom: 4 }}>
              <span>Tax ({form.taxRate}%)</span>
              <span>${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, color: '#1B2A4A', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
            <span>Total</span>
            <span style={{ color: '#00bd70' }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? 'Creating...' : 'Create Invoice'}
        </button>
      </form>
    </div>
  )
}

// ── Invoices List ─────────────────────────────────────────────────
function InvoicesList({ invoices, loading, onRefresh }) {
  const [sendingId, setSendingId] = useState(null)

  async function handleSend(id) {
    setSendingId(id)
    try {
      const res = await fetch(`${API}/api/invoices/${id}/send`, {
        method: 'POST',
        headers: authHeaders()
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to send')
      } else {
        if (onRefresh) onRefresh()
      }
    } catch {
      alert('Failed to send invoice')
    } finally {
      setSendingId(null)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <h3 className="section-title">All Invoices</h3>
        <div className="loading"><div className="spinner"></div></div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="section-title">All Invoices ({invoices.length})</h3>
      {invoices.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>No invoices created yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Total</th>
                <th>Status</th>
                <th>ACH</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td>{inv.invoice_num || '—'}</td>
                  <td>{inv.company}</td>
                  <td>{inv.contact_name}</td>
                  <td>${Number(inv.total).toLocaleString()}</td>
                  <td>
                    <span className={`admin-badge badge-${inv.status}`}>{inv.status}</span>
                  </td>
                  <td>
                    {inv.ach_authorized ? (
                      <span style={{ color: '#00bd70', fontWeight: 600, fontSize: 13 }} title={`By: ${inv.ach_authorized_by}`}>Authorized</span>
                    ) : '—'}
                  </td>
                  <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer" className="admin-link">
                      View
                    </a>
                    {inv.status === 'draft' && (
                      <button
                        onClick={() => handleSend(inv.id)}
                        disabled={sendingId === inv.id}
                        style={{ background: '#00bd70', color: '#fff', border: 'none', padding: '2px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        {sendingId === inv.id ? '...' : 'Send'}
                      </button>
                    )}
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
  const [invoices, setInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')
  const [activeTab, setActiveTab] = useState('proposals') // 'proposals' or 'invoices'

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

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/invoices`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      if (res.status === 401) return
      const data = await res.json()
      setInvoices(Array.isArray(data) ? data : data.invoices || [])
    } catch {
      // silently fail
    } finally {
      setLoadingInvoices(false)
    }
  }, [])

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
    fetchInvoices()
  }, [navigate, fetchProposals, fetchInvoices])

  function handleLogout() {
    localStorage.removeItem('roofmri_token')
    navigate('/admin/login')
  }

  const tabStyle = (tab) => ({
    padding: '10px 24px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    borderBottom: activeTab === tab ? '3px solid #00bd70' : '3px solid transparent',
    background: 'none',
    color: activeTab === tab ? '#1B2A4A' : '#94a3b8',
    transition: 'all 0.2s',
  })

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

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', marginBottom: 20, background: '#fff', borderRadius: '8px 8px 0 0', paddingLeft: 8 }}>
        <button style={tabStyle('proposals')} onClick={() => setActiveTab('proposals')}>
          Proposals
        </button>
        <button style={tabStyle('invoices')} onClick={() => setActiveTab('invoices')}>
          Invoices
        </button>
      </div>

      {activeTab === 'proposals' && (
        <>
          <ProposalForm onSent={fetchProposals} />
          <ProposalsList proposals={proposals} loading={loadingProposals} />
        </>
      )}

      {activeTab === 'invoices' && (
        <>
          <InvoiceForm onSent={fetchInvoices} />
          <InvoicesList invoices={invoices} loading={loadingInvoices} onRefresh={fetchInvoices} />
        </>
      )}
    </div>
  )
}
