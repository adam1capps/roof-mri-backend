import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Configurator from '../components/Configurator'
import ComparisonTable from '../components/ComparisonTable'
import TermsAccordion from '../components/TermsAccordion'
import RoiCalculator from '../components/RoiCalculator'
import SignaturePad from '../components/SignaturePad'

const API = import.meta.env.VITE_API_URL || ''

const TIER_NAMES = {
  professional: 'Professional',
  regional: 'Regional',
  enterprise: 'Enterprise',
}
const TIER_TRAINEES = { professional: 3, regional: 10, enterprise: 25 }
const TIER_KITS = { professional: 1, regional: 2, enterprise: 4 }

const TIER_FEATURES = {
  professional: [
    '3 Certified Trainees',
    '1 Recon Kit (Tramex)',
    'PHD Scale Calibration',
    'Ongoing Technical Support',
  ],
  regional: [
    '10 Certified Trainees',
    '2 Recon Kits (Tramex)',
    'PHD Scale Calibration',
    '2 Training Tracks Included',
    'Videography Included',
    'Ongoing Technical Support',
  ],
  enterprise: [
    '25 Certified Trainees',
    '4 Recon Kits (Tramex)',
    'PHD Scale Calibration',
    'All Training Tracks Included',
    'Videography Included',
    'On-Roof Training Included',
    'Priority Support',
  ],
}

