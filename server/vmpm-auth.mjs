export function createVmpmAuth(origin) {
  const base = new URL(origin)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new Error('VMPM_API_ORIGIN must be an HTTP(S) origin')
  return async (action, credential) => {
    const response = await fetch(new URL('/api/auth/content-sso/' + (action === 'redeem' ? 'redeem' : 'session'), base), {
      method: action === 'redeem' ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: action === 'redeem' ? { 'Content-Type': 'application/json' } : { Authorization: 'Bearer ' + credential },
      ...(action === 'redeem' ? { body: JSON.stringify({ ticket: credential }) } : {}),
    })
    if (!response.ok) {
      const error = new Error('VMPM 身份验证失败')
      error.status = [401, 403].includes(response.status) ? response.status : 503
      throw error
    }
    const body = await response.json()
    if (body.code !== 0 || !body.data) {
      const error = new Error('VMPM 登录已失效或没有官网管理权限')
      error.status = 401
      throw error
    }
    return body.data
  }
}
