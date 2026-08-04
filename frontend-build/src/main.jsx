import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import ProposalPage from './pages/ProposalPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import PackagesPage from './pages/PackagesPage'
import InvoicePage from './pages/InvoicePage'
import { CLERK_ENABLED, registerClerk } from './lib/clerkBridge'
import './index.css'

const CLERK_PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Waits for Clerk to hydrate the session, then exposes it to non-hook code
function ClerkGate({ children }) {
  const auth = useAuth()
  if (!auth.isLoaded) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <div className="spinner" />
      </div>
    )
  }
  registerClerk(auth)
  return children
}

// Wraps admin pages in ClerkProvider when a publishable key is configured.
// Public proposal/invoice pages never load Clerk.
function WithClerk({ children }) {
  if (!CLERK_ENABLED) return children
  return (
    <ClerkProvider publishableKey={CLERK_PK} afterSignOutUrl="/admin/login">
      <ClerkGate>{children}</ClerkGate>
    </ClerkProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/p/:id" element={<ProposalPage />} />
        <Route path="/invoice/:id" element={<InvoicePage />} />
        <Route path="/admin/login" element={<WithClerk><AdminLogin /></WithClerk>} />
        <Route path="/admin" element={<WithClerk><AdminDashboard /></WithClerk>} />
        <Route path="/packages" element={<PackagesPage />} />
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
