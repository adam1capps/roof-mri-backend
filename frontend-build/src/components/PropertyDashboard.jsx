import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPropertyDashboard, createClaimFromInvoice, createRoof, createWarranty, createInvoice, createInspection, createClaim } from '../warrantyApi'
import PhotoUpload from './PhotoUpload'

export default function PropertyDashboard() {
  const { propertyId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('warranties')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(null)

  function reload() {
    setLoading(true)
    fetchPropertyDashboard(propertyId)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [propertyId])

  if (loading) return <div className="warranty-loading">Loading property...</div>
  if (error) return <div className="warranty-error">{error}</div>
  if (!data) return null

  const { property, roofs, warranties, claims, invoices, inspections } = data
  const tabs = [
    { key: 'warranties', label: 'Warranties', count: warranties.length },
    { key: 'claims', label: 'Claims', count: claims.length },
    { key: 'invoices', label: 'Invoices', count: invoices.length },
    { key: 'inspections', label: 'Inspections', count: inspections.length },
    { key: 'roofs', label: 'Roofs', count: roofs.length },
    { key: 'photos', label: 'Photos' },
  ]

  async function handleFileClaim(invoiceId) {
    try {
      await createClaimFromInvoice(invoiceId)
      reload()
      setActiveTab('claims')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="warranty-dashboard">
      <button className="warranty-btn warranty-btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>
        &larr; Back
      </button>

      <h2 className="warranty-title">{property.address}</h2>
      <p style={{ color: '#64748b', marginTop: -8 }}>
        {[property.city, property.state, property.zip].filter(Boolean).join(', ')}
        {property.owner_name && <span> &bull; Owner: {property.owner_name}</span>}
      </p>

      {/* Tabs */}
      <div className="warranty-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`warranty-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(t.key); setShowForm(null) }}
          >
            {t.label}{t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="warranty-tab-content">
        {activeTab === 'warranties' && (
          <WarrantiesTab warranties={warranties} roofs={roofs} propertyId={propertyId} onReload={reload} showForm={showForm} setShowForm={setShowForm} />
        )}
        {activeTab === 'claims' && (
          <ClaimsTab claims={claims} warranties={warranties} onReload={reload} showForm={showForm} setShowForm={setShowForm} />
        )}
        {activeTab === 'invoices' && (
          <InvoicesTab invoices={invoices} propertyId={propertyId} onReload={reload} onFileClaim={handleFileClaim} showForm={showForm} setShowForm={setShowForm} />
        )}
        {activeTab === 'inspections' && (
          <InspectionsTab inspections={inspections} roofs={roofs} onReload={reload} showForm={showForm} setShowForm={setShowForm} />
        )}
        {activeTab === 'roofs' && (
          <RoofsTab roofs={roofs} propertyId={propertyId} onReload={reload} showForm={showForm} setShowForm={setShowForm} />
        )}
        {activeTab === 'photos' && (
          <PhotoUpload entityType="property" entityId={parseInt(propertyId)} />
        )}
      </div>
    </div>
  )
}

function WarrantiesTab({ warranties, roofs, propertyId, onReload, showForm, setShowForm }) {
  const [form, setForm] = useState({ roof_id: roofs[0]?.id || '', manufacturer: '', warranty_type: '', start_date: '', end_date: '', covered_amount: '', maintenance_plan: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.roof_id) {
      alert('Please add a roof first')
      return
    }
    setSaving(true)
    try {
      await createWarranty({ ...form, roof_id: parseInt(form.roof_id) })
      setShowForm(null)
      onReload()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="warranty-btn warranty-btn-primary" onClick={() => setShowForm(showForm === 'warranty' ? null : 'warranty')}>
          {showForm === 'warranty' ? 'Cancel' : '+ Add Warranty'}
        </button>
      </div>
      {showForm === 'warranty' && (
        <form className="warranty-form" onSubmit={handleAdd}>
          <select value={form.roof_id} onChange={e => setForm(f => ({ ...f, roof_id: e.target.value }))}>
            <option value="">Select Roof</option>
            {roofs.map(r => <option key={r.id} value={r.id}>{r.roof_type || 'Roof'} #{r.id}</option>)}
          </select>
          <input placeholder="Manufacturer" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
          <input placeholder="Warranty Type" value={form.warranty_type} onChange={e => setForm(f => ({ ...f, warranty_type: e.target.value }))} />
          <label>Start Date <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></label>
          <label>End Date <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></label>
          <input placeholder="Covered Amount" type="number" value={form.covered_amount} onChange={e => setForm(f => ({ ...f, covered_amount: e.target.value }))} />
          <input placeholder="Maintenance Plan" value={form.maintenance_plan} onChange={e => setForm(f => ({ ...f, maintenance_plan: e.target.value }))} />
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button type="submit" className="warranty-btn warranty-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Warranty'}</button>
        </form>
      )}
      {warranties.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center' }}>No warranties on file.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr><th>Manufacturer</th><th>Type</th><th>Roof</th><th>Status</th><th>Covered</th><th>Start</th><th>End</th></tr>
          </thead>
          <tbody>
            {warranties.map(w => (
              <tr key={w.id}>
                <td style={{ fontWeight: 600 }}>{w.manufacturer || '—'}</td>
                <td>{w.warranty_type || '—'}</td>
                <td>{w.roof_type || '—'}</td>
                <td><span className={`warranty-badge warranty-badge-${w.status}`}>{w.status}</span></td>
                <td>{w.covered_amount ? `$${Number(w.covered_amount).toLocaleString()}` : '—'}</td>
                <td>{w.start_date ? new Date(w.start_date).toLocaleDateString() : '—'}</td>
                <td>{w.end_date ? new Date(w.end_date).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function ClaimsTab({ claims, warranties, onReload, showForm, setShowForm }) {
  const [form, setForm] = useState({ warranty_id: warranties[0]?.id || '', description: '', amount: '' })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.warranty_id) { alert('No warranty to file claim against'); return }
    setSaving(true)
    try {
      await createClaim({ ...form, warranty_id: parseInt(form.warranty_id) })
      setShowForm(null)
      onReload()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="warranty-btn warranty-btn-primary" onClick={() => setShowForm(showForm === 'claim' ? null : 'claim')}>
          {showForm === 'claim' ? 'Cancel' : '+ File Claim'}
        </button>
      </div>
      {showForm === 'claim' && (
        <form className="warranty-form" onSubmit={handleAdd}>
          <select value={form.warranty_id} onChange={e => setForm(f => ({ ...f, warranty_id: e.target.value }))}>
            <option value="">Select Warranty</option>
            {warranties.map(w => <option key={w.id} value={w.id}>{w.manufacturer || 'Warranty'} #{w.id}</option>)}
          </select>
          <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <input placeholder="Amount" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <button type="submit" className="warranty-btn warranty-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'File Claim'}</button>
        </form>
      )}
      {claims.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center' }}>No claims filed.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr><th>Date</th><th>Manufacturer</th><th>Description</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {claims.map(c => (
              <tr key={c.id}>
                <td>{c.claim_date ? new Date(c.claim_date).toLocaleDateString() : '—'}</td>
                <td>{c.manufacturer || '—'}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description || '—'}</td>
                <td>{c.amount ? `$${Number(c.amount).toLocaleString()}` : '—'}</td>
                <td><span className={`warranty-badge warranty-badge-${c.status}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function InvoicesTab({ invoices, propertyId, onReload, onFileClaim, showForm, setShowForm }) {
  const [form, setForm] = useState({ invoice_number: '', amount: '', description: '', invoice_date: '' })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createInvoice({ ...form, property_id: parseInt(propertyId) })
      setShowForm(null)
      onReload()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="warranty-btn warranty-btn-primary" onClick={() => setShowForm(showForm === 'invoice' ? null : 'invoice')}>
          {showForm === 'invoice' ? 'Cancel' : '+ Add Invoice'}
        </button>
      </div>
      {showForm === 'invoice' && (
        <form className="warranty-form" onSubmit={handleAdd}>
          <input placeholder="Invoice Number" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
          <input placeholder="Amount" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <label>Date <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} /></label>
          <button type="submit" className="warranty-btn warranty-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Invoice'}</button>
        </form>
      )}
      {invoices.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center' }}>No invoices.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr><th>#</th><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 600 }}>{inv.invoice_number || inv.id}</td>
                <td>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '—'}</td>
                <td>{inv.description || '—'}</td>
                <td>{inv.amount ? `$${Number(inv.amount).toLocaleString()}` : '—'}</td>
                <td><span className={`warranty-badge warranty-badge-${inv.status}`}>{inv.status}</span></td>
                <td>
                  <button className="warranty-btn warranty-btn-small" onClick={() => onFileClaim(inv.id)}>File Claim</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function InspectionsTab({ inspections, roofs, onReload, showForm, setShowForm }) {
  const [form, setForm] = useState({ roof_id: roofs[0]?.id || '', inspector: '', findings: '', inspection_date: '' })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.roof_id) { alert('Please add a roof first'); return }
    setSaving(true)
    try {
      await createInspection({ ...form, roof_id: parseInt(form.roof_id) })
      setShowForm(null)
      onReload()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="warranty-btn warranty-btn-primary" onClick={() => setShowForm(showForm === 'inspection' ? null : 'inspection')}>
          {showForm === 'inspection' ? 'Cancel' : '+ Add Inspection'}
        </button>
      </div>
      {showForm === 'inspection' && (
        <form className="warranty-form" onSubmit={handleAdd}>
          <select value={form.roof_id} onChange={e => setForm(f => ({ ...f, roof_id: e.target.value }))}>
            <option value="">Select Roof</option>
            {roofs.map(r => <option key={r.id} value={r.id}>{r.roof_type || 'Roof'} #{r.id}</option>)}
          </select>
          <input placeholder="Inspector" value={form.inspector} onChange={e => setForm(f => ({ ...f, inspector: e.target.value }))} />
          <label>Date <input type="date" value={form.inspection_date} onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))} /></label>
          <textarea placeholder="Findings" value={form.findings} onChange={e => setForm(f => ({ ...f, findings: e.target.value }))} />
          <button type="submit" className="warranty-btn warranty-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Inspection'}</button>
        </form>
      )}
      {inspections.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center' }}>No inspections.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr><th>Date</th><th>Inspector</th><th>Roof</th><th>Findings</th><th>Status</th></tr>
          </thead>
          <tbody>
            {inspections.map(i => (
              <tr key={i.id}>
                <td>{i.inspection_date ? new Date(i.inspection_date).toLocaleDateString() : '—'}</td>
                <td>{i.inspector || '—'}</td>
                <td>{i.roof_type || '—'}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.findings || '—'}</td>
                <td><span className={`warranty-badge warranty-badge-${i.status}`}>{i.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function RoofsTab({ roofs, propertyId, onReload, showForm, setShowForm }) {
  const [form, setForm] = useState({ roof_type: '', size_sqft: '', year_installed: '', condition: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createRoof({ ...form, property_id: parseInt(propertyId) })
      setShowForm(null)
      onReload()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="warranty-btn warranty-btn-primary" onClick={() => setShowForm(showForm === 'roof' ? null : 'roof')}>
          {showForm === 'roof' ? 'Cancel' : '+ Add Roof'}
        </button>
      </div>
      {showForm === 'roof' && (
        <form className="warranty-form" onSubmit={handleAdd}>
          <input placeholder="Roof Type (e.g., TPO, EPDM, BUR)" value={form.roof_type} onChange={e => setForm(f => ({ ...f, roof_type: e.target.value }))} />
          <input placeholder="Size (sq ft)" type="number" value={form.size_sqft} onChange={e => setForm(f => ({ ...f, size_sqft: e.target.value }))} />
          <input placeholder="Year Installed" type="number" value={form.year_installed} onChange={e => setForm(f => ({ ...f, year_installed: e.target.value }))} />
          <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
            <option value="">Condition...</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button type="submit" className="warranty-btn warranty-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Roof'}</button>
        </form>
      )}
      {roofs.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center' }}>No roofs added.</p>
      ) : (
        <table className="warranty-table">
          <thead>
            <tr><th>Type</th><th>Size</th><th>Year</th><th>Condition</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {roofs.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.roof_type || '—'}</td>
                <td>{r.size_sqft ? `${Number(r.size_sqft).toLocaleString()} sqft` : '—'}</td>
                <td>{r.year_installed || '—'}</td>
                <td>{r.condition ? <span className={`warranty-badge warranty-badge-${r.condition}`}>{r.condition}</span> : '—'}</td>
                <td>{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
