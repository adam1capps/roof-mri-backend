import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchContractorDashboard, fetchOwners } from '../warrantyApi'

export default function ContractorDashboard() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState(null)
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchContractorDashboard(), fetchOwners()])
      .then(([kpiData, ownerData]) => {
        setKpis(kpiData)
        setOwners(ownerData)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="warranty-loading">Loading dashboard...</div>
  if (error) return <div className="warranty-error">{error}</div>

  return (
    <div className="warranty-dashboard">
      <h2 className="warranty-title">Warranty Management Dashboard</h2>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{kpis?.customers || 0}</div>
          <div className="kpi-label">Customers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpis?.properties || 0}</div>
          <div className="kpi-label">Properties</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpis?.warranties?.active || 0}</div>
          <div className="kpi-label">Active Warranties</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpis?.claims?.pending || 0}</div>
          <div className="kpi-label">Pending Claims</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpis?.inspections || 0}</div>
          <div className="kpi-label">Inspections</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">
            ${Number(kpis?.warranties?.total_coverage || 0).toLocaleString()}
          </div>
          <div className="kpi-label">Total Coverage</div>
        </div>
      </div>

      {/* Add Client Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        <h3 style={{ color: '#1B2A4A', margin: 0 }}>Customers</h3>
        <button className="warranty-btn warranty-btn-primary" onClick={() => navigate('/admin/warranty/add-client')}>
          + Add Client
        </button>
      </div>

      {/* Customer Table */}
      {owners.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>No customers yet. Add your first client to get started.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {owners.map(o => (
              <tr key={o.id} onClick={() => navigate(`/admin/warranty/customers/${o.id}`)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600, color: '#1B2A4A' }}>{o.name}</td>
                <td>{o.company || '—'}</td>
                <td>{o.email || '—'}</td>
                <td>{o.phone || '—'}</td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
