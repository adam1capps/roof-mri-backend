import { useState } from 'react'

const FIXED_PRICES = { professional: 10000, regional: 35000, enterprise: 75000 }

const TIER_INFO = {
  professional: { name: 'Professional', desc: '1 day, up to 3 trainees, 1 Recon Kit' },
  regional: { name: 'Regional', desc: '2 days, up to 10 trainees, 2 Recon Kits, 2 tracks' },
  enterprise: { name: 'Enterprise', desc: '4 days, up to 25 trainees, 4 Recon Kits, all tracks' },
}

const TIER_DETAILS = {
  professional: [
    'Owner + 2 trainees',
    '1 Recon Kit included',
    'Classroom + field certification',
    'Monthly MRI Integrator calls (3)',
  ],
  regional: [
    'Up to 10 trainees, 2 Recon Kits',
    '2 dedicated track days included',
    'Professional videography included',
    'Biweekly MRI Integrator calls (6)',
  ],
  enterprise: [
    'Up to 25 trainees, 4 Recon Kits',
    'All 4 training tracks included',
    'On-roof training day included',
    'Weekly MRI Integrator calls (12)',
  ],
}

function fmt(n) { return '$' + n.toLocaleString('en-US') }

function ChkSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function Configurator({ onConfirm, onClose, submitting }) {
  const [tier, setTier] = useState(null)
  const [step, setStep] = useState('select')
  const [error, setError] = useState(null)

  const steps = tier ? 2 : 1
  const currentStep = step === 'select' ? 1 : 2
  const pct = Math.round((currentStep / steps) * 100)

  function selectTier(t) {
    setTier(t)
    setStep('summary')
  }

  function goBack() {
    setStep('select')
  }

  async function handleConfirm() {
    setError(null)
    try {
      await onConfirm({ tier })
    } catch (err) {
      setError(err.message || 'Failed to save configuration')
    }
  }

  return (
    <div className="config-overlay active" onClick={onClose}>
      <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <button className="config-close" onClick={onClose} type="button">{'✕'}</button>

        <div className="config-progress">
          <div className="config-progress-bar">
            <div className="config-progress-fill" style={{ width: `${pct}%` }}></div>
          </div>
          <span className="config-progress-text">Step {currentStep} of {steps}</span>
        </div>

        <div className="config-body">
          {error && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: 12 }}>{error}</div>}

          {step === 'select' && (
            <div className="config-step active">
              <h3>Choose Your Package</h3>
              <p className="step-desc">Select the training tier that best fits your team.</p>
              <div className="config-tier-grid">
                {Object.entries(TIER_INFO).map(([key, tc]) => (
                  <div
                    key={key}
                    className={`config-tier-card ${tier === key ? 'selected' : ''}`}
                    onClick={() => selectTier(key)}
                  >
                    <div className="config-tier-left">
                      <span className="ctier-name">{tc.name}</span>
                      <span className="ctier-desc">{tc.desc}</span>
                    </div>
                    <span className="config-tier-right">{fmt(FIXED_PRICES[key])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'summary' && tier && (
            <div className="config-step active">
              <h3>Your Training Package</h3>
              <p className="step-desc">Review your selection below.</p>
              <div className="config-summary-items">
                <div className="config-sum-line">
                  <span className="csl-label">{TIER_INFO[tier].name} Package</span>
                  <span className="csl-value">{fmt(FIXED_PRICES[tier])}</span>
                </div>
                {TIER_DETAILS[tier].map((detail, i) => (
                  <div className="config-sum-line" key={i}>
                    <span className="csl-label">{detail}</span>
                    <span className="csl-value green">Included</span>
                  </div>
                ))}
                <div className="config-sum-line total-line">
                  <span className="csl-label">Total Investment</span>
                  <span className="csl-value">{fmt(FIXED_PRICES[tier])}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="config-nav">
          <div className="config-nav-left">
            {step === 'summary' && (
              <button className="nav-back" onClick={goBack} type="button">{'←'} Back</button>
            )}
          </div>
          {step === 'summary' ? (
            <button
              className="nav-next"
              onClick={handleConfirm}
              disabled={submitting}
              type="button"
            >
              {submitting ? 'Confirming...' : 'Confirm Selection'}
            </button>
          ) : (
            <span></span>
          )}
        </div>
      </div>
    </div>
  )
}
