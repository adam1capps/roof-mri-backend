// Pay-later / hold-your-price rules. Mirrors the server (server.js), which
// re-validates everything; keep the two in sync.
export const DEPOSIT_AMOUNT = 1000
export const MIN_TRAINING_LEAD_DAYS = 14
export const TRAINING_WINDOW_END = '2027-03-31'

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

// Latest start date: the fixed hold window, or six months out once it passes
export function trainingWindowEnd() {
  const sixMonths = new Date()
  sixMonths.setUTCMonth(sixMonths.getUTCMonth() + 6)
  const rolling = isoDate(sixMonths)
  return rolling > TRAINING_WINDOW_END ? rolling : TRAINING_WINDOW_END
}

// Mondays (YYYY-MM-DD) from 2 weeks out through the end of the window
export function getTrainingWeeks() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + MIN_TRAINING_LEAD_DAYS)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (day === 1 ? 0 : (8 - day) % 7))
  const end = trainingWindowEnd()
  const weeks = []
  while (isoDate(d) <= end) {
    weeks.push(isoDate(d))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return weeks
}

export function formatWeekLabel(value) {
  // Accepts 'YYYY-MM-DD' or a full ISO timestamp from the API
  const d = new Date(String(value).slice(0, 10) + 'T00:00:00Z')
  const end = new Date(d)
  end.setUTCDate(end.getUTCDate() + 4)
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  return `Week of ${d.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${d.getUTCFullYear()}`
}

export function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
}
