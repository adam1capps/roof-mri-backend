import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import SignaturePad from '../components/SignaturePad'

const API = import.meta.env.VITE_API_URL || ''

const TIER_NAMES = {
  professional: 'Professional',
  regional: 'Regional',
  enterprise: 'Enterprise',
}
const TIER_TRAINEES = { professional: 3, regional: 10, enterprise: 25 }
const TIER_KITS = { professional: 1, regional: 2, enterprise: 4 }

function formatCurrency(amount) {
  return Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function ProposalPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [proposal, setProposal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [signError, setSignError] = useState(null)
  const [justSigned, setJustSigned] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)

  const paymentParam = searchParams.get('payment')

  useEffect(() => {
    async function fetchProposal() {
      try {
        const res = await fetch(`${API}/api/proposals/${id}`)
        if (!res.ok) {
          if (res.status === 404) throw new Error('Proposal not found')
          throw new Error('Failed to load proposal')
        }
        const data = await res.json()
        setProposal(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProposal()
  }, [id])

  // If returning from Stripe with ?payment=success, poll for payment confirmation
  useEffect(() => {
    if (paymentParam !== 'success' || !proposal) return
    let cancelled = false

    async function pollPayment() {
      setCheckingPayment(true)
      for (let i = 0; i < 10; i++) {
        if (cancelled) return
        try {
          const res = await fetch(`${API}/api/proposals/${id}/payment-status`)
          const data = await res.json()
          if (data.payment_status === 'paid') {
            setProposal(prev => ({ ...prev, payment_status: 'paid' }))
            setCheckingPayment(false)
            return
          }
        } catch { /* retry */ }
        await new Promise(r => setTimeout(r, 2000))
      }
      // After polling, just refresh the whole proposal
      try {
        const res = await fetch(`${API}/api/proposals/${id}`)
        if (res.ok) {
          const data = await res.json()
          setProposal(data)
        }
      } catch { /* give up */ }
      setCheckingPayment(false)
    }

    pollPayment()
    return () => { cancelled = true }
  }, [paymentParam, proposal?.id, id])

  async function handleSign(signatureName, signatureData) {
    setSignError(null)
    const res = await fetch(`${API}/api/proposals/${id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureName, signatureData }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to sign')
    }
    setProposal(prev => ({ ...prev, status: 'signed', signature_name: signatureName }))
    setJustSigned(true)
  }

  async function handlePayNow() {
    try {
      const res = await fetch(`${API}/api/proposals/${id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSignError(data.error || 'Failed to start payment')
        return
      }
      const data = await res.json()
      window.location.href = data.checkoutUrl
    } catch {
      setSignError('Failed to connect to payment system')
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <header className="site-header">
          <span className="logo">ROOF <span className="accent">MRI</span></span>
          <span className="tagline">Training &amp; Certification</span>
        </header>
        <div className="card loading">
          <div className="spinner" />
          <p style={{ marginTop: 12, color: '#64748b', fontSize: 14 }}>Loading proposal...</p>
        </div>
        <footer className="site-footer">
          <p>Roof MRI | Advancing the Science of Roof Moisture Detection</p>
          <p>roof-mri.com</p>
        </footer>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <header className="site-header">
          <span className="logo">ROOF <span className="accent">MRI</span></span>
          <span className="tagline">Training &amp; Certification</span>
        </header>
        <div className="card error-page">
          <h2>Proposal Not Found</h2>
          <p>This proposal link may be invalid or expired. Please check your email for the correct link.</p>
        </div>
        <footer className="site-footer">
          <p>Roof MRI | Advancing the Science of Roof Moisture Detection</p>
          <p>roof-mri.com</p>
        </footer>
      </div>
    )
  }

  const isSigned = proposal.status === 'signed'
  const isPaid = proposal.payment_status === 'paid'
  const hasPrice = proposal.total_price && Number(proposal.total_price) > 0
  const firstName = proposal.contact_name?.split(' ')[0] || ''

  // Build summary rows
  const summaryRows = []
  if (proposal.let_client_choose) {
    summaryRows.push(['Package', 'Your choice of training tier'])
    summaryRows.push(['Company', proposal.company])
  } else {
    if (proposal.tier) {
      summaryRows.push(['Package', TIER_NAMES[proposal.tier] || proposal.tier])
    }
    summaryRows.push(['Company', proposal.company])
    if (proposal.tier) {
      const baseTrainees = TIER_TRAINEES[proposal.tier] || 0
      const totalTrainees = baseTrainees + (proposal.extra_trainees || 0)
      summaryRows.push(['Trainees', totalTrainees])

      const baseKits = TIER_KITS[proposal.tier] || 0
      const totalKits = baseKits + (proposal.extra_kits || 0)
      summaryRows.push(['Recon Kits', totalKits])
    }
    if (proposal.tracks && proposal.tracks.length > 0) {
      summaryRows.push(['Training Tracks', proposal.tracks.join(', ')])
    }
    if (proposal.videography) {
      summaryRows.push(['Videography', 'Included'])
    }
    if (proposal.on_roof_day) {
      summaryRows.push(['On-Roof Training Day', 'Included'])
    }
  }

  // Extract Vimeo ID for embed
  let vimeoId = null
  if (proposal.vimeo_url) {
    const match = proposal.vimeo_url.match(/vimeo\.com\/(\d+)/)
    if (match) vimeoId = match[1]
  }

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <span className="logo">ROOF <span className="accent">MRI</span></span>
        <span className="tagline">Training &amp; Certification</span>
      </header>

      {/* Greeting */}
      <div className="card">
        <p style={{ fontSize: 16, lineHeight: 1.5 }}>Hi {firstName},</p>
        <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, marginTop: 8 }}>
          Thanks for taking the time to talk with us about Roof MRI training for{' '}
          <strong>{proposal.company}</strong>. We've put together a custom training
          proposal based on our conversation. Everything you need is below.
        </p>
      </div>

      {/* Training Overview */}
      <div className="card">
        <p className="section-title">Training Overview</p>
        <table className="summary-table">
          <tbody>
            {summaryRows.map(([label, value], i) => (
              <tr key={i}>
                <td>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Investment */}
      {hasPrice && !proposal.let_client_choose && (
        <div className="card">
          <p className="section-title">Your Investment</p>
          <div className="investment-row">
            <span className="investment-label">Total</span>
            <span className="investment-amount">{formatCurrency(proposal.total_price)}</span>
          </div>
        </div>
      )}

      {/* Video */}
      {vimeoId && (
        <div className="card">
          <p className="section-title">A Quick Intro From Our Team</p>
          <div className="video-wrapper">
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title="Roof MRI Intro"
            />
          </div>
        </div>
      )}

      {/* Payment Success */}
      {isPaid && (
        <div className="card">
          <div className="payment-success">
            <div className="signed-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3>Payment Received</h3>
            <p>Thank you! Your payment has been processed successfully.</p>
            <p style={{ marginTop: 8 }}>We'll be in touch shortly to get your training scheduled.</p>
          </div>
        </div>
      )}

      {/* Checking payment after Stripe redirect */}
      {checkingPayment && !isPaid && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 12, color: '#64748b', fontSize: 14 }}>Confirming your payment...</p>
        </div>
      )}

      {/* Signed confirmation + Pay Now */}
      {isSigned && !isPaid && !checkingPayment && (
        <div className="card">
          <div className="signed-confirmation">
            <div className="signed-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ color: '#1B2A4A', fontSize: 18, marginBottom: 4 }}>
              {justSigned ? 'Proposal Signed!' : 'Proposal Signed'}
            </h3>
            <p className="signed-info">
              Signed by {proposal.signature_name}
              {proposal.signed_at && ` on ${new Date(proposal.signed_at).toLocaleDateString()}`}
            </p>
          </div>
          {hasPrice && (
            <>
              {signError && (
                <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{signError}</p>
              )}
              <button className="btn btn-primary" onClick={handlePayNow} type="button">
                Pay Now — {formatCurrency(proposal.total_price)}
              </button>
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 10 }}>
                Secure payment powered by Stripe
              </p>
            </>
          )}
        </div>
      )}

      {/* Signature pad (only if not yet signed) */}
      {!isSigned && !isPaid && (
        <div className="card">
          {signError && (
            <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{signError}</p>
          )}
          <SignaturePad onSign={handleSign} />
        </div>
      )}

      {/* Closing */}
      <div className="card">
        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 8 }}>
          If you have any questions, feel free to reach out. We're here to help.
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1B2A4A' }}>Adam Capps</p>
        <p style={{ fontSize: 13, color: '#64748b' }}>Roof MRI</p>
      </div>

      <footer className="site-footer">
        <p>Roof MRI | Advancing the Science of Roof Moisture Detection</p>
        <p>roof-mri.com</p>
      </footer>
    </div>
  )
}
