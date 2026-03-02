import { useState } from 'react'

function formatCurrency(n) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function RoiCalculator({ investmentAmount }) {
  const [scansPerMonth, setScansPerMonth] = useState(4)
  const [pricePerScan, setPricePerScan] = useState(750)

  const monthlyRevenue = scansPerMonth * pricePerScan
  const annualRevenue = monthlyRevenue * 12
  const investment = Number(investmentAmount) || 0
  const monthsToPayback = investment > 0 && monthlyRevenue > 0
    ? Math.ceil(investment / monthlyRevenue)
    : null
  const yearOneProfit = investment > 0 ? annualRevenue - investment : annualRevenue
  const roi = investment > 0 ? Math.round((yearOneProfit / investment) * 100) : null

  return (
    <div className="roi-calculator">
      <p className="section-title">ROI Calculator</p>
      <p className="roi-subtitle">
        Plug in your numbers to see how quickly Roof MRI training pays for itself.
      </p>

      <div className="roi-inputs">
        <div className="roi-field">
          <label htmlFor="scansPerMonth">Scans per month</label>
          <input
            id="scansPerMonth"
            type="number"
            min="1"
            max="999"
            value={scansPerMonth}
            onChange={e => setScansPerMonth(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div className="roi-field">
          <label htmlFor="pricePerScan">Revenue per scan ($)</label>
          <input
            id="pricePerScan"
            type="number"
            min="0"
            step="50"
            value={pricePerScan}
            onChange={e => setPricePerScan(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
      </div>

      <div className="roi-results">
        <div className="roi-result-card">
          <span className="roi-result-value">{formatCurrency(monthlyRevenue)}</span>
          <span className="roi-result-label">Monthly Revenue</span>
        </div>
        <div className="roi-result-card">
          <span className="roi-result-value">{formatCurrency(annualRevenue)}</span>
          <span className="roi-result-label">Annual Revenue</span>
        </div>
        {monthsToPayback !== null && (
          <div className="roi-result-card roi-highlight">
            <span className="roi-result-value">{monthsToPayback} {monthsToPayback === 1 ? 'month' : 'months'}</span>
            <span className="roi-result-label">Payback Period</span>
          </div>
        )}
        {roi !== null && (
          <div className="roi-result-card roi-highlight">
            <span className="roi-result-value">{roi}%</span>
            <span className="roi-result-label">Year 1 ROI</span>
          </div>
        )}
      </div>

      {yearOneProfit > 0 && investment > 0 && (
        <div className="roi-summary">
          Year 1 net profit: <strong>{formatCurrency(yearOneProfit)}</strong>
        </div>
      )}
    </div>
  )
}
