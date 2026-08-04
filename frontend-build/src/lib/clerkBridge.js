// Bridges Clerk auth (Google login) with the legacy localStorage token,
// so data-fetching code can get a fresh token without needing React hooks.
export const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

let clerk = null // { isSignedIn, getToken, signOut } registered by ClerkGate in main.jsx

export function registerClerk(auth) {
  clerk = auth
}

// Returns a token for API calls: fresh Clerk session token when signed in
// with Google, otherwise the legacy password-login JWT from localStorage.
export async function getAuthToken() {
  if (clerk?.isSignedIn) {
    try {
      const t = await clerk.getToken()
      if (t) return t
    } catch { /* fall through to legacy token */ }
  }
  return localStorage.getItem('roofmri_token')
}

export async function signOutEverywhere() {
  localStorage.removeItem('roofmri_token')
  if (clerk?.isSignedIn) {
    try { await clerk.signOut() } catch { /* ignore */ }
  }
}
