import { useNavigate } from 'react-router-dom'

const TIERS = [
  {
    key: 'professional',
    name: 'Professional',
    tag: 'Small Teams',
    price: '$10K',
    priceSub: 'one-time',
    trainees: 3,
    kits: 1,
    tracks: '—',
    days: '1 Day',
    videography: '—',
    onRoof: 'Add-on',
    extraTrainee: '$2,000/ea',
    extraKit: '$4,000/ea',
    desc: 'Get certified and start scanning. One focused day for your core team, with optional add-on tracks.',
    highlights: [
      'Owner + 2 trainees',
      '1 Recon Kit included',
      'Classroom + field certification',
      'Optional online track sessions',
    ],
  },
  {
    key: 'regional',
    name: 'Regional',
    tag: 'Most Popular',
    price: '$35K',
    priceSub: 'one-time',
    trainees: 10,
    kits: 2,
    tracks: '2',
    days: '2 Days',
    videography: 'Add-on',
    onRoof: 'Add-on',
    extraTrainee: '$1,600/ea',
    extraKit: '$4,000/ea',
    featured: true,
    desc: 'Certification plus two dedicated tracks. Pick the deep dives that matter most to your operation.',
    highlights: [
      'Up to 10 trainees, 2 Recon Kits',
      'Pick 2 dedicated track days',
      '1 free Nashville new hire seat',
      'Quarterly strategic check-ins',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tag: 'Full Scale',
    price: '$75K+',
    priceSub: 'custom engagement',
    trainees: 25,
    kits: 4,
    tracks: '4',
    days: '4 Days',
    videography: 'Included',
    onRoof: 'Included',
    extraTrainee: 'Included',
    extraKit: '$4,000/ea',
    desc: 'Comprehensive rollout across all tracks and locations. Fully custom, operationally capped at 4 on-site days.',
    highlights: [
      'Up to 25 trainees, 4 Recon Kits',
      'All tracks included (half-day)',
      'MRI Integrator Calls (weekly)',
      'On-roof training day included',
    ],
  },
]

const COMPARISON_ROWS = [
  { label: 'Certified Trainees', values: ['3', '10', '25'] },
  { label: 'Recon Kits', values: ['1', '2', '4'] },
  { label: 'On-Site Days', values: ['1 Day', '2 Days', '4 Days'] },
  { label: 'Tracks', values: ['—', '2', '4'] },
  { label: 'Videography', values: ['—', 'Add-on', '✓'] },
  { label: 'On-Roof Training Day', values: ['Add-on', 'Add-on', '✓'] },
  { label: 'PHD Scale Calibration', values: ['✓', '✓', '✓'] },
  { label: 'Tramex Equipment', values: ['✓', '✓', '✓'] },
  { label: 'Ongoing Support', values: ['✓', '✓', '✓'] },
  { label: 'Moisture Grid Reports', values: ['✓', '✓', '✓'] },
  { label: 'Extra Trainees', values: ['$2,000/ea', '$1,600/ea', 'Included'] },
  { label: 'Extra Kits', values: ['$4,000/ea', '$4,000/ea', '$4,000/ea'] },
]

const BENEFITS = [
  { title: 'New Revenue Stream', text: 'Offer moisture scanning as a paid service on every project or as a standalone offering.' },
  { title: 'Competitive Advantage', text: 'Deliver objective, PHD-calibrated moisture data that other contractors can\'t match.' },
  { title: 'Reduced Liability', text: 'Precise, repeatable readings backed by calibrated science — not guesswork.' },
  { title: 'Long-Term Value', text: 'Equipment, certification, and ongoing support your team will use for years.' },
]

function ChkSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function PackagesPage() {
  const navigate = useNavigate()

  return (
    <div className="pkg-page">
      {/* Header */}
      <header className="pkg-header">
        <span className="pkg-logo">ROOF <span className="pkg-accent">MRI</span></span>
        <span className="pkg-tagline">Training &amp; Certification</span>
      </header>

      {/* Hero */}
      <section className="pkg-hero">
        <h1>Choose the Right Training Package</h1>
        <p>Compare packages below to find the best fit for your team's size and territory.</p>
      </section>

      {/* Tier cards */}
      <section className="pkg-cards">
        {TIERS.map(t => (
          <div key={t.key} className={`pkg-card${t.featured ? ' pkg-card--featured' : ''}`}>
            <div className="pkg-card-head">
              <h3>{t.name}</h3>
              <span className="pkg-card-tag">{t.tag}</span>
            </div>
            <div className="pkg-card-price">
              <span className="pkg-price-amount">{t.price}</span>
              <span className="pkg-price-sub">{t.priceSub}</span>
            </div>
            <p className="pkg-card-desc">{t.desc}</p>
            <ul className="pkg-card-list">
              {t.highlights.map((h, i) => (
                <li key={i}><ChkSvg /> {h}</li>
              ))}
            </ul>
            <a className="pkg-card-cta" href={`mailto:adam@roof-mri.com?subject=${encodeURIComponent(t.name + ' Package Inquiry')}`}>
              Get a Quote
            </a>
          </div>
        ))}
      </section>

      {/* Side-by-side table */}
      <section className="pkg-table-section">
        <h2>Side-by-Side Comparison</h2>
        <div className="pkg-table-wrap">
          <table className="pkg-table">
            <thead>
              <tr>
                <th>Feature</th>
                {TIERS.map(t => (
                  <th key={t.key} className={t.featured ? 'pkg-th--featured' : ''}>{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, ri) => (
                <tr key={ri}>
                  <td className="pkg-td-label">{row.label}</td>
                  {row.values.map((v, vi) => (
                    <td key={vi} className={v === '✓' ? 'pkg-td-check' : ''}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Benefits */}
      <section className="pkg-benefits">
        <h2>What Your Team Gets</h2>
        <div className="pkg-benefits-grid">
          {BENEFITS.map((b, i) => (
            <div key={i} className="pkg-benefit">
              <h4><span className="pkg-dot" />{b.title}</h4>
              <p>{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pkg-cta">
        <h2>Ready to Get Started?</h2>
        <p>Contact us for a custom quote tailored to your team.</p>
        <a href="mailto:adam@roof-mri.com?subject=Training%20Package%20Inquiry" className="pkg-cta-btn">
          Request a Quote
        </a>
      </section>
    </div>
  )
}
