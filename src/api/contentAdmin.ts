const API_BASE = '/api/content/admin'
const PASSWORD_ITERATIONS = 100

export interface ContentPageSummary {
  id: string
  path: string
  draftFrontmatter: string
  state: 'draft' | 'published' | 'archived'
  publishedRevision: number | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface ContentPage extends ContentPageSummary {
  draftFrontmatter: string
  draftBody: string
  publishedFrontmatter: string | null
  publishedBody: string | null
}

class ContentApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(API_BASE + path, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok)
    throw new ContentApiError(body?.error || 'HTTP ' + response.status, response.status)
  return body as T
}

export function getContentAuthStatus() {
  return request<{ needsSetup: boolean; managedByEnvironment: boolean }>('/auth/status')
}

interface AuthChallenge {
  id: string
  challenge: string
  salt: string
  iterations: number
  needsSetup: boolean
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
    (item) => item.charCodeAt(0),
  )
}

function toBase64Url(value: ArrayBuffer) {
  let binary = ''
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function deriveVerifier(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return toBase64Url(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt), iterations },
      key,
      256,
    ),
  )
}

async function createProof(verifier: string, challenge: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    fromBase64Url(verifier),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64Url(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`vmct-content-admin-v1:${challenge}`),
    ),
  )
}

async function challenge() {
  return request<AuthChallenge>('/auth/challenge')
}

function legacyLoginContentAdmin(password: string) {
  return request<{ ok: true }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function setupContentAdmin(password: string) {
  return challenge().then(async (auth) => {
    const verifier = await deriveVerifier(password, auth.salt, auth.iterations)
    return request<{ ok: true }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ challengeId: auth.id, verifier }),
    })
  })
}

export function loginContentAdmin(password: string) {
  return challenge()
    .then(async (auth) => {
      if (auth.needsSetup) throw new Error('后台尚未初始化')
      const verifier = await deriveVerifier(password, auth.salt, auth.iterations)
      const proof = await createProof(verifier, auth.challenge)
      return request<{ ok: true }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ challengeId: auth.id, proof }),
      })
    })
    .catch((error) => {
      // The development proxy can point at an already deployed Function during
      // a staged rollout. Keep the existing login working until that Function
      // receives the challenge-response deployment.
      if (error instanceof ContentApiError && error.status === 404)
        return legacyLoginContentAdmin(password)
      throw error
    })
}

export async function changeContentAdminPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltText = toBase64Url(salt.buffer)
  const verifier = await deriveVerifier(password, saltText, PASSWORD_ITERATIONS)
  return request<{ ok: true }>('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ salt: saltText, verifier }),
  })
}

export function logoutContentAdmin() {
  return request<{ ok: true }>('/auth/logout', { method: 'POST', body: '{}' })
}

export function getContentSettings() {
  return request<{ deploymentHookUrl: string }>('/settings')
}

export function saveContentSettings(deploymentHookUrl: string) {
  return request<{ deploymentHookUrl: string }>('/settings', {
    method: 'PUT',
    body: JSON.stringify({ deploymentHookUrl }),
  })
}

export function listContentPages() {
  return request<{ pages: ContentPageSummary[] }>('/pages')
}

export function getContentPage(id: string) {
  return request<{ page: ContentPage }>('/pages/' + encodeURIComponent(id))
}

export function createContentPage(input: { path: string; frontmatter: string; body: string }) {
  return request<{ page: ContentPage }>('/pages', { method: 'POST', body: JSON.stringify(input) })
}

export function saveContentDraft(
  id: string,
  input: { path: string; frontmatter: string; body: string },
) {
  return request<{ page: ContentPage }>('/pages/' + encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function publishContentPage(id: string) {
  return request<{ page: ContentPage; deployment: { requested: boolean; error?: string } }>(
    '/pages/' + encodeURIComponent(id) + '/publish',
    { method: 'POST', body: '{}' },
  )
}

export function archiveContentPage(id: string) {
  return request<{ page: ContentPage; deployment: { requested: boolean; error?: string } }>(
    '/pages/' + encodeURIComponent(id) + '/archive',
    { method: 'POST', body: '{}' },
  )
}
