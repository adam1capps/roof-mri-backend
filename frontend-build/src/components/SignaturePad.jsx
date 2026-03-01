import { useRef, useEffect, useState, useCallback } from 'react'
import SignaturePadLib from 'signature_pad'

export default function SignaturePad({ onSign, disabled }) {
  const canvasRef = useRef(null)
  const padRef = useRef(null)
  const [name, setName] = useState('')
  const [isEmpty, setIsEmpty] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const wrapper = canvas.parentElement
    const ratio = window.devicePixelRatio || 1
    canvas.width = wrapper.offsetWidth * ratio
    canvas.height = 160 * ratio
    canvas.style.height = '160px'
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    if (padRef.current) {
      padRef.current.clear()
      setIsEmpty(true)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resizeCanvas()

    padRef.current = new SignaturePadLib(canvas, {
      penColor: '#1B2A4A',
      backgroundColor: 'rgba(255,255,255,0)',
    })

    padRef.current.addEventListener('endStroke', () => {
      setIsEmpty(padRef.current.isEmpty())
    })

    window.addEventListener('resize', resizeCanvas)
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (padRef.current) padRef.current.off()
    }
  }, [resizeCanvas])

  function handleClear() {
    if (padRef.current) {
      padRef.current.clear()
      setIsEmpty(true)
    }
  }

  async function handleSign() {
    if (!name.trim() || isEmpty || !padRef.current) return
    setSubmitting(true)
    try {
      const signatureData = padRef.current.toDataURL('image/png')
      await onSign(name.trim(), signatureData)
    } catch {
      setSubmitting(false)
    }
  }

  const canSubmit = name.trim().length > 0 && !isEmpty && !submitting && !disabled

  return (
    <div className="signature-section">
      <p className="section-title">Sign Proposal</p>
      <input
        type="text"
        className="name-input"
        placeholder="Type your full name"
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={disabled || submitting}
      />
      <div className="sig-canvas-wrapper">
        <canvas ref={canvasRef} />
        {isEmpty && <span className="sig-placeholder">Draw your signature above</span>}
      </div>
      <div className="sig-actions">
        <button className="clear-btn" onClick={handleClear} type="button" disabled={submitting}>
          Clear signature
        </button>
      </div>
      <button
        className="btn btn-primary"
        onClick={handleSign}
        disabled={!canSubmit}
        type="button"
      >
        {submitting ? 'Signing...' : 'Sign & Accept Proposal'}
      </button>
    </div>
  )
}
