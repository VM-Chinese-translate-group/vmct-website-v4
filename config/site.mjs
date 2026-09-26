export function resolveSiteConfig(env) {
  function origin(key, fallback) {
    const value = env[key]?.trim() || fallback
    const url = new URL(value)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(`${key} must be an HTTP(S) origin without a path, query or credentials`)
    }
    return url.origin
  }

  const siteUrl = origin('VITE_SITE_URL')
  return {
    siteUrl,
    apiBaseUrl: origin('VITE_API_BASE_URL', siteUrl),
    contentOrigin: origin('VITE_CONTENT_ORIGIN', siteUrl),
    docsUrl: origin('VITE_DOCS_URL'),
    dictUrl: origin('VITE_DICT_URL'),
    contactEmail: env.VITE_CONTACT_EMAIL?.trim() || '',
    enableBeian: env.VITE_ENABLE_BEIAN === 'true',
  }
}
