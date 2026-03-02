import { useState } from 'react'

const TIERS = [
  {
    key: 'professional',
    name: 'Professional',
    trainees: 3,
    kits: 1,
    desc: 'Ideal for small teams getting started with moisture scanning.',
    features: [
      '3 Certified Trainees',
      '1 Recon Kit',
      'PHD Scale Calibration',
      'Tramex Equipment',
      'Ongoing Support',
      'Moisture Grid Reports',
    ],
  },
  {
    key: 'regional',
    name: 'Regional',
    trainees: 10,
    kits: 2,
    desc: 'Built for companies covering a multi-city or statewide territory.',
    badge: 'Most Popular',
    features: [
      '10 Certified Trainees',
      '2 Recon Kits',
      'PHD Scale Calibration',
      'Tramex Equipment',
      'Ongoing Support',
      'Moisture Grid Reports',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    trainees: 25,
    kits: 4,
    desc: 'Full-scale deployment for large organizations with multiple crews.',
    features: [
      '25 Certified Trainees',
      '4 Recon Kits',
      'PHD Scale Calibration',
      'Tramex Equipment',
      'Ongoing Support',
      'Moisture Grid Reports',
    ],
  },
]

function formatCurrency(amount) {
  return Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function PackageSelector({ prices, onSelect, selecting }) {
  const [hoveredTier, setHoveredTier] = useState(null)

  return (
    <div className="pkg-selector">
      <p className="section-title">Choose Your Training Package</p>
      <p className="pkg-subtitle">
        Select the package that best fits your team size and territory. Every package includes full certification, equipment, and ongoing support.
      </p>

      <div className="pkg-grid">
        {TIERS.map(tier => {
          const price = prices[tier.key]
          const hasPrice = price && Number(price) > 0
          const isHovered = hoveredTier === tier.key
          const isPopular = tier.badge

          return (
            <div
              key={tier.key}
              className={`pkg-card${isPopular ? ' pkg-popular' : ''}${isHovered ? ' pkg-hover' : ''}`}
              onMouseEnter={() => setHoveredTier(tier.key)}
              onMouseLeave={() => setHoveredTier(null)}
            >
              {isPopular && <div className="pkg-badge">{tier.badge}</div>}

              <div className="pkg-card-header">
                <h3 className="pkg-tier-name">{tier.name}</h3>
                <p className="pkg-tier-desc">{tier.desc}</p>
              </div>

              {hasPrice && (
                <div className="pkg-price">
                  {formatCurrency(price)}
                </div>
              )}

              <ul className="pkg-features">
                {tier.features.map((f, i) => (
                  <li key={i}>
                    <svg className="pkg-check-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`btn ${isPopular ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => onSelect(tier.key)}
                disabled={selecting || !hasPrice}
                type="button"
              >
                {selecting ? 'Selecting...' : hasPrice ? `Select ${tier.name}` : 'Contact for Pricing'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
