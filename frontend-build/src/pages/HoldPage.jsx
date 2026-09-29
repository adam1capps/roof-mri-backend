import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import TermsAccordion from '../components/TermsAccordion'
import SignaturePad from '../components/SignaturePad'
import { DEPOSIT_AMOUNT, getTrainingWeeks, trainingWindowEnd, formatWeekLabel, formatDate } from '../lib/training'

const API = import.meta.env.VITE_API_URL || ''

const TIER_NAMES = { professional: 'Professional', regional: 'Regional', enterprise: 'Enterprise' }
const FALLBACK_PRICES = { professional: 12500, regional: 35000, enterprise: 75000 }
const NAVY = '#1B2A4A'

function fmt(n) { return '$' + Number(n).toLocaleString('en-US') }

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00a35f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function HoldPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const depositParam = searchParams.get('deposit')

  const [proposal, setProposal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [week, setWeek] = useState('')
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [confirming, setConfirming] = useState(depositParam === 'success')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/proposals/${id}`)
        if (!res.ok) throw new Error(res.status === 404 ? 'not_found' : 'failed')
        setProposal(await res.json())
      } catch (err) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // After Stripe sends them back, wait for the webhook to record the deposit
  useEffect(() => {
    if (depositParam !== 'success') return
    let cancelled = false
    async function poll() {
      for (let i = 0; i < 15; i++) {
        if (cancelled) return
        try {
          const res = await fetch(`${API}/api/proposals/${id}/payment-status`)
          const data = await res.json()
          if (data.deposit_paid) {
            setProposal(prev => prev ? { ...prev, ...data } : prev)
            break
          }
        } catch { /* retry */ }
        await new Promise(r => setTimeout(r, 2000))
      }
      if (!cancelled) setConfirming(false)
    }
    poll()
    return () => { cancelled = true }
  }, [depositParam, id])

  async function startDeposit() {
    setRedirecting(true)
    const res = await fetch(`${API}/api/proposals/${id}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnTo: 'hold' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.checkoutUrl) {
      setRedirecting(false)
      throw new Error(data.error || 'Could not start the deposit payment')
    }
    window.location.href = data.checkoutUrl
  }

  async function payDepositOnly() {
    setError(null)
    try {
      await startDeposit()
    } catch (err) {
      setError(err.message)
    }
  }

  // Sign (Sign Now, Pay Later) and go straight to the deposit checkout
  async function handleSign(signatureName, signatureData) {
    setError(null)
    try {
      if (!week) throw new Error('Please choose a requested training week above.')

      // Client-choice proposals: this page holds the Professional package
      if (!proposal.tier && !proposal.selected_tier) {
        const cfg = await fetch(`${API}/api/proposals/${id}/configure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: 'professional' }),
        })
        if (!cfg.ok) {
          const data = await cfg.json().catch(() => ({}))
          throw new Error(data.error || 'Could not select the Professional package')
        }
      }

      const res = await fetch(`${API}/api/proposals/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureName, signatureData, paymentPath: 'pay_later', requestedTrainingWeek: week }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not sign the agreement')
      }
      setProposal(prev => ({ ...prev, status: 'signed_pay_later', requested_training_week: week, signature_name: signatureName }))
      await startDeposit()
    } catch (err) {
      setError(err.message)
      throw err // lets SignaturePad show its own error state
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <div className="spinner" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <h2 style={{ color: NAVY, marginBottom: 8 }}>Proposal Not Found</h2>
        <p style={{ color: '#64748b' }}>This link may be invalid or expired. Please check your email or reply to Adam for a fresh link.</p>
      </div>
    )
  }

  const tier = proposal.selected_tier || proposal.tier || 'professional'
  const tierPrices = {
    professional: Number(proposal.professional_price) || FALLBACK_PRICES.professional,
    regional: Number(proposal.regional_price) || FALLBACK_PRICES.regional,
    enterprise: Number(proposal.enterprise_price) || FALLBACK_PRICES.enterprise,
  }
  const price = (proposal.tier || proposal.selected_tier) && Number(proposal.total_price)
    ? Number(proposal.total_price)
    : tierPrices[tier]
  const isLocked = tier === 'professional' && price < FALLBACK_PRICES.professional
  const weeks = getTrainingWeeks()

  const isPaid = proposal.payment_status === 'paid'
  const isPayLater = proposal.status === 'signed_pay_later'
  const signedPayNow = proposal.status === 'signed'
  const depositPaid = !!proposal.deposit_paid
  const proposalLink = `/p/${id}`

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <img src="/roof-mri-logo.png" alt="Roof MRI" className="proposal-logo" />
      </div>

      {/* Header */}
      <div style={{ background: NAVY, color: '#fff', borderRadius: 10, padding: '28px 24px', textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#cbd5e1', fontWeight: 700 }}>
          Hold My Training Price
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '10px 0 4px', color: '#fff' }}>{proposal.company}</h1>
        <div style={{ fontSize: 15, color: '#cbd5e1' }}>
          {TIER_NAMES[tier]} package · <strong style={{ color: '#fff' }}>{fmt(price)}</strong>
          {isLocked && <> <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{fmt(FALLBACK_PRICES.professional)}</span></>}
        </div>
      </div>

      {/* Waiting for Stripe confirmation */}
      {confirming && !depositPaid && (
        <div className="card" style={{ borderRadius: 10, textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 12, color: '#64748b' }}>Confirming your deposit…</p>
        </div>
      )}

      {/* Paid in full */}
      {!confirming && isPaid && (
        <div className="card" style={{ borderRadius: 10, textAlign: 'center' }}>
          <h2 style={{ color: NAVY, marginBottom: 8 }}>You{'’'}re all set</h2>
          <p style={{ color: '#475569' }}>Your training is paid in full. We{'’'}ll be in touch to confirm your dates.</p>
        </div>
      )}

      {/* Price held */}
      {!confirming && !isPaid && isPayLater && depositPaid && (
        <div className="card" style={{ borderRadius: 10 }}>
          <h2 style={{ color: NAVY, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check /> Your price is held
          </h2>
          <p style={{ color: '#475569', lineHeight: 1.7, marginBottom: 12 }}>
            Thank you! Your {fmt(DEPOSIT_AMOUNT)} deposit is in and your {fmt(price)} price is locked.
          </p>
          <ul style={{ color: '#475569', lineHeight: 1.9, paddingLeft: 20, marginBottom: 16 }}>
            {proposal.requested_training_week && (
              <li>Requested training: <strong style={{ color: NAVY }}>{formatWeekLabel(proposal.requested_training_week)}</strong></li>
            )}
            <li>Remaining balance: <strong style={{ color: NAVY }}>{fmt(price - DEPOSIT_AMOUNT)}</strong>
              {proposal.payment_due_date && <>, due by <strong style={{ color: NAVY }}>{formatDate(proposal.payment_due_date)}</strong></>}
            </li>
          </ul>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
            We{'’'}ll reach out to confirm your training dates. Your requested week is a request, and we{'’'}ll do our best to accommodate it.
          </p>
          <Link to={proposalLink} className="btn-small">View your proposal</Link>
        </div>
      )}

      {/* Signed pay-later, deposit still owed (e.g. they left Stripe early) */}
      {!confirming && !isPaid && isPayLater && !depositPaid && (
        <div className="card" style={{ borderRadius: 10, textAlign: 'center' }}>
          <h2 style={{ color: NAVY, marginBottom: 8 }}>One step left</h2>
          <p style={{ color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
            Your agreement is signed. Pay the {fmt(DEPOSIT_AMOUNT)} non-refundable deposit to hold your {fmt(price)} price.
            {depositParam === 'cancelled' && ' (The payment window was closed before it finished.)'}
          </p>
          {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{error}</p>}
          <button type="button" className="cta-btn" onClick={payDepositOnly} disabled={redirecting} style={{ background: NAVY }}>
            {redirecting ? 'Opening secure checkout…' : `Pay ${fmt(DEPOSIT_AMOUNT)} Deposit`}
          </button>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>Secure payment by Stripe</p>
        </div>
      )}

      {/* Already signed on the pay-now path */}
      {!confirming && !isPaid && signedPayNow && (
        <div className="card" style={{ borderRadius: 10, textAlign: 'center' }}>
          <h2 style={{ color: NAVY, marginBottom: 8 }}>Your proposal is already signed</h2>
          <p style={{ color: '#475569', marginBottom: 16 }}>You can complete payment from your proposal.</p>
          <Link to={proposalLink} className="cta-btn" style={{ background: NAVY, textDecoration: 'none' }}>Go to my proposal</Link>
        </div>
      )}

      {/* Main flow: unsigned */}
      {!confirming && !isPaid && !isPayLater && !signedPayNow && (
        <>
          <div className="card" style={{ borderRadius: 10, marginBottom: 20 }}>
            <h2 style={{ color: NAVY, fontSize: '1.15rem', marginBottom: 12 }}>How it works</h2>
            <ol style={{ color: '#475569', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
              <li>Pick the week you{'’'}d like to train, any time through <strong style={{ color: NAVY }}>{formatDate(trainingWindowEnd())}</strong>.</li>
              <li>Sign the training agreement below.</li>
              <li>Pay a <strong style={{ color: NAVY }}>{fmt(DEPOSIT_AMOUNT)} non-refundable deposit</strong>. It goes toward your {fmt(price)} total.</li>
              <li>The remaining <strong style={{ color: NAVY }}>{fmt(price - DEPOSIT_AMOUNT)}</strong> is due two weeks before your training week.</li>
            </ol>
          </div>

          <div className="card" style={{ borderRadius: 10, marginBottom: 20 }}>
            <label htmlFor="week" style={{ display: 'block', fontWeight: 700, color: NAVY, marginBottom: 8 }}>
              Requested training week
            </label>
            <select
              id="week"
              value={week}
              onChange={e => setWeek(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 16, color: NAVY, background: '#fff' }}
            >
              <option value="">Choose a week…</option>
              {weeks.map(w => <option key={w} value={w}>{formatWeekLabel(w)}</option>)}
            </select>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
              This is a request, not a guaranteed date. We{'’'}ll confirm with you and do our best to accommodate it.
            </p>
          </div>

          <TermsAccordion companyName={proposal.company} />

          {week ? (
            <>
              {error && <p style={{ color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
              <SignaturePad onSign={handleSign} companyName={proposal.company} disabled={redirecting} />
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 12 }}>
                {redirecting
                  ? 'Opening secure checkout…'
                  : `After you sign, you'll pay the ${fmt(DEPOSIT_AMOUNT)} non-refundable deposit on Stripe's secure checkout.`}
              </p>
            </>
          ) : (
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: 14, margin: '24px 0' }}>
              Choose a training week above to sign and hold your price.
            </p>
          )}
        </>
      )}

      <p style={{ textAlign: 'center', fontSize: 14, color: '#64748b', margin: '32px 0 8px' }}>
        Ready to schedule training for this fall or winter?{' '}
        <Link to={proposalLink} style={{ color: NAVY, fontWeight: 600 }}>Go to your full proposal</Link>
      </p>
      <div className="proposal-footer">
        <p>Questions? Reply to your proposal email or write to adam@re-dry.com.</p>
      </div>
    </div>
  )
}
