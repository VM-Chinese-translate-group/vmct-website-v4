const APRIL_FOOLS_MONTH = 3
const APRIL_FOOLS_DAY = 1
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const SKIPPED_PAGE_PATTERN = /^\/(?:admin|agreement|privacy)(?:\/|$)/

export const SITE_LOGO_128 = '/imgs/logo/logo_128.png'
export const APRIL_FOOLS_FAVICON = '/imgs/logo/fool/favicon.ico'
export const APRIL_FOOLS_LOGO_128 = '/imgs/logo/fool/logo_128.png'
export const APRIL_FOOLS_LOGO_LONG = '/imgs/logo/fool/logo_long.png'

export function isAprilFoolsDay(date = new Date()) {
  return date.getMonth() === APRIL_FOOLS_MONTH && date.getDate() === APRIL_FOOLS_DAY
}

export function isAprilFoolsSkippedPath(path = '') {
  return SKIPPED_PAGE_PATTERN.test(path)
}

export function getAprilFoolsLogoPath(size: 128 | 256 | 512 | 'long' = 128) {
  return isAprilFoolsDay() ? `/imgs/logo/fool/logo_${size}.png` : `/imgs/logo/logo_${size}.png`
}

export function transformAprilFoolsText(value: string) {
  if (!isAprilFoolsDay() || !value.includes('VM')) return value

  const emails: string[] = []
  const masked = value.replace(EMAIL_PATTERN, (email) => {
    const marker = `__VM_EMAIL_${emails.length}__`
    emails.push(email)
    return marker
  })

  return emails.reduce(
    (text, email, index) => text.replace(`__YM_EMAIL_${index}__`, email),
    masked.replace(/VM/g, 'YM'),
  )
}

function shouldSkipNode(node: Node) {
  const parent = node.parentElement
  if (!parent) return true

  return Boolean(
    parent.closest(
      'script, style, textarea, input, select, option, code, pre, [data-april-fools-skip]',
    ),
  )
}

function syncTextNode(node: Text) {
  if (shouldSkipNode(node) || !node.nodeValue?.includes('VM')) return

  const transformed = transformAprilFoolsText(node.nodeValue)
  if (transformed !== node.nodeValue) node.nodeValue = transformed
}

function syncImageElement(img: HTMLImageElement) {
  for (const attr of ['src', 'data-src', 'lazy'] as const) {
    const value = img.getAttribute(attr)
    if (!value) continue

    const transformed = value
      .replace(/\/imgs\/logo\/logo_long\.png/g, APRIL_FOOLS_LOGO_LONG)
      .replace(/\/imgs\/logo\/logo_(?:64|128|256|512)\.png/g, APRIL_FOOLS_LOGO_128)
    if (transformed !== value) img.setAttribute(attr, transformed)
  }
}

function syncText(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()

  while (current) {
    syncTextNode(current as Text)
    current = walker.nextNode()
  }
}

function syncImages(root: ParentNode) {
  const images =
    root instanceof HTMLImageElement ? [root] : Array.from(root.querySelectorAll('img'))

  images.forEach(syncImageElement)
}

function syncHead() {
  const favicon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (favicon) favicon.href = APRIL_FOOLS_FAVICON
}

export function syncAprilFoolsBranding(path: string, root: ParentNode = document.body) {
  if (!isAprilFoolsDay() || isAprilFoolsSkippedPath(path)) return

  syncText(root)
  syncImages(root)
  syncHead()
}
