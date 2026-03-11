import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProposalPage from './pages/ProposalPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import ContractorDashboard from './components/ContractorDashboard'
import CustomerDashboard from './components/CustomerDashboard'
import PropertyDashboard from './components/PropertyDashboard'
import AddClientWizard from './components/AddClientWizard'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/warranty" replace />} />
        <Route path="/p/:id" element={<ProposalPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/warranty" element={<WarrantyLayout><ContractorDashboard /></WarrantyLayout>} />
        <Route path="/admin/warranty/add-client" element={<WarrantyLayout><AddClientWizard /></WarrantyLayout>} />
        <Route path="/admin/warranty/customers/:ownerId" element={<WarrantyLayout><CustomerDashboard /></WarrantyLayout>} />
        <Route path="/admin/warranty/properties/:propertyId" element={<WarrantyLayout><PropertyDashboard /></WarrantyLayout>} />
        <Route path="*" element={
          <div className="page-wrapper">
            <header className="site-header">
              <span className="logo">ROOF <span className="accent">MRI</span></span>
              <span className="tagline">Training &amp; Certification</span>
            </header>
            <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
              <h2 style={{ color: '#1B2A4A', marginBottom: 8 }}>Page Not Found</h2>
              <p style={{ color: '#64748b' }}>If you received a proposal link, please check your email and try again.</p>
            </div>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)

function WarrantyLayout({ children }) {
  return (
    <div className="page-wrapper">
      <header className="site-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="logo">ROOF <span className="accent">MRI</span></span>
          <span className="tagline">Warranty Management</span>
        </div>
        <nav style={{ display: 'flex', gap: 12 }}>
          <a href="/admin/warranty" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>Dashboard</a>
          <a href="/admin" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>Proposals</a>
        </nav>
      </header>
      {children}
    </div>
  )
}
