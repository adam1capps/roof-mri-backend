import { useState } from 'react'

const TIER_CONFIG = {
  professional: {
    name: 'Professional',
    baseTrainees: 3,
    baseKits: 1,
    baseTracks: 0,
    traineeRate: 2000,
    kitRate: 4000,
    trackRate: 5000,
    videoRate: 2000,
    onRoofRate: 5000,
    desc: 'Ideal for small teams getting started with moisture scanning.',
  },
  regional: {
    name: 'Regional',
    baseTrainees: 10,
    baseKits: 2,
    baseTracks: 2,
    traineeRate: 1600,
    kitRate: 4000,
    trackRate: 5000,
    videoRate: 0,
    onRoofRate: 5000,
    desc: 'Built for companies covering a multi-city or statewide territory.',
  },
  enterprise: {
    name: 'Enterprise',
    baseTrainees: 25,
    baseKits: 4,
    baseTracks: 4,
    traineeRate: 0,
    kitRate: 4000,
    trackRate: 0,
    videoRate: 0,
    onRoofRate: 0,
    desc: 'Full-scale deployment for large organizations with multiple crews.',
  },
}

const TRACK_OPTIONS = ['Sales', 'Service', 'Production', 'Marketing']
const STEP_LABELS = ['Package', 'Team', 'Equipment', 'Tracks', 'Add-Ons', 'Review']

