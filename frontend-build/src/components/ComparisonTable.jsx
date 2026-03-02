import { useState } from 'react'

const TIERS = ['Professional', 'Regional', 'Enterprise']

const COMPARISON_DATA = [
  {
    category: 'Training Format',
    features: [
      { name: 'Full Day, In-Person Training', values: [true, true, true] },
      { name: 'Hands-On, Equipment-Based', values: [true, true, true] },
      { name: 'PHD Scale Calibration Training', values: [true, true, true] },
      { name: 'Dual/IR Scanning Protocol', values: [false, true, true] },
      { name: 'Real-World Roof Access', values: [false, true, true] },
      { name: 'Custom Curriculum for Your Company', values: [false, false, true] },
    ],
  },
  {
    category: 'Dedicated Training Tracks',
    features: [
      { name: 'Sales Track', values: [false, true, true] },
      { name: 'Service Track', values: [false, true, true] },
      { name: 'Production Track', values: [false, false, true] },
      { name: 'Marketing Track', values: [false, false, true] },
    ],
  },
  {
    category: 'People & Equipment',
    features: [
      { name: 'Certified Trainees', values: ['3', 'Up to 10', 'Up to 25'] },
      { name: 'Recon Kits (Tramex)', values: ['1', '2', '4'] },
      { name: 'Replacement / Spare Parts', values: [false, true, true] },
      { name: 'Equipment Upgrades as Available', values: [false, false, true] },
    ],
  },
  {
    category: 'Post-Training Support',
    features: [
      { name: 'Ongoing Technical Support', values: [true, true, true] },
      { name: 'Quarterly Check-In Call', values: [false, true, true] },
      { name: 'Priority Response Time', values: [false, false, true] },
      { name: 'Regional Marketing Support', values: [false, false, true] },
    ],
  },
  {
    category: 'New Hire Training',
    features: [
      { name: 'Online Refresher Modules', values: [true, true, true] },
      { name: 'New Hire In-Person Training', values: [false, true, true] },
      { name: 'Annual Re-Certification', values: [false, false, true] },
    ],
  },
]

function CheckIcon() {
  return (
    <svg className="cmp-check" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="cmp-x" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

export default function ComparisonTable() {
  const [openCategories, setOpenCategories] = useState(
    () => new Set(COMPARISON_DATA.map(c => c.category))
  )

  function toggleCategory(cat) {
    setOpenCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="cmp-wrapper">
      <p className="section-title">Compare All Packages</p>
      <p className="cmp-subtitle">See exactly what&apos;s included in each training tier.</p>

      <div className="cmp-table-scroll">
        <table className="cmp-table">
          <thead>
            <tr>
              <th className="cmp-feature-col"></th>
              {TIERS.map(t => (
                <th key={t} className="cmp-tier-col">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_DATA.map(group => (
              <>
                <tr
                  key={group.category}
                  className="cmp-category-row"
                  onClick={() => toggleCategory(group.category)}
                >
                  <td colSpan={4}>
                    <span className={`cmp-chevron ${openCategories.has(group.category) ? 'open' : ''}`}>&#9662;</span>
                    {group.category}
                  </td>
                </tr>
                {openCategories.has(group.category) && group.features.map(feat => (
                  <tr key={feat.name} className="cmp-feature-row">
                    <td className="cmp-feature-name">{feat.name}</td>
                    {feat.values.map((val, i) => (
                      <td key={i} className="cmp-feature-val">
                        {val === true ? <CheckIcon /> : val === false ? <XIcon /> : <span className="cmp-text-val">{val}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
