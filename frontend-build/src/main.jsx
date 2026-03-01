import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProposalPage from './pages/ProposalPage'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/p/:id" element={<ProposalPage />} />
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
