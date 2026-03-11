import { useState, useEffect, useRef } from 'react'
import { fetchPhotos, fetchPhoto, uploadPhoto, deletePhoto } from '../warrantyApi'

export default function PhotoUpload({ entityType, entityId }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const fileRef = useRef()

  function reload() {
    setLoading(true)
    fetchPhotos(entityType, entityId)
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [entityType, entityId])

  async function handleUpload(e) {
    const files = e.target.files
    if (!files.length) return
    setUploading(true)

    for (const file of files) {
      try {
        const base64 = await fileToBase64(file)
        await uploadPhoto({
          entity_type: entityType,
          entity_id: entityId,
          filename: file.name,
          mime_type: file.type,
          data: base64,
        })
      } catch (err) {
        alert(`Failed to upload ${file.name}: ${err.message}`)
      }
    }

    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
    reload()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this photo?')) return
    try {
      await deletePhoto(id)
      reload()
      if (preview?.id === id) setPreview(null)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handlePreview(photo) {
    try {
      const full = await fetchPhoto(photo.id)
      setPreview(full)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div>
      {/* Upload area */}
      <div className="photo-upload-area">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          style={{ display: 'none' }}
          id={`photo-input-${entityType}-${entityId}`}
        />
        <label htmlFor={`photo-input-${entityType}-${entityId}`} className="warranty-btn warranty-btn-primary" style={{ cursor: 'pointer' }}>
          {uploading ? 'Uploading...' : '+ Upload Photos'}
        </label>
        <span style={{ color: '#64748b', fontSize: 13, marginLeft: 12 }}>
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Thumbnail grid */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Loading photos...</p>
      ) : photos.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>No photos uploaded yet.</p>
      ) : (
        <div className="photo-grid">
          {photos.map(p => (
            <div key={p.id} className="photo-thumb" onClick={() => handlePreview(p)}>
              <div className="photo-thumb-placeholder">
                {p.filename || 'Photo'}
              </div>
              <div className="photo-thumb-info">
                <span>{p.caption || p.filename || `#${p.id}`}</span>
                <button
                  className="photo-delete-btn"
                  onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="photo-modal-overlay" onClick={() => setPreview(null)}>
          <div className="photo-modal" onClick={e => e.stopPropagation()}>
            <button className="photo-modal-close" onClick={() => setPreview(null)}>&times;</button>
            {preview.data && (
              <img
                src={preview.data.startsWith('data:') ? preview.data : `data:${preview.mime_type || 'image/jpeg'};base64,${preview.data}`}
                alt={preview.caption || preview.filename}
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }}
              />
            )}
            <p style={{ color: '#64748b', marginTop: 8, textAlign: 'center' }}>
              {preview.caption || preview.filename || ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
