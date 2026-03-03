import { useState } from 'react'

const TIER_CONFIG = {
  professional: { name: 'Professional', base: 10000, baseTrainees: 3, baseKits: 1, baseTracks: 0, traineeRate: 2000, kitRate: 4000, trackRate: 5000, videoRate: 2000, onRoofRate: 5000, desc: '1 day, up to 3 trainees, 1 Recon Kit' },
  regional: { name: 'Regional', base: 35000, baseTrainees: 10, baseKits: 2, baseTracks: 2, traineeRate: 1600, kitRate: 4000, trackRate: 5000, videoRate: 0, onRoofRate: 5000, desc: '2 days, up to 10 trainees, 2 Recon Kits, 2 tracks' },
  enterprise: { name: 'Enterprise', base: 75000, baseTrainees: 25, baseKits: 4, baseTracks: 4, traineeRate: 0, kitRate: 4000, trackRate: 0, videoRate: 0, onRoofRate: 0, desc: '4 days, up to 25 trainees, 4 Recon Kits, all tracks' },
}

const ALL_TRACKS = ['Sales', 'Service', 'Production', 'Marketing']

const INFO_TIPS = {
  videography: 'Your training day gets professionally filmed and edited into a company-specific marketing video and instructional guide, so your team can start leveraging Roof MRI for wins immediately.',
  integrator: 'Your dedicated MRI Integrator is the key person driving Roof MRI adoption inside your company. These scheduled calls keep momentum going through the critical first 90 days post-training.',
  onroof: 'A full day on the roof with a Roof MRI expert and your team. Ideal for high-stakes jobs, complex scans, or when your crew just needs more hands-on reps before going solo.',
}

function fmt(n) { return '$' + n.toLocaleString('en-US') }

function InfoBtn({ tipKey }) {
  return (
    <span className="info-btn info-btn-inline" tabIndex="0">
      i
      <span className="info-tooltip">{INFO_TIPS[tipKey]}</span>
    </span>
  )
}

function ChkSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function getSteps(tier) {
  if (!tier) return ['tier']
  if (tier === 'enterprise') return ['tier', 'trainees_ent', 'kits', 'summary']
  if (tier === 'professional') return ['tier', 'trainees', 'kits', 'tracks_pro', 'videography', 'onroof', 'summary']
  return ['tier', 'trainees', 'kits', 'tracks_regional', 'onroof', 'summary']
}

