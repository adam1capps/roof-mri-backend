import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthToken, signOutEverywhere } from '../lib/clerkBridge'

const API = import.meta.env.VITE_API_URL || ''

async function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await getAuthToken()}`
  }
}

// ── Proposal Form ──────────────────────────────────────────────────
const FIXED_PRICE_LABELS = { professional: '$12,500', regional: '$35,000', enterprise: '$75,000' }

function ProposalForm({ onSent }) {
  const [form, setForm] = useState({
    contactName: '', company: '', email: '', tier: '',
    vimeoUrl: '', proposalNum: ''
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
      // Pricing is fixed at $12.5K / $35K / $75K – the server enforces it,
      // so the form only sends who the proposal is for and which tier (if any)
      const body = {
        contactName: form.contactName,
        company: form.company,
        email: form.email,
        tier: form.tier || null,
        vimeoUrl: form.vimeoUrl || null,
        proposalNum: form.proposalNum || null,
      }

      const res = await fetch(`${API}/api/send-proposal`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send proposal')

      setResult(data)
      setForm({
        contactName: '', company: '', email: '', tier: '',
        vimeoUrl: '', proposalNum: ''
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
          <label>Package Tier</label>
          <select value={form.tier} onChange={set('tier')}>
            <option value="">Let client choose their package</option>
            <option value="professional">Professional — $12,500 (3 trainees, 1 kit)</option>
            <option value="regional">Regional — $35,000 (10 trainees, 2 kits)</option>
            <option value="enterprise">Enterprise — $75,000 (25 trainees, 4 kits)</option>
          </select>
        </div>

        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: '12px 16px', marginBottom: 4, fontSize: 13, color: '#64748b'
        }}>
          Pricing is fixed: <strong style={{ color: '#1B2A4A' }}>Professional $12,500</strong>{' · '}
          <strong style={{ color: '#1B2A4A' }}>Regional $35,000</strong>{' · '}
          <strong style={{ color: '#1B2A4A' }}>Enterprise $75,000</strong>
          {form.tier && <> — this proposal will be sent at <strong style={{ color: '#00a35f' }}>{FIXED_PRICE_LABELS[form.tier]}</strong></>}
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
function proposalLink(id) {
  return `${window.location.origin}/p/${id}`
}

function fmtDate(value) {
  if (!value) return null
  // DATE columns arrive as midnight UTC; format in UTC so the day doesn't shift
  return new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
}

function ProposalRow({ p }) {
  const [copied, setCopied] = useState(false)
  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState(null)

  const isPayLater = p.status === 'signed_pay_later'
  const isSigned = p.status === 'signed' || isPayLater
  const overdue = isPayLater && p.payment_status !== 'paid' && p.payment_due_date &&
    new Date(p.payment_due_date) < new Date()
  const link = proposalLink(p.id)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // Clipboard API unavailable (older browsers / insecure context)
      window.prompt('Copy this proposal link:', link)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function resend() {
    const to = window.prompt('Resend this proposal to:', p.email)
    if (!to) return
    setResending(true)
    setMessage(null)
    try {
      const res = await fetch(`${API}/api/proposals/${p.id}/resend`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ email: to.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to resend')
      setMessage({ ok: true, text: `Sent to ${to.trim()}` })
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    } finally {
      setResending(false)
    }
  }

  const statusLabel = isPayLater ? 'Signed · pay later' : isSigned ? 'Signed' : p.opened_at ? 'Opened' : 'Sent'

  return (
    <div className="proposal-row">
      <div className="proposal-row-main">
        <div className="proposal-row-title">
          <strong>{p.company}</strong>
          {p.proposal_num && <span className="proposal-row-num">#{p.proposal_num}</span>}
        </div>
        <div className="proposal-row-meta">
          {p.contact_name} · {p.email}
        </div>
        <div className="proposal-row-meta">
          Sent {fmtDate(p.created_at)}
          {p.tier && <> · <span style={{ textTransform: 'capitalize' }}>{p.tier}</span></>}
          {p.total_price ? <> · ${Number(p.total_price).toLocaleString()}</> : null}
          {p.open_count > 0 && <> · viewed {p.open_count}×</>}
        </div>
        <div className="proposal-row-badges">
          <span className={`admin-badge badge-${p.status}`}>{statusLabel}</span>
          <span className={`admin-badge badge-${p.payment_status}`}>{p.payment_status}</span>
          {isPayLater && (
            <span style={{ fontSize: 12, color: p.deposit_paid ? '#00a35f' : '#b45309' }}>
              {p.deposit_paid ? '$100 deposit paid' : 'Deposit pending'}
            </span>
          )}
          {p.requested_training_week && (
            <span style={{ fontSize: 12, color: '#64748b' }}>Week of {fmtDate(p.requested_training_week)}</span>
          )}
          {p.payment_due_date && p.payment_status !== 'paid' && (
            <span style={{ fontSize: 12, color: overdue ? '#dc2626' : '#64748b', fontWeight: overdue ? 700 : 400 }}>
              {overdue ? 'Overdue since' : 'Balance due'} {fmtDate(p.payment_due_date)}
            </span>
          )}
        </div>
        {message && (
          <div style={{ fontSize: 12, marginTop: 6, color: message.ok ? '#00a35f' : '#dc2626' }}>{message.text}</div>
        )}
      </div>
      <div className="proposal-row-actions">
        <a href={link} target="_blank" rel="noopener noreferrer" className="btn-small">Open</a>
        <button type="button" className="btn-small" onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy link'}</button>
        <button type="button" className="btn-small" onClick={resend} disabled={resending}>
          {resending ? 'Sending…' : 'Resend'}
        </button>
      </div>
    </div>
  )
}

function ProposalsList({ proposals, loading, error, onRetry }) {
  const [query, setQuery] = useState('')

  if (loading) {
    return (
      <div className="card">
        <h3 className="section-title">Sent Proposals</h3>
        <div className="loading"><div className="spinner"></div></div>
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? proposals.filter(p => [p.company, p.contact_name, p.email, p.proposal_num]
        .some(v => v && String(v).toLowerCase().includes(q)))
    : proposals

  return (
    <div className="card">
      <h3 className="section-title">Sent Proposals ({proposals.length})</h3>
      {error ? (
        <div className="admin-error">
          Couldn{'’'}t load proposals: {error}{' '}
          <button type="button" className="btn-small" onClick={onRetry}>Retry</button>
        </div>
      ) : proposals.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>No proposals sent yet.</p>
      ) : (
        <>
          <div className="admin-field" style={{ marginBottom: 12 }}>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search company, contact, or email"
            />
          </div>
          {shown.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>No proposals match {'“'}{query}{'”'}.</p>
          ) : (
            shown.map(p => <ProposalRow key={p.id} p={p} />)
          )}
        </>
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
        headers: await authHeaders(),
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
        headers: await authHeaders()
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
            <div key={i} className="line-item">
              <input
                className="line-item-desc"
                value={item.description}
                onChange={e => updateItem(i, 'description', e.target.value)}
                placeholder="Description"
              />
              <input
                className="line-item-qty"
                type="number"
                inputMode="numeric"
                value={item.quantity}
                onChange={e => updateItem(i, 'quantity', e.target.value)}
                placeholder="Qty"
                min="1"
              />
              <input
                type="number"
                inputMode="decimal"
                value={item.rate}
                onChange={e => updateItem(i, 'rate', e.target.value)}
                placeholder="Rate ($)"
                min="0"
                step="0.01"
              />
              <span className="line-item-amount">
                ${((Math.max(1, parseInt(item.quantity) || 1)) * (Number(item.rate) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <button
                type="button"
                className="line-item-remove"
                onClick={() => removeItem(i)}
                disabled={lineItems.length <= 1}
                aria-label="Remove line item"
              >
                &times;
              </button>
            </div>
          ))}
          <button type="button" className="add-line-item" onClick={addItem}>
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
        headers: await authHeaders()
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
  const [proposalsError, setProposalsError] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')
  const [activeTab, setActiveTab] = useState('proposals') // 'proposals' or 'invoices'

  const fetchProposals = useCallback(async () => {
    setProposalsError(null)
    try {
      const res = await fetch(`${API}/api/proposals?limit=200`, {
        headers: await authHeaders()
      })
      if (res.status === 401) {
        localStorage.removeItem('roofmri_token')
        navigate('/admin/login')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setProposals(Array.isArray(data) ? data : data.proposals || [])
    } catch (err) {
      setProposalsError(err.message || 'Network error')
    } finally {
      setLoadingProposals(false)
    }
  }, [navigate])

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/invoices`, {
        headers: await authHeaders()
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
    // Verify auth (Clerk Google session or legacy password token)
    let cancelled = false
    async function verifyAuth() {
      const token = await getAuthToken()
      if (cancelled) return
      if (!token) { navigate('/admin/login'); return }

      try {
        const res = await fetch(`${API}/api/admin/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (cancelled) return
        if (!res.ok) {
          // Sign out of Clerk too — otherwise a rejected Google account
          // bounces between /admin and /admin/login forever
          await signOutEverywhere()
          navigate(res.status === 403 ? '/admin/login?error=domain' : '/admin/login')
          return
        }
        const data = await res.json()
        if (!cancelled && data?.email) setAdminEmail(data.email)
      } catch {
        if (!cancelled) {
          await signOutEverywhere()
          navigate('/admin/login')
        }
      }
    }
    verifyAuth()

    fetchProposals()
    fetchInvoices()
    return () => { cancelled = true }
  }, [navigate, fetchProposals, fetchInvoices])

  async function handleLogout() {
    await signOutEverywhere()
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
          <ProposalsList proposals={proposals} loading={loadingProposals} error={proposalsError} onRetry={fetchProposals} />
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
