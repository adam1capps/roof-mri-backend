import { useState } from 'react'

function ChkSvg() {
  return (
    <svg className="chk" viewBox="0 0 24 24" fill="none" stroke="#00bd70" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const CATEGORIES = [
  {
    name: 'Training Format',
    features: [
      { name: 'Classroom Session (Industry + Roof MRI Methodology)', values: ['check', 'check', 'check'] },
      { name: 'Live Field Scan Certification', values: ['check', 'check', 'check'] },
      { name: 'Basic Sales Applications Overview', values: ['check', 'check', 'check'] },
      { name: 'Roof MRI Certification Credential', values: ['check', 'check', 'check'] },
      {
        name: 'Professional Training Footage',
        sub: 'Your training day professionally filmed and edited into marketing-ready video content',
        values: [{ type: 'badge-gray', text: 'Upon Request \u2021' }, { type: 'badge-green', text: 'Included' }, { type: 'badge-green', text: 'Included' }],
      },
    ],
  },
  {
    name: 'Dedicated Training Tracks (Half-Day Sessions)',
    sub: 'Strategy, workflow integration, measurement, and Q1 accountability \u2020',
    features: [
      { name: 'Sales Track', sub: 'Sales theory, pipeline integration, buyer education', values: [{ type: 'dollar', text: '$5,000' }, { type: 'text', text: 'Choice of 2' }, { type: 'badge-green', text: 'Included' }] },
      { name: 'Service Track', sub: 'Maintenance workflows, field execution, service reporting', values: [{ type: 'dollar', text: '$5,000' }, { type: 'text', text: 'Choice of 2' }, { type: 'badge-green', text: 'Included' }] },
      { name: 'Production Track', sub: 'QC applications, project documentation, crew deployment', values: [{ type: 'dollar', text: '$5,000' }, { type: 'text', text: 'Choice of 2' }, { type: 'badge-green', text: 'Included' }] },
      { name: 'Marketing Track', sub: 'Go-to-market strategy, LinkedIn playbook, brand integration', values: [{ type: 'dollar', text: '$5,000' }, { type: 'text', text: 'Choice of 2' }, { type: 'badge-green', text: 'Included' }] },
      { name: 'Session Format', values: [{ type: 'text', text: 'Online' }, { type: 'text', text: 'In Person' }, { type: 'text', text: 'In Person' }] },
    ],
  },
  {
    name: 'People & Equipment',
    features: [
      { name: 'Trainees Included', values: [{ type: 'text', text: 'Up to 3' }, { type: 'text', text: 'Up to 10' }, { type: 'text', text: 'Up to 25' }] },
      { name: 'Recon Kits Included', values: [{ type: 'text', text: '1' }, { type: 'text', text: '2' }, { type: 'text', text: '4' }] },
      { name: 'Additional Trainees', values: [{ type: 'badge-gray', text: 'Full Cost' }, { type: 'badge-green', text: '20% Off' }, { type: 'badge-navy', text: 'Custom' }] },
      { name: 'Additional Recon Kits', values: [{ type: 'dollar', text: '$4,000/ea' }, { type: 'dollar', text: '$4,000/ea' }, { type: 'dollar', text: '$4,000/ea' }] },
    ],
  },
  {
    name: 'Post-Training Support',
    features: [
      { name: 'Team Follow-Up Call', sub: '1-hour Zoom at the 2-week mark', values: ['check', 'check', 'check'] },
      { name: '15-Min FaceTime Calls with MRI Expert', values: ['check', 'check', 'check'] },
      { name: 'Online MRI Protocol Checklist *', values: ['check', 'check', 'check'] },
      { name: 'MRI Integrator Calls', sub: '30-min calls with your MRI Integrator for 90 days', values: [{ type: 'text', text: 'Monthly (3)' }, { type: 'text', text: 'Biweekly (6)' }, { type: 'text', text: 'Weekly (12)' }] },
      { name: 'Additional On-Roof Training Day **', sub: 'Full day on-roof with your team', values: [{ type: 'dollar', text: '$5,000' }, { type: 'dollar', text: '$5,000' }, { type: 'badge-green', text: 'Included' }] },
      { name: 'Access to Roof MRI Education Library', values: ['check', 'check', 'check'] },
    ],
  },
  {
    name: 'New Hire Training (Nashville HQ)',
    features: [
      { name: 'Free New Hire Seats (First Year)', values: [{ type: 'text', text: '\u2014' }, { type: 'text', text: '1' }, { type: 'text', text: '5' }] },
      { name: 'Per-Person Rate After Free Seats', values: [{ type: 'badge-gray', text: 'Full Price' }, { type: 'badge-green', text: '25% Off' }, { type: 'badge-green', text: '50% Off' }] },
    ],
  },
]

function renderVal(val, isRegional) {
  if (val === 'check') return <ChkSvg />
  if (typeof val === 'object') {
    if (val.type === 'badge-green') return <span className="badge badge-green">{val.text}</span>
    if (val.type === 'badge-gray') return <span className="badge badge-gray">{val.text}</span>
    if (val.type === 'badge-navy') return <span className="badge badge-navy">{val.text}</span>
    if (val.type === 'dollar') return <span className="dollar-val">{val.text}</span>
    if (val.type === 'text') return <span className="text-val">{val.text}</span>
  }
  return null
}

export default function ComparisonTable() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div className="section-header">
        <span className="label">Full Breakdown</span>
        <h2>Compare Every Detail</h2>
        <p>See exactly what{'\u2019'}s in each package side by side.</p>
      </div>

      <div className={`table-collapse-toggle ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <span className="toggle-text">{isOpen ? 'Hide Comparison' : 'View Full Comparison'}</span>
        <svg className="toggle-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <div className={`table-collapsible ${isOpen ? 'open' : ''}`}>
        <div className="table-wrap">
          <div className="table-header">
            <div className="features-label">Features</div>
            <div className="tier-col">
              <div className="tier-col-name">Professional</div>
              <div className="tier-col-price">$10K</div>
            </div>
            <div className="tier-col regional">
              <div className="tier-col-name">Regional</div>
              <div className="tier-col-price">$35K</div>
            </div>
            <div className="tier-col">
              <div className="tier-col-name">Enterprise</div>
              <div className="tier-col-price">$75K+</div>
            </div>
          </div>

          {CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <div className="cat-bar">
                <div className="ab"></div>
                <div>
                  <span className="cat-label">{cat.name}</span>
                  {cat.sub && <div className="cat-sub">{cat.sub}</div>}
                </div>
              </div>
              {cat.features.map((feat) => (
                <div className="feat-row" key={feat.name}>
                  <div className="feat-label">
                    <span className="name">{feat.name}</span>
                    {feat.sub && <span className="sub">{feat.sub}</span>}
                  </div>
                  <div className="feat-val">{renderVal(feat.values[0], false)}</div>
                  <div className="feat-val regional">{renderVal(feat.values[1], true)}</div>
                  <div className="feat-val">{renderVal(feat.values[2], false)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="footnotes">
          <p>{'\u2020'} All dedicated training tracks are delivered as half-day sessions. Any track can be upgraded to a full day. Contact us for pricing.</p>
          <p>* Access to the online MRI Protocol Checklist requires signing an additional NDA upon first login within the Roof MRI App.</p>
          <p>{'\u2021'} Professional training footage is available for Professional tier at additional cost. Contact us for pricing.</p>
          <p>** On-roof training day pricing reflects scheduling 2+ weeks in advance. Rush requests are subject to increased rates.</p>
        </div>
      </div>
    </>
  )
}