export default function Configurator({ prices, onConfirm, onClose, submitting }) {
  const [tier, setTier] = useState(null)
  const [extraTrainees, setExtraTrainees] = useState(0)
  const [extraKits, setExtraKits] = useState(0)
  const [tracks, setTracks] = useState([])
  const [videography, setVideography] = useState(false)
  const [onRoofDay, setOnRoofDay] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState(null)

  const steps = getSteps(tier)
  const stepId = steps[currentStep]
  const c = tier ? TIER_CONFIG[tier] : null
  const basePrice = tier && prices ? (Number(prices[tier]) || c.base) : 0

  function calcTotal() {
    if (!tier || !c) return 0
    let t = basePrice
    t += extraTrainees * c.traineeRate
    t += extraKits * c.kitRate
    if (tier === 'professional') {
      t += tracks.length * c.trackRate
      if (videography) t += c.videoRate
      if (onRoofDay) t += c.onRoofRate
    } else if (tier === 'regional') {
      t += Math.max(0, tracks.length - c.baseTracks) * c.trackRate
      if (onRoofDay) t += c.onRoofRate
    }
    return t
  }

  function selectTier(t) {
    setTier(t)
    setExtraTrainees(0)
    setExtraKits(0)
    setTracks(t === 'enterprise' ? [...ALL_TRACKS] : [])
    setVideography(false)
    setOnRoofDay(false)
  }

  function toggleTrack(t) {
    setTracks((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
  }

  function goNext() {
    const s = getSteps(tier)
    if (currentStep < s.length - 1) setCurrentStep(currentStep + 1)
  }
  function goBack() {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }
  function goSkip() {
    setExtraTrainees(0)
    setExtraKits(0)
    if (tier === 'professional') { setTracks([]); setVideography(false); setOnRoofDay(false) }
    else if (tier === 'regional') { setTracks(tracks.slice(0, 2)); setOnRoofDay(false) }
    const s = getSteps(tier)
    setCurrentStep(s.length - 1)
  }

  async function handleConfirm() {
    setError(null)
    try {
      await onConfirm({ tier, extraTrainees, extraKits, tracks, videography, onRoofDay })
    } catch (err) {
      setError(err.message || 'Failed to save configuration')
    }
  }

  const total = calcTotal()
  const pct = Math.round(((currentStep + 1) / steps.length) * 100)

  return (
    <div className="config-overlay active" onClick={onClose}>
      <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <button className="config-close" onClick={onClose} type="button">{'\u2715'}</button>

        <div className="config-progress">
          <div className="config-progress-bar">
            <div className="config-progress-fill" style={{ width: `${pct}%` }}></div>
          </div>
          <span className="config-progress-text">Step {currentStep + 1} of {steps.length}</span>
        </div>

        <div className="config-body">
          {error && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: 12 }}>{error}</div>}

          {/* TIER SELECTION */}
          {stepId === 'tier' && (
            <div className="config-step active">
              <h3>Choose Your Package</h3>
              <p className="step-desc">Select the training tier that best fits your team.</p>
              <div className="config-tier-grid">
                {Object.entries(TIER_CONFIG).map(([key, tc]) => {
                  const price = prices ? prices[key] : null
                  const displayPrice = price && Number(price) > 0 ? fmt(Number(price)) : fmt(tc.base)
                  return (
                    <div
                      key={key}
                      className={`config-tier-card ${tier === key ? 'selected' : ''}`}
                      onClick={() => selectTier(key)}
                    >
                      <div className="config-tier-left">
                        <span className="ctier-name">{tc.name}</span>
                        <span className="ctier-desc">{tc.desc}</span>
                      </div>
                      <span className="config-tier-right">{displayPrice}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TRAINEES */}
          {(stepId === 'trainees' || stepId === 'trainees_ent') && c && (
            <div className="config-step active">
              <h3>How Many Trainees?</h3>
              <p className="step-desc">
                Your package includes <span className="included">{c.baseTrainees} trainees</span>.
                {stepId === 'trainees_ent'
                  ? ' Contact us for additional trainees beyond 25.'
                  : ` Additional trainees are ${fmt(c.traineeRate)} each.`}
              </p>
              {stepId !== 'trainees_ent' && (
                <>
                  <div className="stepper-wrap">
                    <div className="stepper">
                      <button onClick={() => setExtraTrainees(Math.max(0, extraTrainees - 1))} type="button">{'\u2212'}</button>
                      <div className="stepper-val">{extraTrainees}</div>
                      <button onClick={() => setExtraTrainees(extraTrainees + 1)} type="button">+</button>
                    </div>
                    <div className="stepper-info">
                      additional trainees
                      {extraTrainees > 0 && <> &middot; <strong>{fmt(extraTrainees * c.traineeRate)}</strong></>}
                    </div>
                  </div>
                  <p className="step-desc" style={{ fontSize: '0.78rem', color: '#9ba3b5' }}>
                    Total team size: <strong style={{ color: '#1e2c55' }}>{c.baseTrainees + extraTrainees} trainees</strong>
                  </p>
                </>
              )}
            </div>
          )}

          {/* KITS */}
          {stepId === 'kits' && c && (
            <div className="config-step active">
              <h3>Additional Recon Kits?</h3>
              <p className="step-desc">
                Your package includes <span className="included">{c.baseKits} Recon Kit{c.baseKits > 1 ? 's' : ''}</span>. Additional kits are {fmt(c.kitRate)} each.
              </p>
              <div className="stepper-wrap">
                <div className="stepper">
                  <button onClick={() => setExtraKits(Math.max(0, extraKits - 1))} type="button">{'\u2212'}</button>
                  <div className="stepper-val">{extraKits}</div>
                  <button onClick={() => setExtraKits(extraKits + 1)} type="button">+</button>
                </div>
                <div className="stepper-info">
                  additional kits
                  {extraKits > 0 && <> &middot; <strong>{fmt(extraKits * c.kitRate)}</strong></>}
                </div>
              </div>
            </div>
          )}

          {/* TRACKS - PROFESSIONAL */}
          {stepId === 'tracks_pro' && c && (
            <div className="config-step active">
              <h3>Add Training Tracks?</h3>
              <p className="step-desc">Each dedicated track is a half-day deep dive at <span className="included">{fmt(c.trackRate)}</span> per track, delivered online.</p>
              <div className="track-options">
                {ALL_TRACKS.map((t) => {
                  const sel = tracks.includes(t)
                  return (
                    <div key={t} className={`track-option ${sel ? 'selected' : ''}`} onClick={() => toggleTrack(t)}>
                      <div className="track-check">{sel && <ChkSvg />}</div>
                      <div className="track-option-text">
                        <span className="track-option-name">{t} Track</span>
                        <span className="track-option-sub">{fmt(c.trackRate)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TRACKS - REGIONAL */}
          {stepId === 'tracks_regional' && c && (
            <div className="config-step active">
              <h3>Select Your Tracks</h3>
              <p className="step-desc">Your package includes <span className="included">2 tracks</span>. Additional tracks are {fmt(c.trackRate)} each.</p>
              <div className="track-options">
                {ALL_TRACKS.map((t) => {
                  const sel = tracks.includes(t)
                  const idx = tracks.indexOf(t)
                  const lbl = sel && idx < 2 ? 'Included' : sel ? fmt(c.trackRate) : 'Select'
                  return (
                    <div key={t} className={`track-option ${sel ? 'selected' : ''}`} onClick={() => toggleTrack(t)}>
                      <div className="track-check">{sel && <ChkSvg />}</div>
                      <div className="track-option-text">
                        <span className="track-option-name">{t} Track</span>
                        <span className="track-option-sub">{lbl}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {(() => {
                const ex = Math.max(0, tracks.length - 2)
                if (ex > 0) return (
                  <p className="step-desc" style={{ fontSize: '0.78rem', color: '#9ba3b5' }}>
                    {ex} additional track{ex > 1 ? 's' : ''} &middot; <strong style={{ color: '#1e2c55' }}>{fmt(ex * c.trackRate)}</strong>
                  </p>
                )
                return null
              })()}
            </div>
          )}

          {/* VIDEOGRAPHY */}
          {stepId === 'videography' && c && (
            <div className="config-step active">
              <h3>Add Videography? <InfoBtn tipKey="videography" /></h3>
              <p className="step-desc">A company-specific, professional marketing video and instructional guide to start utilizing Roof MRI for wins immediately.</p>
              <div className="toggle-options">
                <div className={`toggle-opt ${videography ? 'selected' : ''}`} onClick={() => setVideography(true)}>
                  <div className="toggle-label">Yes, add it</div>
                  <div className="toggle-price">{fmt(c.videoRate)}</div>
                </div>
                <div className={`toggle-opt ${!videography ? 'selected' : ''}`} onClick={() => setVideography(false)}>
                  <div className="toggle-label">No thanks</div>
                  <div className="toggle-price">Skip</div>
                </div>
              </div>
            </div>
          )}

          {/* ON-ROOF DAY */}
          {stepId === 'onroof' && c && (
            <div className="config-step active">
              <h3>Add On-Roof Training Day? <InfoBtn tipKey="onroof" /></h3>
              <p className="step-desc">A full day on the roof with a Roof MRI expert and your team.</p>
              <div className="toggle-options">
                <div className={`toggle-opt ${onRoofDay ? 'selected' : ''}`} onClick={() => setOnRoofDay(true)}>
                  <div className="toggle-label">Yes, add it</div>
                  <div className="toggle-price">{fmt(c.onRoofRate)}</div>
                </div>
                <div className={`toggle-opt ${!onRoofDay ? 'selected' : ''}`} onClick={() => setOnRoofDay(false)}>
                  <div className="toggle-label">No thanks</div>
                  <div className="toggle-price">Skip</div>
                </div>
              </div>
            </div>
          )}

          {/* SUMMARY */}
          {stepId === 'summary' && c && (
            <div className="config-step active">
              <h3>Your Training Package</h3>
              <p className="step-desc">Review your selections below.</p>
              <div className="config-summary-items">
                <div className="config-sum-line">
                  <span className="csl-label">{c.name} Package (base)</span>
                  <span className="csl-value">{fmt(basePrice)}</span>
                </div>
                <div className="config-sum-line">
                  <span className="csl-label">Trainees</span>
                  <span className="csl-value">{c.baseTrainees + extraTrainees}{extraTrainees > 0 ? ` (+${extraTrainees})` : ''}</span>
                </div>
                {extraTrainees > 0 && c.traineeRate > 0 && (
                  <div className="config-sum-line">
                    <span className="csl-label">Additional trainees ({extraTrainees} x {fmt(c.traineeRate)})</span>
                    <span className="csl-value">{fmt(extraTrainees * c.traineeRate)}</span>
                  </div>
                )}
                <div className="config-sum-line">
                  <span className="csl-label">Recon Kits</span>
                  <span className="csl-value">{c.baseKits + extraKits}{extraKits > 0 ? ` (+${extraKits})` : ''}</span>
                </div>
                {extraKits > 0 && (
                  <div className="config-sum-line">
                    <span className="csl-label">Additional kits ({extraKits} x {fmt(c.kitRate)})</span>
                    <span className="csl-value">{fmt(extraKits * c.kitRate)}</span>
                  </div>
                )}
                {tier === 'professional' && tracks.length > 0 && (
                  <div className="config-sum-line">
                    <span className="csl-label">Training Tracks ({tracks.join(', ')})</span>
                    <span className="csl-value">{fmt(tracks.length * c.trackRate)}</span>
                  </div>
                )}
                {tier === 'regional' && tracks.length > 0 && (
                  <>
                    <div className="config-sum-line">
                      <span className="csl-label">Included Tracks ({tracks.slice(0, 2).join(', ')})</span>
                      <span className="csl-value green">Included</span>
                    </div>
                    {tracks.length > 2 && (
                      <div className="config-sum-line">
                        <span className="csl-label">Additional Tracks ({tracks.slice(2).join(', ')})</span>
                        <span className="csl-value">{fmt((tracks.length - 2) * c.trackRate)}</span>
                      </div>
                    )}
                  </>
                )}
                {tier === 'enterprise' && (
                  <>
                    <div className="config-sum-line">
                      <span className="csl-label">All 4 Training Tracks</span>
                      <span className="csl-value green">Included</span>
                    </div>
                    <div className="config-sum-line">
                      <span className="csl-label">Professional Videography</span>
                      <span className="csl-value green">Included</span>
                    </div>
                    <div className="config-sum-line">
                      <span className="csl-label">On-Roof Training Day</span>
                      <span className="csl-value green">Included</span>
                    </div>
                  </>
                )}
                {tier === 'professional' && (
                  <div className="config-sum-line">
                    <span className="csl-label">Professional Videography</span>
                    <span className="csl-value">{videography ? fmt(c.videoRate) : '\u2014'}</span>
                  </div>
                )}
                {tier === 'regional' && (
                  <div className="config-sum-line">
                    <span className="csl-label">Professional Videography</span>
                    <span className="csl-value green">Included</span>
                  </div>
                )}
                {tier !== 'enterprise' && (
                  <div className="config-sum-line">
                    <span className="csl-label">On-Roof Training Day</span>
                    <span className="csl-value">{onRoofDay ? fmt(c.onRoofRate) : '\u2014'}</span>
                  </div>
                )}
                <div className="config-sum-line">
                  <span className="csl-label">MRI Integrator Calls <InfoBtn tipKey="integrator" /></span>
                  <span className="csl-value green">
                    {tier === 'professional' ? 'Monthly (3 calls)' : tier === 'regional' ? 'Biweekly (6 calls)' : 'Weekly (12 calls)'}
                  </span>
                </div>
                <div className="config-sum-line total-line">
                  <span className="csl-label">Total Investment</span>
                  <span className="csl-value">{fmt(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NAV */}
        <div className="config-nav">
          <div className="config-nav-left">
            {currentStep > 0 && (
              <button className="nav-back" onClick={goBack} type="button">{'\u2190'} Back</button>
            )}
            {stepId !== 'tier' && stepId !== 'summary' && (
              <button className="nav-skip" onClick={goSkip} type="button">Base Package</button>
            )}
          </div>
          {stepId !== 'summary' ? (
            <button
              className="nav-next"
              onClick={goNext}
              disabled={!tier}
              style={!tier ? { opacity: 0.4, pointerEvents: 'none' } : {}}
              type="button"
            >
              Continue
            </button>
          ) : (
            <button
              className="nav-next"
              onClick={handleConfirm}
              disabled={submitting}
              type="button"
            >
              {submitting ? 'Confirming...' : 'Confirm Selection'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
