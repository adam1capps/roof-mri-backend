import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || ''

export default function InvoicePage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(null) // null, 'ach', 'card'
  const [achName, setAchName] = useState('')
  const [achAgreed, setAchAgreed] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/invoices/${id}`)
      if (!res.ok) throw new Error('Invoice not found')
      const data = await res.json()
      setInvoice(data)
      if (data.status === 'paid') setPaymentSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchInvoice()
  }, [fetchInvoice])

  // Poll for payment after return from Stripe
  useEffect(() => {
    if (searchParams.get('payment') === 'success' && invoice && invoice.status !== 'paid') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/api/invoices/${id}/payment-status`)
          const data = await res.json()
          if (data.status === 'paid') {
            setPaymentSuccess(true)
            setInvoice(prev => ({ ...prev, status: 'paid', paid_at: data.paid_at }))
            clearInterval(interval)
          }
        } catch { /* keep polling */ }
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [searchParams, invoice, id])

  async function handleACHPay(e) {
    e.preventDefault()
    if (!achName.trim() || !achAgreed) return
    setProcessing(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/invoices/${id}/authorize-ach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizedBy: achName.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to authorize ACH')
      window.location.href = data.checkoutUrl
    } catch (err) {
      setError(err.message)
      setProcessing(false)
    }
  }

  async function handleCardPay() {
    setProcessing(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/invoices/${id}/pay-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start payment')
      window.location.href = data.checkoutUrl
    } catch (err) {
      setError(err.message)
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <header className="site-header">
          <span className="logo">ROOF <span className="accent">MRI</span></span>
          <span className="tagline">Invoice</span>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (error && !invoice) {
    return (
      <div className="page-wrapper">
        <header className="site-header">
          <span className="logo">ROOF <span className="accent">MRI</span></span>
          <span className="tagline">Invoice</span>
        </header>
        <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
          <h2 style={{ color: '#1B2A4A', marginBottom: 8 }}>Invoice Not Found</h2>
          <p style={{ color: '#64748b' }}>This invoice link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  const lineItems = typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : (invoice.line_items || [])
  const subtotal = Number(invoice.subtotal || 0)
  const taxAmount = Number(invoice.tax_amount || 0)
  const taxRate = Number(invoice.tax_rate || 0)
  const total = Number(invoice.total || 0)
  const invoiceNum = invoice.invoice_num || invoice.id
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Upon receipt'
  const createdDate = new Date(invoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="logo">ROOF <span className="accent">MRI</span></span>
        <span className="tagline">Invoice</span>
      </header>

      {/* Payment success banner */}
      {paymentSuccess && (
        <div className="card" style={{ background: '#f0fdf4', border: '2px solid #00bd70', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>&#10003;</div>
          <h2 style={{ color: '#15803d', margin: '0 0 8px 0' }}>Payment Received</h2>
          <p style={{ color: '#166534', margin: 0 }}>Thank you! Your payment has been processed successfully.</p>
        </div>
      )}

      {searchParams.get('payment') === 'success' && !paymentSuccess && (
        <div className="card" style={{ background: '#fffbeb', border: '2px solid #f59e0b', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
          <p style={{ color: '#92400e', margin: 0 }}>Confirming your payment... this may take a moment.</p>
        </div>
      )}

      {/* Invoice header */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h2 style={{ color: '#1B2A4A', margin: '0 0 4px 0', fontSize: 22 }}>Invoice #{invoiceNum}</h2>
            <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Date: {createdDate}</p>
            <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: 14 }}>Due: {dueDate}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`admin-badge badge-${invoice.status}`} style={{ fontSize: 14, padding: '6px 16px' }}>
              {invoice.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 24, border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Bill To</p>
          <p style={{ margin: 0, fontSize: 15, color: '#1B2A4A', fontWeight: 600 }}>{invoice.contact_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: '#64748b' }}>{invoice.company}</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: '#64748b' }}>{invoice.email}</p>
        </div>

        {/* Line Items */}
        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ textAlign: 'center', width: 60 }}>Qty</th>
                <th style={{ textAlign: 'right', width: 100 }}>Rate</th>
                <th style={{ textAlign: 'right', width: 100 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td style={{ textAlign: 'center' }}>{item.quantity || 1}</td>
                  <td style={{ textAlign: 'right' }}>${Number(item.rate || item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right' }}>${Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: '#64748b' }}>
              <span>Subtotal</span>
              <span style={{ color: '#1B2A4A' }}>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            {taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: '#64748b' }}>
                <span>Tax ({taxRate}%)</span>
                <span style={{ color: '#1B2A4A' }}>${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #1B2A4A', marginTop: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1B2A4A' }}>Total Due</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#00bd70' }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 8, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Notes</p>
            <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Payment Section */}
      {invoice.status !== 'paid' && !paymentSuccess && (
        <div className="card">
          <h3 className="section-title">Pay This Invoice</h3>

          {error && <div className="admin-error" style={{ marginBottom: 16 }}>{error}</div>}

          {!paymentMethod && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => setPaymentMethod('ach')}
                style={{ flex: 1, minWidth: 200, padding: '16px 24px', fontSize: 16 }}
              >
                Pay via ACH Bank Transfer
                <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginTop: 4 }}>Authorize a direct bank debit</span>
              </button>
              <button
                className="btn"
                onClick={() => setPaymentMethod('card')}
                style={{ flex: 1, minWidth: 200, padding: '16px 24px', fontSize: 16, background: '#1B2A4A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Pay via Credit Card
                <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginTop: 4 }}>Visa, Mastercard, Amex</span>
              </button>
            </div>
          )}

          {paymentMethod === 'ach' && (
            <form onSubmit={handleACHPay}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#15803d', fontSize: 15 }}>ACH Bank Transfer Authorization</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
                  By authorizing this payment, you consent to a one-time ACH debit from your bank account
                  in the amount of <strong>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> to
                  Roof MRI for Invoice #{invoiceNum}. This authorization remains in effect until the payment is
                  processed or you revoke it by contacting us.
                </p>
              </div>

              <div className="admin-field" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#1B2A4A' }}>
                  Authorized By (Full Name) *
                </label>
                <input
                  value={achName}
                  onChange={e => setAchName(e.target.value)}
                  placeholder="Enter the name of the person authorizing this payment"
                  required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={achAgreed}
                  onChange={e => setAchAgreed(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                  I authorize Roof MRI to initiate a one-time ACH debit from my bank account for the amount
                  shown above. I understand this payment will be processed through Stripe's secure banking connection.
                </span>
              </label>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={processing || !achName.trim() || !achAgreed}
                  style={{ padding: '12px 32px', fontSize: 16 }}
                >
                  {processing ? 'Processing...' : 'Authorize & Connect Bank'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod(null); setError('') }}
                  style={{ padding: '12px 24px', fontSize: 14, background: 'none', border: '1px solid #d1d5db', borderRadius: 8, color: '#64748b', cursor: 'pointer' }}
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {paymentMethod === 'card' && (
            <div>
              <p style={{ fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: 1.6 }}>
                You'll be redirected to our secure payment processor (Stripe) to complete your credit card payment
                of <strong style={{ color: '#1B2A4A' }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleCardPay}
                  disabled={processing}
                  style={{ padding: '12px 32px', fontSize: 16 }}
                >
                  {processing ? 'Redirecting...' : 'Pay Now'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod(null); setError('') }}
                  style={{ padding: '12px 24px', fontSize: 14, background: 'none', border: '1px solid #d1d5db', borderRadius: 8, color: '#64748b', cursor: 'pointer' }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACH Authorization record (if already authorized) */}
      {invoice.ach_authorized && (
        <div className="card" style={{ background: '#f8fafc' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            ACH payment authorized by <strong style={{ color: '#1B2A4A' }}>{invoice.ach_authorized_by}</strong> on{' '}
            {new Date(invoice.ach_authorized_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  )
}
