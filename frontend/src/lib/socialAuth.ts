import { api } from './api'
import { setAuthTokens } from './auth'

type SocialProvider = 'google' | 'apple'

type SocialLoginResult = {
  access: string
  refresh: string
  is_new: boolean
}

type GooglePromptNotification = {
  isNotDisplayed: () => boolean
  getNotDisplayedReason: () => string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; use_fedcm_for_prompt?: boolean }) => void
          prompt: (callback?: (notification: GooglePromptNotification) => void) => void
        }
      }
    }
    AppleID?: {
      auth: {
        init: (config: { clientId: string; scope: string; redirectURI: string; usePopup?: boolean }) => void
        signIn: () => Promise<{ authorization: { id_token: string } }>
      }
    }
  }
}

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const APPLE_SCRIPT_URL = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const marker = `data-social-src`
    if (document.querySelector(`script[${marker}="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.setAttribute(marker, src)
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Could not load the sign-in library.`))
    document.head.appendChild(script)
  })
}

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function requestGoogleToken(): Promise<{ id_token: string }> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  if (!clientId) throw new Error('Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to frontend/.env.')

  return loadScript(GOOGLE_SCRIPT_URL).then(
    () =>
      new Promise((resolve, reject) => {
        window.google!.accounts.id.initialize({
          client_id: clientId,
          use_fedcm_for_prompt: false,
          callback: (response) => resolve({ id_token: response.credential }),
        })
        window.google!.accounts.id.prompt((notification) => {
          if (notification && notification.isNotDisplayed()) {
            reject(new Error('Google sign-in could not be opened in this browser.'))
          }
        })
      }),
  )
}

let appleInitialized = false

function requestAppleToken(): Promise<{ id_token: string; nonce: string }> {
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined
  if (!clientId) throw new Error('Apple sign-in is not configured. Add VITE_APPLE_CLIENT_ID to frontend/.env.')

  const redirectURI = (import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined) || window.location.origin
  const nonce = generateNonce()

  return loadScript(APPLE_SCRIPT_URL).then(async () => {
    if (!appleInitialized) {
      window.AppleID!.auth.init({ clientId, scope: 'name email', redirectURI, usePopup: true })
      appleInitialized = true
    }
    const response = await window.AppleID!.auth.signIn()
    return { id_token: response.authorization.id_token, nonce }
  })
}

export async function socialLogin(provider: SocialProvider): Promise<SocialLoginResult> {
  const token = provider === 'google' ? await requestGoogleToken() : await requestAppleToken()
  const { data } = await api.post<SocialLoginResult>('/auth/social/', {
    provider,
    id_token: token.id_token,
    nonce: 'nonce' in token ? token.nonce : undefined,
  })
  setAuthTokens(data.access, data.refresh)
  return data
}