function formatCurrency(n) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function Configurator({ prices, onConfirm, onClose, submitting }) {
  const [step, setStep] = useState(0)
  const [tier, setTier] = useState(null)
  const [extraTrainees, setExtraTrainees] = useState(0)
  const [extraKits, setExtraKits] = useState(0)
  const [tracks, setTracks] = useState([])
  const [videography, setVideography] = useState(false)
  const [onRoofDay, setOnRoofDay] = useState(false)
  const [error, setError] = useState(null)

  const config = tier ? TIER_CONFIG[tier] : null
  const basePrice = tier ? (Number(prices[tier]) || 0) : 0

  // Calculate running total
  let total = basePrice
  if (config) {
    total += extraTrainees * config.traineeRate
    total += extraKits * config.kitRate
    const extraTrackCount = Math.max(0, tracks.length - config.baseTracks)
    total += extraTrackCount * config.trackRate
    total += videography ? config.videoRate : 0
    total += onRoofDay ? config.onRoofRate : 0
  }

  function toggleTrack(track) {
    setTracks(prev =>
      prev.includes(track) ? prev.filter(t => t !== track) : [...prev, track]
    )
  }

  function canGoNext() {
    if (step === 0) return !!tier
    return true
  }

  function handleNext() {
    if (step < STEP_LABELS.length - 1) setStep(step + 1)
  }

  function handleBack() {
    if (step > 0) setStep(step - 1)
  }

  async function handleConfirm() {
    setError(null)
    try {
      await onConfirm({
        tier,
        extraTrainees,
        extraKits,
        tracks,
        videography,
        onRoofDay,
      })
    } catch (err) {
      setError(err.message || 'Failed to save configuration')
    }
  }

  // Determine which tracks are "included" vs "extra"
  const includedTrackCount = config ? config.baseTracks : 0

  return (
    <div className="cfg-overlay" onClick={onClose}>
      <div className="cfg-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cfg-header">
          <h2>Build Your Package</h2>
          <button className="cfg-close" onClick={onClose} type="button" aria-label="Close">&times;</button>
        </div>

        {/* Progress */}
        <div className="cfg-progress">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className={`cfg-step-dot ${i <= step ? 'active' : ''} ${i === step ? 'current' : ''}`}>
              <span className="cfg-dot">{i < step ? '\u2713' : i + 1}</span>
              <span className="cfg-step-label">{label}</span>
            </div>
          ))}
          <div className="cfg-progress-bar">
            <div className="cfg-progress-fill" style={{ width: `${(step / (STEP_LABELS.length - 1)) * 100}%` }} />
          </div>
        </div>

        {/* Step content */}
        <div className="cfg-body">
          {error && <div className="cfg-error">{error}</div>}

          {/* Step 0: Choose Tier */}
          {step === 0 && (
            <div className="cfg-step">
              <h3>Choose Your Training Package</h3>
              <p className="cfg-step-desc">Select the package that best fits your team size and territory.</p>
              <div className="cfg-tier-grid">
                {Object.entries(TIER_CONFIG).map(([key, t]) => {
                  const price = prices[key]
                  const hasPrice = price && Number(price) > 0
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`cfg-tier-card ${tier === key ? 'selected' : ''} ${key === 'regional' ? 'popular' : ''}`}
                      onClick={() => {
                        setTier(key)
                        // Reset add-ons when switching tier
                        setExtraTrainees(0)
                        setExtraKits(0)
                        setTracks([])
                        setVideography(false)
                        setOnRoofDay(false)
                      }}
                      disabled={!hasPrice}
                    >
                      {key === 'regional' && <span className="cfg-popular-badge">Most Popular</span>}
                      <span className="cfg-tier-name">{t.name}</span>
                      <span className="cfg-tier-meta">{t.baseTrainees} trainees &middot; {t.baseKits} kit{t.baseKits > 1 ? 's' : ''}</span>
                      {hasPrice && <span className="cfg-tier-price">{formatCurrency(price)}</span>}
                      {!hasPrice && <span className="cfg-tier-price cfg-muted">Contact for pricing</span>}
                      <span className="cfg-tier-desc">{t.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 1: Extra Trainees */}
          {step === 1 && config && (
            <div className="cfg-step">
              <h3>Team Size</h3>
              <p className="cfg-step-desc">
                Your {config.name} package includes <strong>{config.baseTrainees} certified trainees</strong>.
                {config.traineeRate > 0
                  ? ` Need more? Add additional trainees at ${formatCurrency(config.traineeRate)} each.`
                  : ' Additional trainees are included at no extra cost.'}
              </p>
              <div className="cfg-counter">
                <span className="cfg-counter-label">Additional Trainees</span>
                <div className="cfg-counter-controls">
                  <button type="button" onClick={() => setExtraTrainees(Math.max(0, extraTrainees - 1))} disabled={extraTrainees === 0}>&minus;</button>
                  <span className="cfg-counter-value">{extraTrainees}</span>
                  <button type="button" onClick={() => setExtraTrainees(extraTrainees + 1)}>+</button>
                </div>
                {config.traineeRate > 0 && extraTrainees > 0 && (
                  <span className="cfg-counter-cost">+{formatCurrency(extraTrainees * config.traineeRate)}</span>
                )}
                {config.traineeRate === 0 && (
                  <span className="cfg-counter-included">Included with {config.name}</span>
                )}
              </div>
              <div className="cfg-total-trainees">
                Total trainees: <strong>{config.baseTrainees + extraTrainees}</strong>
              </div>
            </div>
          )}

          {/* Step 2: Extra Kits */}
          {step === 2 && config && (
            <div className="cfg-step">
              <h3>Equipment</h3>
              <p className="cfg-step-desc">
                Your {config.name} package includes <strong>{config.baseKits} Recon Kit{config.baseKits > 1 ? 's' : ''}</strong> (Tramex equipment).
                Additional kits are {formatCurrency(config.kitRate)} each.
              </p>
              <div className="cfg-counter">
                <span className="cfg-counter-label">Additional Recon Kits</span>
                <div className="cfg-counter-controls">
                  <button type="button" onClick={() => setExtraKits(Math.max(0, extraKits - 1))} disabled={extraKits === 0}>&minus;</button>
                  <span className="cfg-counter-value">{extraKits}</span>
                  <button type="button" onClick={() => setExtraKits(extraKits + 1)}>+</button>
                </div>
                {extraKits > 0 && (
                  <span className="cfg-counter-cost">+{formatCurrency(extraKits * config.kitRate)}</span>
                )}
              </div>
              <div className="cfg-total-trainees">
                Total kits: <strong>{config.baseKits + extraKits}</strong>
              </div>
            </div>
          )}

          {/* Step 3: Training Tracks */}
          {step === 3 && config && (
            <div className="cfg-step">
              <h3>Training Tracks</h3>
              <p className="cfg-step-desc">
                {includedTrackCount > 0
                  ? `Your ${config.name} package includes ${includedTrackCount} training track${includedTrackCount > 1 ? 's' : ''}.`
                  : 'Add specialized training tracks to your package.'}
                {config.trackRate > 0 && includedTrackCount > 0 && ` Additional tracks are ${formatCurrency(config.trackRate)} each.`}
                {config.trackRate > 0 && includedTrackCount === 0 && ` Each track is ${formatCurrency(config.trackRate)}.`}
                {config.trackRate === 0 && ' All tracks are included at no extra cost.'}
              </p>
              <div className="cfg-track-grid">
                {TRACK_OPTIONS.map(track => {
                  const isSelected = tracks.includes(track)
                  const trackIndex = tracks.indexOf(track)
                  const isIncluded = config.trackRate === 0 || trackIndex < includedTrackCount
                  return (
                    <button
                      key={track}
                      type="button"
                      className={`cfg-track-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleTrack(track)}
                    >
                      <span className="cfg-track-check">{isSelected ? '\u2713' : ''}</span>
                      <span className="cfg-track-name">{track}</span>
                      {isSelected && isIncluded && <span className="cfg-track-tag">Included</span>}
                      {isSelected && !isIncluded && <span className="cfg-track-tag extra">+{formatCurrency(config.trackRate)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4: Add-ons (Videography + On-Roof Day) */}
          {step === 4 && config && (
            <div className="cfg-step">
              <h3>Add-Ons</h3>
              <p className="cfg-step-desc">Enhance your training experience with these optional add-ons.</p>

              <div className="cfg-addon">
                <div className="cfg-addon-info">
                  <strong>Professional Videography</strong>
                  <p>Document your team&apos;s training with professional video production for marketing and internal use.</p>
                </div>
                <div className="cfg-addon-action">
                  {config.videoRate > 0 ? (
                    <span className="cfg-addon-price">{formatCurrency(config.videoRate)}</span>
                  ) : (
                    <span className="cfg-addon-included">Included</span>
                  )}
                  <button
                    type="button"
                    className={`cfg-toggle ${videography ? 'on' : ''} ${config.videoRate === 0 ? 'always-on' : ''}`}
                    onClick={() => config.videoRate > 0 && setVideography(!videography)}
                    disabled={config.videoRate === 0}
                  >
                    <span className="cfg-toggle-slider" />
                  </button>
                </div>
              </div>

              <div className="cfg-addon">
                <div className="cfg-addon-info">
                  <strong>On-Roof Training Day</strong>
                  <p>Additional hands-on training day on a live commercial roof with real-world scanning scenarios.</p>
                </div>
                <div className="cfg-addon-action">
                  {config.onRoofRate > 0 ? (
                    <span className="cfg-addon-price">{formatCurrency(config.onRoofRate)}</span>
                  ) : (
                    <span className="cfg-addon-included">Included</span>
                  )}
                  <button
                    type="button"
                    className={`cfg-toggle ${onRoofDay ? 'on' : ''} ${config.onRoofRate === 0 ? 'always-on' : ''}`}
                    onClick={() => config.onRoofRate > 0 && setOnRoofDay(!onRoofDay)}
                    disabled={config.onRoofRate === 0}
                  >
                    <span className="cfg-toggle-slider" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && config && (
            <div className="cfg-step">
              <h3>Review Your Package</h3>
              <p className="cfg-step-desc">Here&apos;s a summary of your customized {config.name} training package.</p>

              <div className="cfg-summary-table">
                <div className="cfg-summary-row">
                  <span>Package</span>
                  <span><strong>{config.name}</strong></span>
                </div>
                <div className="cfg-summary-row">
                  <span>Base Price</span>
                  <span>{formatCurrency(basePrice)}</span>
                </div>
                <div className="cfg-summary-row">
                  <span>Certified Trainees</span>
                  <span>{config.baseTrainees + extraTrainees}
                    {extraTrainees > 0 && config.traineeRate > 0 && (
                      <small> (+{extraTrainees} &times; {formatCurrency(config.traineeRate)})</small>
                    )}
                  </span>
                </div>
                <div className="cfg-summary-row">
                  <span>Recon Kits</span>
                  <span>{config.baseKits + extraKits}
                    {extraKits > 0 && (
                      <small> (+{extraKits} &times; {formatCurrency(config.kitRate)})</small>
                    )}
                  </span>
                </div>
                {tracks.length > 0 && (
                  <div className="cfg-summary-row">
                    <span>Training Tracks</span>
                    <span>{tracks.join(', ')}</span>
                  </div>
                )}
                {(videography || config.videoRate === 0) && (
                  <div className="cfg-summary-row">
                    <span>Videography</span>
                    <span>{config.videoRate === 0 ? 'Included' : formatCurrency(config.videoRate)}</span>
                  </div>
                )}
                {(onRoofDay || config.onRoofRate === 0) && (
                  <div className="cfg-summary-row">
                    <span>On-Roof Training Day</span>
                    <span>{config.onRoofRate === 0 ? 'Included' : formatCurrency(config.onRoofRate)}</span>
                  </div>
                )}
                <div className="cfg-summary-row cfg-summary-total">
                  <span>Total Investment</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with running total and navigation */}
        <div className="cfg-footer">
          <div className="cfg-running-total">
            {tier && <span>Total: <strong>{formatCurrency(total)}</strong></span>}
          </div>
          <div className="cfg-nav">
            {step > 0 && (
              <button type="button" className="cfg-btn cfg-btn-back" onClick={handleBack}>Back</button>
            )}
            {step < STEP_LABELS.length - 1 && (
              <button type="button" className="cfg-btn cfg-btn-next" onClick={handleNext} disabled={!canGoNext()}>
                Next
              </button>
            )}
            {step === STEP_LABELS.length - 1 && (
              <button type="button" className="cfg-btn cfg-btn-confirm" onClick={handleConfirm} disabled={submitting}>
                {submitting ? 'Confirming...' : 'Confirm Package'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
