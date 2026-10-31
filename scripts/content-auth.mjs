import { webcrypto } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

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
  const statusResponse = await fetch(origin + '/api/content/admin/auth/status', { redirect: 'error' })
  if (!statusResponse.ok) throw new Error('无法连接内容登录服务。')
  const status = await statusResponse.json()
  if (status.authMode === 'vmpm') {
    const token = process.env.VMPM_TOKEN
    if (!token) throw new Error('统一登录的导入/导出需要通过 VMPM_TOKEN 环境变量提供当前管理员会话；请勿将令牌写入命令参数或仓库。')
    const target = new URL(process.env.VMPM_ORIGIN || 'https://vmpm.vmct.top')
    if (target.username || target.password || !(target.protocol === 'https:' || (target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname))))
      throw new Error('VMPM_ORIGIN 必须为 HTTPS 来源或本机 HTTP 来源。')
    const ticketResponse = await fetch(new URL('/api/auth/content-sso/ticket', target), {
      method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer ' + token },
    })
    const ticket = await ticketResponse.json().catch(() => null)
    if (!ticketResponse.ok || ticket?.code !== 0 || typeof ticket.data?.ticket !== 'string') throw new Error('无法验证 VMPM 管理员会话。')
    const response = await fetch(origin + '/api/content/admin/auth/login', {
      method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ ticket: ticket.data.ticket }),
    })
    const cookie = response.headers.get('set-cookie')?.split(';')[0]
    if (!response.ok || !cookie) throw new Error('官网统一登录失败，请重新获取 VMPM 会话。')
    return cookie
  }
  if (password === undefined) {
    const prompt = createInterface({ input: stdin, output: stdout })
    try { password = await prompt.question('请输入开发后台密码：') }
    finally { prompt.close() }
  }
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
