const API = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('roofmri_token')
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  }
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ── Owners ──────────────────────────────────────────────────────
export const fetchOwners = () => apiFetch('/api/owners')
export const fetchOwner = (id) => apiFetch(`/api/owners/${id}`)
export const createOwner = (data) => apiFetch('/api/owners', { method: 'POST', body: JSON.stringify(data) })
export const updateOwner = (id, data) => apiFetch(`/api/owners/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteOwner = (id) => apiFetch(`/api/owners/${id}`, { method: 'DELETE' })

// ── Properties ──────────────────────────────────────────────────
export const fetchProperties = (ownerId) => apiFetch(`/api/properties${ownerId ? `?owner_id=${ownerId}` : ''}`)
export const fetchProperty = (id) => apiFetch(`/api/properties/${id}`)
export const createProperty = (data) => apiFetch('/api/properties', { method: 'POST', body: JSON.stringify(data) })
export const updateProperty = (id, data) => apiFetch(`/api/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteProperty = (id) => apiFetch(`/api/properties/${id}`, { method: 'DELETE' })

// ── Roofs ───────────────────────────────────────────────────────
export const fetchRoofs = (propertyId) => apiFetch(`/api/roofs${propertyId ? `?property_id=${propertyId}` : ''}`)
export const createRoof = (data) => apiFetch('/api/roofs', { method: 'POST', body: JSON.stringify(data) })
export const updateRoof = (id, data) => apiFetch(`/api/roofs/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteRoof = (id) => apiFetch(`/api/roofs/${id}`, { method: 'DELETE' })

// ── Warranties ──────────────────────────────────────────────────
export const fetchWarranties = (roofId) => apiFetch(`/api/warranties${roofId ? `?roof_id=${roofId}` : ''}`)
export const fetchManufacturers = () => apiFetch('/api/warranties/manufacturers')
export const createWarranty = (data) => apiFetch('/api/warranties', { method: 'POST', body: JSON.stringify(data) })
export const updateWarranty = (id, data) => apiFetch(`/api/warranties/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteWarranty = (id) => apiFetch(`/api/warranties/${id}`, { method: 'DELETE' })

// ── Claims ──────────────────────────────────────────────────────
export const fetchClaims = (warrantyId) => apiFetch(`/api/claims${warrantyId ? `?warranty_id=${warrantyId}` : ''}`)
export const createClaim = (data) => apiFetch('/api/claims', { method: 'POST', body: JSON.stringify(data) })
export const createClaimFromInvoice = (invoiceId) => apiFetch(`/api/claims/from-invoice/${invoiceId}`, { method: 'POST' })
export const updateClaim = (id, data) => apiFetch(`/api/claims/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteClaim = (id) => apiFetch(`/api/claims/${id}`, { method: 'DELETE' })

// ── Invoices ────────────────────────────────────────────────────
export const fetchInvoices = (propertyId) => apiFetch(`/api/invoices${propertyId ? `?property_id=${propertyId}` : ''}`)
export const createInvoice = (data) => apiFetch('/api/invoices', { method: 'POST', body: JSON.stringify(data) })
export const updateInvoice = (id, data) => apiFetch(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteInvoice = (id) => apiFetch(`/api/invoices/${id}`, { method: 'DELETE' })

// ── Inspections ─────────────────────────────────────────────────
export const fetchInspections = (roofId) => apiFetch(`/api/inspections${roofId ? `?roof_id=${roofId}` : ''}`)
export const createInspection = (data) => apiFetch('/api/inspections', { method: 'POST', body: JSON.stringify(data) })
export const updateInspection = (id, data) => apiFetch(`/api/inspections/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteInspection = (id) => apiFetch(`/api/inspections/${id}`, { method: 'DELETE' })

// ── Photos ──────────────────────────────────────────────────────
export const fetchPhotos = (entityType, entityId) => apiFetch(`/api/photos?entity_type=${entityType}&entity_id=${entityId}`)
export const fetchPhoto = (id) => apiFetch(`/api/photos/${id}`)
export const uploadPhoto = (data) => apiFetch('/api/photos', { method: 'POST', body: JSON.stringify(data) })
export const deletePhoto = (id) => apiFetch(`/api/photos/${id}`, { method: 'DELETE' })

// ── Dashboards ──────────────────────────────────────────────────
export const fetchContractorDashboard = () => apiFetch('/api/dashboard/contractor')
export const fetchCustomerDashboard = (ownerId) => apiFetch(`/api/dashboard/customer/${ownerId}`)
export const fetchPropertyDashboard = (propertyId) => apiFetch(`/api/dashboard/property/${propertyId}`)

// ── Onboarding ──────────────────────────────────────────────────
export const onboardClient = (data) => apiFetch('/api/onboard-client', { method: 'POST', body: JSON.stringify(data) })
