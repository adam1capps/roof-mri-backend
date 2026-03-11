import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onboardClient } from '../warrantyApi'

const STEPS = ['Owner', 'Property', 'Roof', 'Warranty', 'Review']

export default function AddClientWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [owner, setOwner] = useState({ name: '', email: '', phone: '', company: '' })
  const [property, setProperty] = useState({ address: '', city: '', state: '', zip: '' })
  const [roof, setRoof] = useState({ roof_type: '', size_sqft: '', year_installed: '', condition: '', notes: '' })
  const [warranty, setWarranty] = useState({ manufacturer: '', warranty_type: '', start_date: '', end_date: '', covered_amount: '', maintenance_plan: '', notes: '' })

  function canNext() {
    if (step === 0) return owner.name.trim() !== ''
    if (step === 1) return property.address.trim() !== ''
    return true
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const hasRoof = roof.roof_type || roof.size_sqft || roof.year_installed
      const hasWarranty = warranty.manufacturer || warranty.warranty_type
      const result = await onboardClient({
        owner,
        property,
        roof: hasRoof ? roof : null,
        warranty: hasWarranty ? warranty : null,
      })
      navigate(`/admin/warranty/customers/${result.owner.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="warranty-dashboard">
      <button className="warranty-btn warranty-btn-secondary" onClick={() => navigate('/admin/warranty')} style={{ marginBottom: 12 }}>
        &larr; Back to Dashboard
      </button>

      <h2 className="warranty-title">Add New Client</h2>

      {/* Progress bar */}
      <div className="wizard-progress">
        {STEPS.map((s, i) => (
          <div key={s} className={`wizard-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            <div className="wizard-step-dot">{i < step ? '\u2713' : i + 1}</div>
            <span className="wizard-step-label">{s}</span>
          </div>
        ))}
      </div>

      {error && <div className="warranty-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Step content */}
      <div className="wizard-content">
        {step === 0 && (
          <div className="warranty-form">
            <h3>Customer Information</h3>
            <input placeholder="Name *" value={owner.name} onChange={e => setOwner(o => ({ ...o, name: e.target.value }))} />
            <input placeholder="Company" value={owner.company} onChange={e => setOwner(o => ({ ...o, company: e.target.value }))} />
            <input placeholder="Email" type="email" value={owner.email} onChange={e => setOwner(o => ({ ...o, email: e.target.value }))} />
            <input placeholder="Phone" value={owner.phone} onChange={e => setOwner(o => ({ ...o, phone: e.target.value }))} />
          </div>
        )}

        {step === 1 && (
          <div className="warranty-form">
            <h3>Property Details</h3>
            <input placeholder="Address *" value={property.address} onChange={e => setProperty(p => ({ ...p, address: e.target.value }))} />
            <input placeholder="City" value={property.city} onChange={e => setProperty(p => ({ ...p, city: e.target.value }))} />
            <div style={{ display: 'flex', gap: 12 }}>
              <input placeholder="State" value={property.state} onChange={e => setProperty(p => ({ ...p, state: e.target.value }))} style={{ flex: 1 }} />
              <input placeholder="ZIP" value={property.zip} onChange={e => setProperty(p => ({ ...p, zip: e.target.value }))} style={{ flex: 1 }} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="warranty-form">
            <h3>Roof Information <span style={{ color: '#64748b', fontWeight: 400, fontSize: 14 }}>(optional)</span></h3>
            <input placeholder="Roof Type (e.g., TPO, EPDM, BUR)" value={roof.roof_type} onChange={e => setRoof(r => ({ ...r, roof_type: e.target.value }))} />
            <input placeholder="Size (sq ft)" type="number" value={roof.size_sqft} onChange={e => setRoof(r => ({ ...r, size_sqft: e.target.value }))} />
            <input placeholder="Year Installed" type="number" value={roof.year_installed} onChange={e => setRoof(r => ({ ...r, year_installed: e.target.value }))} />
            <select value={roof.condition} onChange={e => setRoof(r => ({ ...r, condition: e.target.value }))}>
              <option value="">Condition...</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
            <textarea placeholder="Notes" value={roof.notes} onChange={e => setRoof(r => ({ ...r, notes: e.target.value }))} />
          </div>
        )}

        {step === 3 && (
          <div className="warranty-form">
            <h3>Warranty Details <span style={{ color: '#64748b', fontWeight: 400, fontSize: 14 }}>(optional)</span></h3>
            <input placeholder="Manufacturer" value={warranty.manufacturer} onChange={e => setWarranty(w => ({ ...w, manufacturer: e.target.value }))} />
            <input placeholder="Warranty Type" value={warranty.warranty_type} onChange={e => setWarranty(w => ({ ...w, warranty_type: e.target.value }))} />
            <label>Start Date <input type="date" value={warranty.start_date} onChange={e => setWarranty(w => ({ ...w, start_date: e.target.value }))} /></label>
            <label>End Date <input type="date" value={warranty.end_date} onChange={e => setWarranty(w => ({ ...w, end_date: e.target.value }))} /></label>
            <input placeholder="Covered Amount" type="number" value={warranty.covered_amount} onChange={e => setWarranty(w => ({ ...w, covered_amount: e.target.value }))} />
            <input placeholder="Maintenance Plan" value={warranty.maintenance_plan} onChange={e => setWarranty(w => ({ ...w, maintenance_plan: e.target.value }))} />
            <textarea placeholder="Notes" value={warranty.notes} onChange={e => setWarranty(w => ({ ...w, notes: e.target.value }))} />
          </div>
        )}

        {step === 4 && (
          <div className="wizard-review">
            <h3>Review &amp; Confirm</h3>
            <div className="review-section">
              <h4>Customer</h4>
              <p><strong>{owner.name}</strong>{owner.company ? ` (${owner.company})` : ''}</p>
              {owner.email && <p>{owner.email}</p>}
              {owner.phone && <p>{owner.phone}</p>}
            </div>
            <div className="review-section">
              <h4>Property</h4>
              <p>{property.address}</p>
              <p>{[property.city, property.state, property.zip].filter(Boolean).join(', ')}</p>
            </div>
            {(roof.roof_type || roof.size_sqft) && (
              <div className="review-section">
                <h4>Roof</h4>
                <p>{roof.roof_type}{roof.size_sqft ? ` - ${roof.size_sqft} sqft` : ''}{roof.year_installed ? ` (${roof.year_installed})` : ''}</p>
                {roof.condition && <p>Condition: {roof.condition}</p>}
              </div>
            )}
            {(warranty.manufacturer || warranty.warranty_type) && (
              <div className="review-section">
                <h4>Warranty</h4>
                <p>{warranty.manufacturer}{warranty.warranty_type ? ` - ${warranty.warranty_type}` : ''}</p>
                {warranty.covered_amount && <p>Coverage: ${Number(warranty.covered_amount).toLocaleString()}</p>}
                {warranty.start_date && warranty.end_date && <p>{warranty.start_date} to {warranty.end_date}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="wizard-nav">
        {step > 0 && (
          <button className="warranty-btn warranty-btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button>
        )}
        <div style={{ flex: 1 }} />
        {step < STEPS.length - 1 ? (
          <>
            {(step === 2 || step === 3) && (
              <button className="warranty-btn warranty-btn-secondary" onClick={() => setStep(s => s + 1)} style={{ marginRight: 8 }}>
                Skip
              </button>
            )}
            <button className="warranty-btn warranty-btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
              Continue
            </button>
          </>
        ) : (
          <button className="warranty-btn warranty-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create Client'}
          </button>
        )}
      </div>
    </div>
  )
}