function formatCurrency(amount) {
  return Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function CheckSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
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
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const signatureRef = useRef(null)

  const paymentParam = searchParams.get('payment')

  // Fetch proposal
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

  // Poll for payment after Stripe redirect
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
      try {
        const res = await fetch(`${API}/api/proposals/${id}?track=false`)
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

  // Handlers
  async function handleConfigure(config) {
    setConfiguring(true)
    try {
      const res = await fetch(`${API}/api/proposals/${id}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to configure package')
      }
      const updated = await res.json()
      setProposal(updated)
      setShowConfigurator(false)
    } catch (err) {
      throw err
    } finally {
      setConfiguring(false)
    }
  }

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

  function scrollToSignature() {
    signatureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Loading
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

  // Error
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

  // Derived state
  const isConfigured = !!(proposal.tier || proposal.selected_tier)
  const isSigned = proposal.status === 'signed'
  const isPaid = proposal.payment_status === 'paid'
  const hasPrice = proposal.total_price && Number(proposal.total_price) > 0
  const needsConfiguration = proposal.let_client_choose && !isConfigured
  const firstName = proposal.contact_name?.split(' ')[0] || ''

  const tierPrices = {
    professional: proposal.professional_price,
    regional: proposal.regional_price,
    enterprise: proposal.enterprise_price,
  }

  // Build summary rows for configured proposals
  const summaryRows = []
  if (isConfigured) {
    const tier = proposal.selected_tier || proposal.tier
    summaryRows.push(['Package', TIER_NAMES[tier] || tier])
    summaryRows.push(['Company', proposal.company])

    const baseTrainees = TIER_TRAINEES[tier] || 0
    const totalTrainees = baseTrainees + (proposal.extra_trainees || 0)
    summaryRows.push(['Certified Trainees', totalTrainees])

    const baseKits = TIER_KITS[tier] || 0
    const totalKits = baseKits + (proposal.extra_kits || 0)
    summaryRows.push(['Recon Kits', totalKits])

    if (proposal.tracks && proposal.tracks.length > 0) {
      summaryRows.push(['Training Tracks', proposal.tracks.join(', ')])
    }
    if (proposal.videography) summaryRows.push(['Videography', 'Included'])
    if (proposal.on_roof_day) summaryRows.push(['On-Roof Training Day', 'Included'])
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
        <p className="greeting-text">Hi {firstName},</p>
        <p className="greeting-body">
          Thanks for taking the time to talk with us about Roof MRI training for{' '}
          <strong>{proposal.company}</strong>. We&apos;ve put together a custom training
          proposal based on our conversation. Everything you need is below.
        </p>
      </div>

      {/* ═══ BROWSE PHASE: Tier cards + comparison (when client needs to choose) ═══ */}
      {needsConfiguration && (
        <>
          <div className="card tier-cards-section">
            <p className="section-title">Choose Your Training Package</p>
            <p className="tier-cards-subtitle">
              Select the package that best fits your team size and territory. Every package includes
              full certification, equipment, and ongoing support.
            </p>
            <div className="tier-cards-grid">
              {['professional', 'regional', 'enterprise'].map(key => {
                const price = tierPrices[key]
                const hasP = price && Number(price) > 0
                const isPopular = key === 'regional'
                return (
                  <div key={key} className={`tier-card ${isPopular ? 'popular' : ''}`}>
                    {isPopular && <div className="tier-card-badge">Most Popular</div>}
                    <h3 className="tier-card-name">{TIER_NAMES[key]}</h3>
                    <p className="tier-card-meta">
                      {TIER_TRAINEES[key]} trainees &middot; {TIER_KITS[key]} kit{TIER_KITS[key] > 1 ? 's' : ''}
                    </p>
                    {hasP ? (
                      <>
                        <p className="tier-card-price">{formatCurrency(price)}</p>
                        <p className="tier-card-price-sub">starting at</p>
                      </>
                    ) : (
                      <p className="tier-card-price" style={{ color: '#94a3b8', fontSize: 16 }}>Contact for Pricing</p>
                    )}
                    <ul className="tier-card-features">
                      {(TIER_FEATURES[key] || []).map((f, i) => (
                        <li key={i}><CheckSvg />{f}</li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="card">
            <ComparisonTable />
          </div>
        </>
      )}

      {/* ═══ CONFIGURED PHASE: Summary, investment, ROI, video, terms, signature ═══ */}
      {isConfigured && !isSigned && !isPaid && (
        <>
          {/* Package Summary */}
          {summaryRows.length > 0 && (
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
          )}

          {/* Investment */}
          {hasPrice && (
            <div className="card">
              <p className="section-title">Your Investment</p>
              <div className="investment-row">
                <span className="investment-label">Total</span>
                <span className="investment-amount">{formatCurrency(proposal.total_price)}</span>
              </div>
            </div>
          )}

          {/* ROI Calculator */}
          <div className="card">
            <RoiCalculator investmentAmount={proposal.total_price} />
          </div>

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

          {/* Comparison Table (also visible after config for reference) */}
          {proposal.let_client_choose && (
            <div className="card">
              <ComparisonTable />
            </div>
          )}

          {/* Terms */}
          <div className="card">
            <TermsAccordion />
          </div>

          {/* Signature */}
          <div className="card" ref={signatureRef}>
            {signError && (
              <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{signError}</p>
            )}
            <SignaturePad onSign={handleSign} />
          </div>
        </>
      )}

      {/* ═══ Payment Success ═══ */}
      {isPaid && (
        <div className="card">
          <div className="payment-success">
            <div className="signed-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3>Payment Received</h3>
            <p>Thank you! Your payment has been processed successfully.</p>
            <p style={{ marginTop: 8 }}>We&apos;ll be in touch shortly to get your training scheduled.</p>
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

      {/* ═══ Signed confirmation + Pay Now ═══ */}
      {isSigned && !isPaid && !checkingPayment && (
        <div className="card">
          <div className="signed-confirmation">
            <div className="signed-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ fontFamily: 'Poppins, sans-serif', color: '#1B2A4A', fontSize: 18, marginBottom: 4 }}>
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

      {/* Closing */}
      <div className="card">
        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 8 }}>
          If you have any questions, feel free to reach out. We&apos;re here to help.
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1B2A4A' }}>Adam Capps</p>
        <p style={{ fontSize: 13, color: '#64748b' }}>Roof MRI</p>
      </div>

      <footer className="site-footer">
        <p>Roof MRI | Advancing the Science of Roof Moisture Detection</p>
        <p>roof-mri.com</p>
      </footer>

      {/* ═══ Floating Action Button ═══ */}
      {needsConfiguration && (
        <button
          className="floating-btn floating-btn-build"
          onClick={() => setShowConfigurator(true)}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
          </svg>
          Build Your Package
        </button>
      )}
      {isConfigured && !isSigned && !isPaid && (
        <button
          className="floating-btn floating-btn-sign"
          onClick={scrollToSignature}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          Sign Proposal
        </button>
      )}

      {/* ═══ Configurator Modal ═══ */}
      {showConfigurator && (
        <Configurator
          prices={tierPrices}
          onConfirm={handleConfigure}
          onClose={() => setShowConfigurator(false)}
          submitting={configuring}
        />
      )}
    </div>
  )
}
