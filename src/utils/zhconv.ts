const customDict: [string, string][] = [
  ['整合包', '模組包'],
  ['配置', '設定'],
  ['服務端', '伺服端'],
]

let converterPromise: Promise<(text: string) => string> | null = null

function getConverter() {
  // Many resource labels request conversion together. Share initialization as
  // well as the loaded modules so the dictionary trie is only built once.
  converterPromise ??= Promise.all([import('opencc-js/core'), import('opencc-js/preset/cn2t')])
    .then(([{ ConverterBuilder, CustomConverter }, cn2tPreset]) => {
      const baseConverter = ConverterBuilder(cn2tPreset)({ from: 'cn', to: 'twp' })
      const customConverter = CustomConverter(customDict)
      return (text: string) => customConverter(baseConverter(text))
    })
    .catch((error) => {
      converterPromise = null
      throw error
    })
  return converterPromise
}

const cache = new Map<string, string>()
const preservedText = new Map<string, string>()
const latinTokenPattern = /[A-Za-z][A-Za-z0-9_+.-]*/g

function preserveLatinTokens(text: string) {
  let index = 0
  const tokens: string[] = []
  const escaped = text.replace(latinTokenPattern, (token) => {
    const placeholder = `\uE000${index++}\uE001`
    tokens.push(token)
    return placeholder
  })

  return { escaped, tokens }
}

function restoreLatinTokens(text: string, tokens: string[]) {
  return text.replace(/\uE000(\d+)\uE001/g, (_, rawIndex) => tokens[Number(rawIndex)] ?? '')
}

function convertText(converter: (text: string) => string, text: string) {
  const { escaped, tokens } = preserveLatinTokens(text)
  return restoreLatinTokens(converter(escaped), tokens)
}

export async function convertInlineText(text: string, locale: string): Promise<string> {
  if (!text || locale !== 'zh-TW') return text

  const key = locale + text
  if (cache.has(key)) return cache.get(key)!

  const converter = await getConverter()
  const result = convertText(converter, text)
  cache.set(key, result)
  return result
}

interface ConvertedText {
  converted: string
  source: string
}

const originalTextMap = new WeakMap<Text, ConvertedText>()
const containerConversionVersions = new WeakMap<Element, number>()

function shouldConvertTextNode(node: Text) {
  const value = node.nodeValue
  if (!value?.trim()) return false

  const parent = node.parentElement
  if (!parent) return true

  return !parent.closest('script, style, noscript')
}

function getTextNodes(root: Element) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return shouldConvertTextNode(node as Text)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    nodes.push(node as Text)
  }

  return nodes
}

export async function convertMarkdownContainers(targetLocale: string, root?: HTMLElement) {
  const containers = Array.from(root ? [root] : document.querySelectorAll('.markdown-body'))

  if (!containers.length) return

  const requests = containers.map((container) => {
    const version = (containerConversionVersions.get(container) || 0) + 1
    containerConversionVersions.set(container, version)
    return { container, version }
  })

  if (targetLocale === 'zh-TW') {
    const converter = await getConverter()

    requests.forEach(({ container, version }) => {
      if (containerConversionVersions.get(container) !== version) return

      for (const textNode of getTextNodes(container)) {
        const current = textNode.nodeValue || ''
        const source =
          originalTextMap.get(textNode)?.source || preservedText.get(current) || current
        const converted = convertText(converter, source)

        originalTextMap.set(textNode, { source, converted })
        preservedText.set(converted, source)
        textNode.nodeValue = converted
      }
    })
  } else {
    requests.forEach(({ container, version }) => {
      if (containerConversionVersions.get(container) !== version) return

      for (const textNode of getTextNodes(container)) {
        const original = originalTextMap.get(textNode)

        if (original) {
          textNode.nodeValue = original.source
          originalTextMap.delete(textNode)
        }
      }
    })
  }
}
