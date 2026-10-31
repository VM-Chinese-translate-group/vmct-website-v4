import test from 'node:test'
import assert from 'node:assert/strict'
import { loginContentAdmin } from './content-auth.mjs'

test('CLI export/import uses one-use VMPM tickets without sending the JWT to the website or following redirects', async () => {
  const originalFetch = globalThis.fetch
  const originalToken = process.env.VMPM_TOKEN
  const originalOrigin = process.env.VMPM_ORIGIN
  const calls = []
  process.env.VMPM_TOKEN = 'fixture-private-jwt'
  process.env.VMPM_ORIGIN = 'https://vmpm.test'
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/auth/status')) return Response.json({ authMode: 'vmpm' })
    if (String(url) === 'https://vmpm.test/api/auth/content-sso/ticket') return Response.json({ code: 0, data: { ticket: 't'.repeat(43) } })
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': 'cms_content_session=fixture-cookie; HttpOnly; Secure' } })
  }
  try {
    assert.equal(await loginContentAdmin('https://site.test'), 'cms_content_session=fixture-cookie')
    assert.equal(calls.length, 3)
    assert.equal(calls[1].options.headers.Authorization, 'Bearer fixture-private-jwt')
    assert.equal(calls[2].options.headers.Authorization, undefined)
    assert.deepEqual(JSON.parse(calls[2].options.body), { ticket: 't'.repeat(43) })
    assert.ok(calls.every(call => call.options.redirect === 'error'))
    process.env.VMPM_ORIGIN = 'http://remote.test'
    await assert.rejects(loginContentAdmin('https://site.test'), /HTTPS/)
    delete process.env.VMPM_TOKEN
    await assert.rejects(loginContentAdmin('https://site.test'), /VMPM_TOKEN/)
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.VMPM_TOKEN; else process.env.VMPM_TOKEN = originalToken
    if (originalOrigin === undefined) delete process.env.VMPM_ORIGIN; else process.env.VMPM_ORIGIN = originalOrigin
  }
})
