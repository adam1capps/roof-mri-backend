import { useState } from 'react'

export default function SignaturePad({ onSign, companyName, disabled }) {
  const [clientSig, setClientSig] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientTitle, setClientTitle] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signed, setSigned] = useState(false)
  const [signedAt, setSignedAt] = useState(null)

  const redryDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  async function handleSubmit() {
    if (!clientSig.trim()) return
    if (!clientName.trim()) return
    if (!clientTitle.trim()) return
    if (!clientEmail.trim() || clientEmail.indexOf('@') < 1) return

    setSubmitting(true)
    try {
      const now = new Date()
      const signData = {
        signature: clientSig.trim(),
        printedName: clientName.trim(),
        title: clientTitle.trim(),
        email: clientEmail.trim(),
        timestamp: now.toISOString(),
        userAgent: navigator.userAgent,
      }

      // The signatureName is the typed signature, signatureData is JSON with all fields
      await onSign(clientSig.trim(), JSON.stringify(signData))
      setSigned(true)
      setSignedAt(now)
    } catch {
      setSubmitting(false)
    }
  }

  const isLocked = signed || disabled

  return (
    <div className="signature-section" id="signatureSection">
      <div className="sig-header">
        <span className="label">Execution</span>
        <h2>Acknowledgment & Signature</h2>
        <p>By signing below, both parties agree to all terms outlined in this Training Agreement.</p>
      </div>
      <div className="sig-grid">
        {/* ReDry (pre-filled) */}
        <div className="sig-party">
          <span className="sig-party-label">ReDry LLC</span>
          <div className="sig-field">
            <div className="sig-filled signature-style">Adam Capps</div>
            <span className="sig-label">Signature</span>
          </div>
          <div className="sig-field">
            <div className="sig-filled">Adam Capps</div>
            <span className="sig-label">Printed Name</span>
          </div>
          <div className="sig-field">
            <div className="sig-filled">Founder</div>
            <span className="sig-label">Title</span>
          </div>
          <div className="sig-field">
            <div className="sig-filled date-auto">{redryDate}</div>
            <span className="sig-label">Date</span>
          </div>
        </div>

        {/* Client (interactive) */}
        <div className="sig-party" id="clientSigParty">
          <span className="sig-party-label">{companyName || 'Client'}</span>
          <div className="sig-field">
            <input
              type="text"
              className="sig-input signature-input"
              placeholder="Type your full name to sign"
              value={clientSig}
              onChange={(e) => setClientSig(e.target.value)}
              readOnly={isLocked}
              style={isLocked ? { opacity: 0.7, borderBottomColor: 'var(--gray200)' } : {}}
              autoComplete="off"
            />
            <span className="sig-label">Signature</span>
          </div>
          <div className="sig-field">
            <input
              type="text"
              className="sig-input"
              placeholder="Full name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              readOnly={isLocked}
              style={isLocked ? { opacity: 0.7, borderBottomColor: 'var(--gray200)' } : {}}
              autoComplete="name"
            />
            <span className="sig-label">Printed Name</span>
          </div>
          <div className="sig-field">
            <input
              type="text"
              className="sig-input"
              placeholder="Title"
              value={clientTitle}
              onChange={(e) => setClientTitle(e.target.value)}
              readOnly={isLocked}
              style={isLocked ? { opacity: 0.7, borderBottomColor: 'var(--gray200)' } : {}}
              autoComplete="organization-title"
            />
            <span className="sig-label">Title</span>
          </div>
          <div className="sig-field">
            <input
              type="email"
              className="sig-input"
              placeholder="Email address"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              readOnly={isLocked}
              style={isLocked ? { opacity: 0.7, borderBottomColor: 'var(--gray200)' } : {}}
              autoComplete="email"
            />
            <span className="sig-label">Email</span>
          </div>
          <div className="sig-field">
            <div className="sig-filled date-auto">
              {signedAt
                ? signedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'Populated upon signing'}
            </div>
            <span className="sig-label">Date</span>
          </div>

          {!signed && !disabled && (
            <button
              className="cta-btn"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ marginTop: 8, fontSize: '0.85rem', padding: '14px 24px' }}
              type="button"
            >
              {submitting ? 'Signing...' : 'Sign Agreement'}
            </button>
          )}

          {signed && (
            <div className="signed-badge visible">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00a35f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <div>
                <div className="signed-text">Agreement Signed</div>
                <div className="signed-detail">
                  Signed by {clientName} on{' '}
                  {signedAt && signedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
