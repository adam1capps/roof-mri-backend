import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Configurator from '../components/Configurator'
import ComparisonTable from '../components/ComparisonTable'
import TermsAccordion from '../components/TermsAccordion'
import SignaturePad from '../components/SignaturePad'

const API = import.meta.env.VITE_API_URL || ''

const TIER_NAMES = { professional: 'Professional', regional: 'Regional', enterprise: 'Enterprise' }
const TIER_DAYS = { professional: '1 Day', regional: '2 Days', enterprise: '4 Days' }
const TIER_PRICES_DISPLAY = { professional: '$10K', regional: '$35K', enterprise: '$75K' }
const FIXED_PRICES = { professional: 10000, regional: 35000, enterprise: 75000 }

function fmt(n) { return '$' + Number(n).toLocaleString('en-US') }

function ChkSvg() {
  return (
    <svg className="chk" viewBox="0 0 24 24" fill="none" stroke="#00bd70" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const TIER_HIGHLIGHTS = {
  professional: [
    'Owner + 2 trainees',
    '1 Recon Kit included',
    'Classroom + field certification',
    'Optional online track sessions',
  ],
  regional: [
    'Up to 10 trainees, 2 Recon Kits',
    'Pick 2 dedicated track days',
    '1 free Nashville new hire seat',
    'Quarterly strategic check-ins',
  ],
  enterprise: [
    'Up to 25 trainees, 4 Recon Kits',
    'All tracks included (half-day)',
    'MRI Integrator Calls (weekly)',
    'On-roof training day included',
  ],
}

const TIER_DESCS = {
  professional: 'Get certified and start scanning. One focused day for your core team, with optional add-on tracks.',
  regional: 'Certification plus two dedicated tracks. Pick the deep dives that matter most to your operation.',
  enterprise: 'Comprehensive rollout across all tracks and locations. Fully custom, operationally capped at 4 on-site days.',
}

function getTrainingWeeks() {
  const weeks = []
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() + 42) // 6 weeks out
  // Find the next Monday from start
  const day = start.getDay()
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  start.setDate(start.getDate() + diff)
  for (let i = 0; i < 12; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i * 7)
    weeks.push(d.toISOString().split('T')[0])
  }
  return weeks
}

function formatWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const end = new Date(d)
  end.setDate(end.getDate() + 4)
  const opts = { month: 'short', day: 'numeric' }
  return `Week of ${d.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${d.getFullYear()}`
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
  const [checkingDeposit, setCheckingDeposit] = useState(false)
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const [fabMode, setFabMode] = useState('build')
  const [paymentPath, setPaymentPath] = useState(null) // 'pay_now' | 'pay_later'
  const [requestedTrainingWeek, setRequestedTrainingWeek] = useState('')
  const signatureRef = useRef(null)

  const paymentParam = searchParams.get('payment')
  const depositParam = searchParams.get('deposit')

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
        if (data.tier || data.selected_tier) {
          setFabMode('sign')
        }
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
      for (let i = 0; i < 15; i++) {
        if (cancelled) return
        try {
          const res = await fetch(`${API}/api/proposals/${id}/payment-status`)
          const data = await res.json()
          if (data.payment_status === 'paid') {
            setProposal((prev) => ({ ...prev, payment_status: 'paid' }))
            setCheckingPayment(false)
            return
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 2000))
      }
      setCheckingPayment(false)
    }
    pollPayment()
    return () => { cancelled = true }
  }, [paymentParam, proposal?.id, id])

  // Poll for deposit after Stripe redirect
  useEffect(() => {
    if (depositParam !== 'success' || !proposal) return
    let cancelled = false
    async function pollDeposit() {
      setCheckingDeposit(true)
      for (let i = 0; i < 15; i++) {
        if (cancelled) return
        try {
          const res = await fetch(`${API}/api/proposals/${id}/payment-status`)
          const data = await res.json()
          if (data.deposit_paid) {
            setProposal((prev) => ({
              ...prev,
              deposit_paid: true,
              payment_due_date: data.payment_due_date,
              requested_training_week: data.requested_training_week,
            }))
            setCheckingDeposit(false)
            return
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 2000))
      }
      setCheckingDeposit(false)
    }
    pollDeposit()
    return () => { cancelled = true }
  }, [depositParam, proposal?.id, id])

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
      setFabMode('sign')
    } catch (err) {
      throw err
    } finally {
      setConfiguring(false)
    }
  }

  async function handleSign(signatureName, signatureData) {
    setSignError(null)
    try {
      const body = { signatureName, signatureData, paymentPath }
      if (paymentPath === 'pay_later' && requestedTrainingWeek) {
        body.requestedTrainingWeek = requestedTrainingWeek
      }
      const res = await fetch(`${API}/api/proposals/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data.error || 'Failed to sign'
        setSignError(msg)
        throw new Error(msg)
      }
      const newStatus = paymentPath === 'pay_later' ? 'signed_pay_later' : 'signed'
      setProposal((prev) => ({
        ...prev,
        status: newStatus,
        signature_name: signatureName,
        signed_at: new Date().toISOString(),
        requested_training_week: requestedTrainingWeek || prev.requested_training_week,
      }))
      setJustSigned(true)
      setFabMode('hidden')
    } catch (err) {
      setSignError(err.message || 'Failed to sign proposal')
      throw err
    }
  }

  async function handlePayFull(method) {
    setSignError(null)
    try {
      const res = await fetch(`${API}/api/proposals/${id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: method || 'card' }),
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

  async function handleDeposit() {
    setSignError(null)
    try {
      const res = await fetch(`${API}/api/proposals/${id}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSignError(data.error || 'Failed to start deposit payment')
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

  function floatingAction() {
    if (fabMode === 'build') setShowConfigurator(true)
    else if (fabMode === 'sign') scrollToSignature()
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <div className="spinner" />
        <p style={{ marginTop: 12, color: '#9ba3b5', fontSize: 14 }}>Loading proposal...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <h2 style={{ color: '#1e2c55', marginBottom: 8 }}>Proposal Not Found</h2>
        <p style={{ color: '#9ba3b5' }}>This proposal link may be invalid or expired. Please check your email for the correct link.</p>
      </div>
    )
  }

  const isConfigured = !!(proposal.tier || proposal.selected_tier)
  const isSigned = proposal.status === 'signed' || proposal.status === 'signed_pay_later'
  const isPayLater = proposal.status === 'signed_pay_later'
  const isPaid = proposal.payment_status === 'paid'
  const depositPaid = !!proposal.deposit_paid
  const hasPrice = proposal.total_price != null && Number(proposal.total_price) > 0
  const needsConfiguration = proposal.let_client_choose && !isConfigured
  const selectedTier = proposal.selected_tier || proposal.tier
  const totalPrice = Number(proposal.total_price) || (selectedTier ? FIXED_PRICES[selectedTier] : 0)
  const balanceAfterDeposit = totalPrice - 100
  const proposalDate = proposal.created_at
    ? new Date(proposal.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const trainingWeeks = getTrainingWeeks()
  const canSign = paymentPath === 'pay_now' || (paymentPath === 'pay_later' && requestedTrainingWeek)

  return (
    <div className="container">
      {/* LOGO */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <img src="/roof-mri-logo.png" alt="Roof MRI" className="proposal-logo" />
      </div>

      {/* HEADER */}
      <div className="proposal-header-v2">
        <div className="ph2-accent"></div>
        <div className="ph2-content">
          <span className="ph2-type">Certification Training Proposal</span>
          <h2 className="ph2-company">{proposal.company}</h2>
          <div className="ph2-details">
            <div className="ph2-detail">
              <span className="ph2-detail-label">Date</span>
              <span className="ph2-detail-value">{proposalDate}</span>
            </div>
            {proposal.proposal_num && (
              <div className="ph2-detail">
                <span className="ph2-detail-label">Proposal #</span>
                <span className="ph2-detail-value">{proposal.proposal_num}</span>
              </div>
            )}
            {proposal.contact_name && (
              <div className="ph2-detail">
                <span className="ph2-detail-label">Attention</span>
                <span className="ph2-detail-value">{proposal.contact_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* INTRO */}
      <div className="proposal-intro">
        <span className="intro-label">Roof MRI Certification</span>
        <h1>Training Packages</h1>
        <p>
          Everything <span className="client-name">{proposal.company}</span> needs to add moisture scanning as a certified service line. Choose the package that fits your operation.
        </p>
      </div>

      {/* TIER CARDS */}
      {!isSigned && !isPaid && (
        <>
          <div className="tier-grid">
            {['professional', 'regional', 'enterprise'].map((key) => {
              const isHighlight = key === 'regional'
              return (
                <div key={key} className={`tier-card ${isHighlight ? 'highlight' : ''}`}>
                  {isHighlight && <div className="glow"></div>}
                  {isHighlight && (
                    <div className="best-value-banner"><span>Best Value</span></div>
                  )}
                  <div className="tier-inner" style={isHighlight ? { marginTop: 12 } : {}}>
                    <div className="tier-top">
                      <span className="tier-name">{TIER_NAMES[key]}</span>
                      <span className="tier-days">{TIER_DAYS[key]}</span>
                    </div>
                    <div className="tier-price-row">
                      <span className="tier-price">{TIER_PRICES_DISPLAY[key]}</span>
                      <span className="tier-price-sub">one-time</span>
                    </div>
                    <p className="tier-desc">{TIER_DESCS[key]}</p>
                    <div className="tier-highlights">
                      {TIER_HIGHLIGHTS[key].map((h, i) => (
                        <div className="tier-highlight" key={i}>
                          <ChkSvg />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {needsConfiguration && (
            <div className="cta-section">
              <button className="cta-btn" onClick={() => setShowConfigurator(true)} type="button">
                Build Your Training Package
              </button>
              <p className="cta-sub">Select your tier in under a minute.</p>
            </div>
          )}

          <ComparisonTable />

          {/* PACKAGE SUMMARY */}
          {isConfigured && selectedTier && (
            <div className="package-summary visible" id="packageSummary">
              <div className="pkg-sum-header">
                <div className="pkg-sum-header-left">
                  <span className="pkg-label">Selected Package</span>
                  <span className="pkg-tier-name">{TIER_NAMES[selectedTier]}</span>
                </div>
                <div className="pkg-total">{fmt(totalPrice)}</div>
              </div>
              <div className="pkg-sum-footer">
                {proposal.let_client_choose && (
                  <button className="edit-btn" onClick={() => setShowConfigurator(true)} type="button">Edit Selection</button>
                )}
                <span className="total-label">Total: {fmt(totalPrice)}</span>
              </div>
            </div>
          )}

          <TermsAccordion companyName={proposal.company} />

          {/* PAYMENT PATH SELECTOR */}
          {isConfigured && !isSigned && (
            <div style={{ maxWidth: 560, margin: '32px auto' }}>
              <h3 style={{ textAlign: 'center', color: '#1B2A4A', marginBottom: 20, fontSize: '1.15rem' }}>
                How would you like to proceed?
              </h3>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div
                  onClick={() => { setPaymentPath('pay_now'); setRequestedTrainingWeek('') }}
                  style={{
                    flex: '1 1 220px',
                    maxWidth: 260,
                    border: paymentPath === 'pay_now' ? '2px solid #00bd70' : '2px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '24px 20px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: paymentPath === 'pay_now' ? '#f0fdf4' : '#fff',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4A', marginBottom: 4 }}>
                    Pay Now
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Pay the full amount today and request any training week.
                  </div>
                </div>
                <div
                  onClick={() => setPaymentPath('pay_later')}
                  style={{
                    flex: '1 1 220px',
                    maxWidth: 260,
                    border: paymentPath === 'pay_later' ? '2px solid #00bd70' : '2px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '24px 20px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: paymentPath === 'pay_later' ? '#f0fdf4' : '#fff',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4A', marginBottom: 4 }}>
                    Sign Now. Pay Later.
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
                    ($100 deposit required)
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 6 }}>
                    Sign today, pay the balance within 2 weeks. Pick a training week 6+ weeks out.
                  </div>
                </div>
              </div>

              {/* Training week picker for pay_later */}
              {paymentPath === 'pay_later' && (
                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#1B2A4A', marginBottom: 8 }}>
                    Requested Training Week
                  </label>
                  <select
                    value={requestedTrainingWeek}
                    onChange={(e) => setRequestedTrainingWeek(e.target.value)}
                    style={{
                      width: '100%',
                      maxWidth: 360,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      color: '#1B2A4A',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select a week...</option>
                    {trainingWeeks.map((w) => (
                      <option key={w} value={w}>{formatWeekLabel(w)}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 6 }}>
                    This is a requested week, not a guaranteed date. We will do our best to accommodate your preference.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SIGNATURE BLOCK */}
          <div ref={signatureRef}>
            {signError && (
              <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{signError}</p>
            )}
            {isConfigured && canSign && (
              <SignaturePad
                onSign={handleSign}
                companyName={proposal.company}
                disabled={isSigned}
              />
            )}
            {isConfigured && !canSign && paymentPath === 'pay_later' && (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: 20 }}>
                Please select a requested training week above to proceed.
              </p>
            )}
          </div>
        </>
      )}

      {/* PAYMENT SUCCESS */}
      {isPaid && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="signed-badge visible" style={{ display: 'inline-flex', marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00a35f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <div className="signed-text" style={{ fontSize: '1.1rem' }}>Payment Received</div>
              <div className="signed-detail">Thank you! Your payment has been processed successfully.</div>
            </div>
          </div>
          <p style={{ color: '#5a6377', fontSize: '0.9rem' }}>We{'’'}ll be in touch shortly to get your training scheduled.</p>
        </div>
      )}

      {/* Checking payment spinner */}
      {checkingPayment && !isPaid && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="spinner" />
          <p style={{ marginTop: 12, color: '#9ba3b5', fontSize: 14 }}>Confirming your payment...</p>
        </div>
      )}

      {/* Checking deposit spinner */}
      {checkingDeposit && !depositPaid && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="spinner" />
          <p style={{ marginTop: 12, color: '#9ba3b5', fontSize: 14 }}>Confirming your deposit...</p>
        </div>
      )}

      {/* SIGNED — PAY NOW PATH */}
      {isSigned && !isPayLater && !isPaid && !checkingPayment && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="signed-badge visible" style={{ display: 'inline-flex', marginBottom: 20 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00a35f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <div className="signed-text" style={{ fontSize: '1.1rem' }}>
                {justSigned ? 'Proposal Signed!' : 'Proposal Signed'}
              </div>
              <div className="signed-detail">
                Signed by {proposal.signature_name}
                {proposal.signed_at && ` on ${new Date(proposal.signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
              </div>
            </div>
          </div>
          {hasPrice && (
            <>
              {signError && (
                <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{signError}</p>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="cta-btn" onClick={() => handlePayFull('card')} type="button" style={{ fontSize: '1rem' }}>
                  Pay by Card — {fmt(totalPrice)}
                </button>
                <button
                  className="cta-btn"
                  onClick={() => handlePayFull('ach')}
                  type="button"
                  style={{ fontSize: '1rem', background: '#1B2A4A' }}
                >
                  Pay by ACH — {fmt(totalPrice)}
                </button>
              </div>
              <p style={{ color: '#9ba3b5', fontSize: 12, marginTop: 10 }}>
                Secure payment powered by Stripe
              </p>
            </>
          )}
        </div>
      )}

      {/* SIGNED — PAY LATER PATH */}
      {isPayLater && !isPaid && !checkingPayment && !checkingDeposit && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="signed-badge visible" style={{ display: 'inline-flex', marginBottom: 20 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00a35f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <div className="signed-text" style={{ fontSize: '1.1rem' }}>
                {justSigned ? 'Proposal Signed!' : 'Proposal Signed'}
              </div>
              <div className="signed-detail">
                Signed by {proposal.signature_name}
                {proposal.signed_at && ` on ${new Date(proposal.signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
              </div>
            </div>
          </div>

          {proposal.requested_training_week && (
            <p style={{ color: '#1B2A4A', fontSize: '0.9rem', marginBottom: 16 }}>
              Requested training week: <strong>{formatWeekLabel(proposal.requested_training_week)}</strong>
            </p>
          )}

          {signError && (
            <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{signError}</p>
          )}

          {/* Deposit not yet paid */}
          {!depositPaid && (
            <div>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 16 }}>
                A $100 deposit is required to confirm your training week request.
              </p>
              <button className="cta-btn" onClick={handleDeposit} type="button" style={{ fontSize: '1rem' }}>
                Pay $100 Deposit
              </button>
              <p style={{ color: '#9ba3b5', fontSize: 12, marginTop: 10 }}>
                Secure payment powered by Stripe
              </p>
            </div>
          )}

          {/* Deposit paid, balance remaining */}
          {depositPaid && (
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '8px 16px',
                marginBottom: 20,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00a35f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: '#166534', fontSize: '0.85rem', fontWeight: 600 }}>$100 Deposit Paid</span>
              </div>
              {proposal.payment_due_date && (
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 16 }}>
                  Balance of {fmt(balanceAfterDeposit)} due by{' '}
                  <strong>{new Date(proposal.payment_due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="cta-btn" onClick={() => handlePayFull('card')} type="button" style={{ fontSize: '1rem' }}>
                  Pay Balance by Card — {fmt(balanceAfterDeposit)}
                </button>
                <button
                  className="cta-btn"
                  onClick={() => handlePayFull('ach')}
                  type="button"
                  style={{ fontSize: '1rem', background: '#1B2A4A' }}
                >
                  Pay Balance by ACH — {fmt(balanceAfterDeposit)}
                </button>
              </div>
              <p style={{ color: '#9ba3b5', fontSize: 12, marginTop: 10 }}>
                Secure payment powered by Stripe
              </p>
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div className="proposal-footer">
        <div className="footer-brand">Roof MRI</div>
        <p>A ReDry LLC Certification Program</p>
        <p>Every package can be customized. Enterprise packages are fully custom and built through a consultation.</p>
      </div>

      {/* FLOATING ACTION BUTTON */}
      {fabMode !== 'hidden' && !isSigned && !isPaid && (
        <button className="floating-sign-btn" onClick={floatingAction} type="button">
          {fabMode === 'build' ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
              <span>Build Your Package</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
              </svg>
              <span>Sign Now</span>
            </>
          )}
        </button>
      )}

      {/* Configurator Modal */}
      {showConfigurator && (
        <Configurator
          onConfirm={handleConfigure}
          onClose={() => setShowConfigurator(false)}
          submitting={configuring}
        />
      )}
    </div>
  )
}
