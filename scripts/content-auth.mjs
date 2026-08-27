import { webcrypto } from 'node:crypto'

const cryptoApi = globalThis.crypto || webcrypto
const encoder = new TextEncoder()

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(
    Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='), 'base64'),
  )
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

async function deriveVerifier(password, salt, iterations) {
  const key = await cryptoApi.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  return toBase64Url(
    await cryptoApi.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt), iterations },
      key,
      256,
    ),
  )
}

async function createProof(verifier, challenge) {
  const key = await cryptoApi.subtle.importKey(
    'raw',
    fromBase64Url(verifier),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64Url(
    await cryptoApi.subtle.sign('HMAC', key, encoder.encode(`vmct-content-admin-v1:${challenge}`)),
  )
}

export async function loginContentAdmin(origin, password) {
  const challengeResponse = await fetch(origin + '/api/content/admin/auth/challenge')
  const challenge = await challengeResponse.json().catch(() => null)
  if (!challengeResponse.ok || !challenge?.id)
    throw new Error(challenge?.error || '无法获取登录挑战。')
  if (challenge.needsSetup) throw new Error('后台尚未初始化。')
  const verifier = await deriveVerifier(password, challenge.salt, challenge.iterations)
  const proof = await createProof(verifier, challenge.challenge)
  const login = await fetch(origin + '/api/content/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ challengeId: challenge.id, proof }),
  })
  const result = await login.json().catch(() => null)
  const cookie = login.headers.get('set-cookie')?.split(';')[0]
  if (!login.ok || !cookie) throw new Error(result?.error || '登录失败，请检查后台密码。')
  return cookie
}
