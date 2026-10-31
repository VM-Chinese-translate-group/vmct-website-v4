import { normalizePagePath } from './content-renderer.mjs'

const SITE_URL = 'https://www.vmct.top'
const escapeXml = value => String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char])
const serialize = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

export function createSiteHandler({ content, renderer, template, manifest = {}, development = false, frameOrigin }) {
  const htmlCache = new Map()
  function invalidate() { content.invalidate(); htmlCache.clear() }

  async function handle(request) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
    const url = new URL(request.url)
    const pathname = url.pathname
    if (pathname === '/index.html') return new Response(null, { status: 308, headers: { Location: '/' } })
    if (/^\/(?:api|internal|server|src|node_modules|\.git|\.vite)(?:\/|$)/.test(pathname)) return new Response('Not Found', { status: 404 })
    if (pathname === '/sitemap.xml') {
      const { catalog } = await content.load()
      const paths = new Map(['/', '/modpacks', '/map', '/credits', '/translation-feedback'].map(path => [path, null]))
      for (const page of catalog) if (page.meta.noindex !== true && !/\/(?:secret|example)$/.test(page.path)) paths.set(page.path, page.publishedAt)
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + [...paths].map(([path, modified]) => `<url><loc>${escapeXml(new URL(path, SITE_URL).href)}</loc>${modified ? `<lastmod>${escapeXml(modified)}</lastmod>` : ''}</url>`).join('') + '</urlset>'
      return new Response(request.method === 'HEAD' ? null : xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-cache' } })
    }
    const route = normalizePagePath(pathname)
    if (!route) return new Response('Not Found', { status: 404 })
    const state = await content.forPath(route)
    // The server router uses the requested path (including a trailing slash).
    // Reuse that exact value for the first client navigation during hydration.
    state.path = pathname
    state.embedded = /^\/admin(?:\/|$)/.test(pathname) && url.searchParams.get('embedded') === '1'
    const key = state.version + ':' + pathname
    const cacheable = !development && !/^\/admin(?:\/|$)/.test(pathname)
    let pending = cacheable && htmlCache.get(key)
    if (!pending) {
      pending = (async () => {
        const render = await renderer()
        const result = await render(pathname, state)
        const css = new Set(result.modules.flatMap(id => manifest[id] || []).filter(file => file.endsWith('.css')))
        const styles = [...css].map(file => `<link rel="stylesheet" href="${escapeXml(file.startsWith('/') ? file : '/' + file)}" />`).join('\n')
        const priorityImage = result.appHtml.match(/<img[^>]+src="([^"]+)"[^>]+fetchpriority="high"/i)?.[1]
        const preload = priorityImage ? `<link rel="preload" as="image" href="${priorityImage}" fetchpriority="high" />` : ''
        const source = await template(pathname)
        const html = source.replace('<html lang="zh-CN">', `<html ${result.htmlAttrs}>`)
          .replace('<!--seo-head-->', result.head + '\n' + styles + '\n' + preload)
          .replace('<!--app-html-->', result.appHtml)
          .replace('<!--app-teleports-->', result.teleports || '')
          .replace('</body>', `<script id="vmct-content" type="application/json">${serialize(state)}</script>\n</body>`)
        return { html, status: result.status }
      })()
      if (cacheable) {
        htmlCache.set(key, pending)
        pending.catch(() => { if (htmlCache.get(key) === pending) htmlCache.delete(key) })
        if (htmlCache.size > 100) htmlCache.delete(htmlCache.keys().next().value)
        // The content repository rechecks the DB periodically; bound HTML age
        // too, for date-dependent branding and other time-sensitive UI.
        const timer = setTimeout(() => { if (htmlCache.get(key) === pending) htmlCache.delete(key) }, 60_000)
        timer.unref?.()
      }
    }
    const result = await pending
    return new Response(request.method === 'HEAD' ? null : result.html, { status: result.status, headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      ...(/^\/admin(?:\/|$)/.test(pathname) ? { 'Content-Security-Policy': `frame-ancestors 'self'${frameOrigin ? ' ' + new URL(frameOrigin).origin : ''}` } : {}),
    } })
  }
  return { handle, invalidate }
}
