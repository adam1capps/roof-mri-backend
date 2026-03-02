import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Configurator from '../components/Configurator'
import ComparisonTable from '../components/ComparisonTable'
import TermsAccordion from '../components/TermsAccordion'
import SignaturePad from '../components/SignaturePad'

const API = import.meta.env.VITE_API_URL || ''

const TIER_NAMES = { professional: 'Professional', regional: 'Regional', enterprise: 'Enterprise' }
const TIER_TRAINEES = { professional: 3, regional: 10, enterprise: 25 }
const TIER_KITS = { professional: 1, regional: 2, enterprise: 4 }
const TIER_DAYS = { professional: '1 Day', regional: '2 Days', enterprise: '4 Days' }
const TIER_PRICES_DISPLAY = { professional: '$10K', regional: '$35K', enterprise: '$75K+' }
const TIER_PRICE_SUB = { professional: 'one-time', regional: 'one-time', enterprise: 'custom engagement' }

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
  const [packageSummary, setPackageSummary] = useState(null) // stored after configurator confirms
  const [fabMode, setFabMode] = useState('build') // 'build' | 'sign' | 'hidden'
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
        // If already configured, show sign mode
        if (data.tier || data.selected_tier) {
          setFabMode('sign')
          buildPackageSummary(data)
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
      for (let i = 0; i < 10; i++) {
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
      try {
        const res = await fetch(`${API}/api/proposals/${id}?track=false`)
        if (res.ok) { const data = await res.json(); setProposal(data) }
      } catch { /* give up */ }
      setCheckingPayment(false)
    }
    pollPayment()
    return () => { cancelled = true }
  }, [paymentParam, proposal?.id, id])

  function buildPackageSummary(p) {
    const t = p.selected_tier || p.tier
    if (!t) return
    const c = { professional: { baseTrainees: 3, baseKits: 1, baseTracks: 0, traineeRate: 2000, kitRate: 4000, trackRate: 5000, videoRate: 2000, onRoofRate: 5000 }, regional: { baseTrainees: 10, baseKits: 2, baseTracks: 2, traineeRate: 1600, kitRate: 4000, trackRate: 5000, videoRate: 0, onRoofRate: 5000 }, enterprise: { baseTrainees: 25, baseKits: 4, baseTracks: 4, traineeRate: 0, kitRate: 4000, trackRate: 0, videoRate: 0, onRoofRate: 0 } }[t]
    if (!c) return
    setPackageSummary({ tier: t, config: c, proposal: p })
  }

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
      setFabMode('sign')
      buildPackageSummary(updated)
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
    setProposal((prev) => ({ ...prev, status: 'signed', signature_name: signatureName }))
    setJustSigned(true)
    setFabMode('hidden')
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

  function floatingAction() {
    if (fabMode === 'build') setShowConfigurator(true)
    else if (fabMode === 'sign') scrollToSignature()
  }

  // LOADING
  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <div className="spinner" />
        <p style={{ marginTop: 12, color: '#9ba3b5', fontSize: 14 }}>Loading proposal...</p>
      </div>
    )
  }

  // ERROR
  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <h2 style={{ color: '#1e2c55', marginBottom: 8 }}>Proposal Not Found</h2>
        <p style={{ color: '#9ba3b5' }}>This proposal link may be invalid or expired. Please check your email for the correct link.</p>
      </div>
    )
  }

  // Derived state
  const isConfigured = !!(proposal.tier || proposal.selected_tier)
  const isSigned = proposal.status === 'signed'
  const isPaid = proposal.payment_status === 'paid'
  const hasPrice = proposal.total_price && Number(proposal.total_price) > 0
  const needsConfiguration = proposal.let_client_choose && !isConfigured
  const proposalDate = proposal.created_at
    ? new Date(proposal.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const tierPrices = {
    professional: proposal.professional_price,
    regional: proposal.regional_price,
    enterprise: proposal.enterprise_price,
  }

  return (
    <div className="container">
      {/* LOGO */}
      <div style={{ marginBottom: 32 }}>
        <div className="proposal-brand">
          <div className="brand-name">ROOF <span className="accent">MRI</span></div>
        </div>
      </div>

      {/* HEADER */}
      <div className="proposal-header">
        <div className="proposal-brand">
          <div className="brand-sub">Certification Training Proposal</div>
        </div>
        <div className="proposal-meta">
          <span className="meta-label">Prepared For</span>
          <span className="meta-value">{proposal.company}</span>
          <span className="meta-label">Date</span>
          <span className="meta-value">{proposalDate}</span>
          {proposal.proposal_num && (
            <>
              <span className="meta-label">Proposal #</span>
              <span className="meta-value">{proposal.proposal_num}</span>
            </>
          )}
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

      {/* ═══ TIER CARDS (always shown if not signed/paid) ═══ */}
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
                      <span className="tier-price-sub">{TIER_PRICE_SUB[key]}</span>
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

          {/* CTA */}
          {needsConfiguration && (
            <div className="cta-section">
              <button className="cta-btn" onClick={() => setShowConfigurator(true)} type="button">
                Build Your Training Package
              </button>
              <p className="cta-sub">Select your tier and customize your add-ons in under a minute.</p>
            </div>
          )}

          {/* COMPARISON TABLE */}
          <ComparisonTable />

          {/* PACKAGE SUMMARY (after configuration) */}
          {isConfigured && packageSummary && (
            <div className="package-summary visible" id="packageSummary">
              <div className="pkg-sum-header">
                <div className="pkg-sum-header-left">
                  <span className="pkg-label">Selected Package</span>
                  <span className="pkg-tier-name">{TIER_NAMES[packageSummary.tier]}</span>
                </div>
                <div className="pkg-total">{fmt(proposal.total_price)}</div>
              </div>
              <div className="pkg-sum-body">
                <div className="pkg-line-item">
                  <div><span className="line-label">{TIER_NAMES[packageSummary.tier]} Package (base)</span></div>
                  <span className="line-value">{fmt(tierPrices[packageSummary.tier] || packageSummary.config.base || proposal.total_price)}</span>
                </div>
                <div className="pkg-line-item">
                  <div>
                    <span className="line-label">Trainees</span>
                    <span className="line-detail">{packageSummary.config.baseTrainees} included{(proposal.extra_trainees || 0) > 0 ? ` + ${proposal.extra_trainees} additional` : ''}</span>
                  </div>
                  <span className="line-value">
                    {(proposal.extra_trainees || 0) > 0 && packageSummary.config.traineeRate > 0
                      ? fmt(proposal.extra_trainees * packageSummary.config.traineeRate)
                      : <span className="included">Included</span>}
                  </span>
                </div>
                <div className="pkg-line-item">
                  <div>
                    <span className="line-label">Recon Kits</span>
                    <span className="line-detail">{packageSummary.config.baseKits} included{(proposal.extra_kits || 0) > 0 ? ` + ${proposal.extra_kits} additional` : ''}</span>
                  </div>
                  <span className="line-value">
                    {(proposal.extra_kits || 0) > 0
                      ? fmt(proposal.extra_kits * packageSummary.config.kitRate)
                      : <span className="included">Included</span>}
                  </span>
                </div>
                {proposal.tracks && proposal.tracks.length > 0 && (
                  <div className="pkg-line-item">
                    <div>
                      <span className="line-label">Training Tracks</span>
                      <span className="line-detail">{proposal.tracks.join(', ')}</span>
                    </div>
                    <span className="line-value included">
                      {packageSummary.tier === 'enterprise' ? 'Included' : 'Selected'}
                    </span>
                  </div>
                )}
              </div>
              <div className="pkg-sum-footer">
                {proposal.let_client_choose && (
                  <button className="edit-btn" onClick={() => setShowConfigurator(true)} type="button">Edit Selection</button>
                )}
                <span className="total-label">Total: {fmt(proposal.total_price)}</span>
              </div>
            </div>
          )}

          {/* TERMS & CONDITIONS */}
          <TermsAccordion companyName={proposal.company} />

          {/* SIGNATURE BLOCK */}
          <div ref={signatureRef}>
            {signError && (
              <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{signError}</p>
            )}
            <SignaturePad
              onSign={handleSign}
              companyName={proposal.company}
              disabled={isSigned}
            />
          </div>
        </>
      )}

      {/* ═══ Payment Success ═══ */}
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
          <p style={{ color: '#5a6377', fontSize: '0.9rem' }}>We{'\u2019'}ll be in touch shortly to get your training scheduled.</p>
        </div>
      )}

      {/* Checking payment after Stripe redirect */}
      {checkingPayment && !isPaid && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="spinner" />
          <p style={{ marginTop: 12, color: '#9ba3b5', fontSize: 14 }}>Confirming your payment...</p>
        </div>
      )}

      {/* ═══ Signed confirmation + Pay Now ═══ */}
      {isSigned && !isPaid && !checkingPayment && (
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
              <div>
                <button className="cta-btn" onClick={handlePayNow} type="button" style={{ fontSize: '1rem' }}>
                  Pay Now {'\u2014'} {fmt(proposal.total_price)}
                </button>
                <p style={{ color: '#9ba3b5', fontSize: 12, marginTop: 10 }}>
                  Secure payment powered by Stripe
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div className="proposal-footer">
        <div className="footer-brand">Roof MRI</div>
        <p>A ReDry LLC Certification Program</p>
        <p>Every package can be customized. Enterprise packages are fully custom and built through a consultation.</p>
      </div>

      {/* ═══ FLOATING ACTION BUTTON ═══ */}
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
