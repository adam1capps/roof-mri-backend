import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCustomerDashboard } from '../warrantyApi'

export default function CustomerDashboard() {
  const { ownerId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCustomerDashboard(ownerId)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [ownerId])

  if (loading) return <div className="warranty-loading">Loading customer...</div>
  if (error) return <div className="warranty-error">{error}</div>
  if (!data) return null

  const { owner, properties, warranties, claims } = data

  return (
    <div className="warranty-dashboard">
      <button className="warranty-btn warranty-btn-secondary" onClick={() => navigate('/admin/warranty')} style={{ marginBottom: 12 }}>
        &larr; Back to Dashboard
      </button>

      <h2 className="warranty-title">{owner.name}</h2>
      {owner.company && <p style={{ color: '#64748b', marginTop: -8 }}>{owner.company}</p>}
      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
        {owner.email && <span>{owner.email}</span>}
        {owner.email && owner.phone && <span> &bull; </span>}
        {owner.phone && <span>{owner.phone}</span>}
      </div>

      {/* Summary Cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-value">{properties.length}</div>
          <div className="kpi-label">Properties</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{warranties.length}</div>
          <div className="kpi-label">Warranties</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{claims.length}</div>
          <div className="kpi-label">Claims</div>
        </div>
      </div>

      {/* Properties */}
      <h3 style={{ color: '#1B2A4A' }}>Properties</h3>
      {properties.length === 0 ? (
        <p style={{ color: '#64748b' }}>No properties yet.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr>
              <th>Address</th>
              <th>City</th>
              <th>State</th>
              <th>ZIP</th>
            </tr>
          </thead>
          <tbody>
            {properties.map(p => (
              <tr key={p.id} onClick={() => navigate(`/admin/warranty/properties/${p.id}`)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600, color: '#1B2A4A' }}>{p.address}</td>
                <td>{p.city || '—'}</td>
                <td>{p.state || '—'}</td>
                <td>{p.zip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Warranties */}
      <h3 style={{ color: '#1B2A4A', marginTop: 24 }}>Warranties</h3>
      {warranties.length === 0 ? (
        <p style={{ color: '#64748b' }}>No warranties on file.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr>
              <th>Manufacturer</th>
              <th>Type</th>
              <th>Property</th>
              <th>Status</th>
              <th>Covered</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {warranties.map(w => (
              <tr key={w.id}>
                <td style={{ fontWeight: 600 }}>{w.manufacturer || '—'}</td>
                <td>{w.warranty_type || '—'}</td>
                <td>{w.property_address || '—'}</td>
                <td><span className={`warranty-badge warranty-badge-${w.status}`}>{w.status}</span></td>
                <td>{w.covered_amount ? `$${Number(w.covered_amount).toLocaleString()}` : '—'}</td>
                <td>{w.end_date ? new Date(w.end_date).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Claims */}
      <h3 style={{ color: '#1B2A4A', marginTop: 24 }}>Claims</h3>
      {claims.length === 0 ? (
        <p style={{ color: '#64748b' }}>No claims filed.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Manufacturer</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {claims.map(c => (
              <tr key={c.id}>
                <td>{c.claim_date ? new Date(c.claim_date).toLocaleDateString() : '—'}</td>
                <td>{c.manufacturer || '—'}</td>
                <td>{c.description || '—'}</td>
                <td>{c.amount ? `$${Number(c.amount).toLocaleString()}` : '—'}</td>
                <td><span className={`warranty-badge warranty-badge-${c.status}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
