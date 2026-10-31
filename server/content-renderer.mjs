import MarkdownIt from 'markdown-it'
import { parse as parseYaml } from 'yaml'
import { parse as parseSfc, babelParse } from 'vue/compiler-sfc'
import { container } from '@mdit/plugin-container'
import { imgSize } from '@mdit/plugin-img-size'
import anchor from 'markdown-it-anchor'
import toc from 'markdown-it-table-of-contents'
import Shiki from '@shikijs/markdown-it'
import Card from '../src/components/Card/card.js'

// Content is data. Parse the supported component literals without compiling or
// evaluating a Vue template supplied by the CMS.
const componentProps = {
  DownloadLinks: ['methods'],
  DocSupport: [],
  DonateLayout: [],
  JoinGroupCard: ['title', 'applyLink', 'responsibilities', 'requirements'],
  Card: ['title', 'desc', 'logo', 'link'],
}
const htmlTags = new Set(('a abbr article aside b blockquote br caption code col colgroup dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img input kbd li main mark ol p pre s section small span strong sub summary sup table tbody td th thead time tr u ul').split(' '))
const voidTags = new Set(['br', 'col', 'hr', 'img', 'input'])
const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'svg', 'math', 'template'])
const blockTags = new Set('article aside blockquote details div dl figure figcaption h1 h2 h3 h4 h5 h6 hr main ol p pre section table ul'.split(' '))

export function normalizePagePath(value) {
  let result
  try { result = decodeURIComponent(String(value || '/')) } catch { return null }
  result = result.replace(/^\/+|\/+$/g, '').replace(/\/index$/, '')
  if (result === 'index') result = ''
  if (result.includes('..') || (result && !/^[\p{L}\p{N}._/-]+$/u.test(result))) return null
  return '/' + result
}

export function pageMetadata(frontmatter) {
  const parsed = parseYaml(String(frontmatter || ''), { maxAliasCount: 20 })
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

export function contentExcerpt(body) {
  return String(body || '')
    .replace(/(^|\n)[ \t]*(`{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, '\n')
    .replace(/`+[^`\n]+`+/g, '')
    .replace(/:::[\s\S]*?:::/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[#*`>_\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500)
}

function safeUrl(value) {
  if (typeof value !== 'string') return ''
  const compact = value.replace(/[\u0000-\u0020\u007f]/g, '')
  if (/^(?:https?:|mailto:|tel:)/i.test(compact)) return value
  if (!/^[a-z][a-z\d+.-]*:/i.test(compact) && !compact.startsWith('//') && !compact.includes('\\')) return value
  return ''
}

function literal(node) {
  if (!node) return null
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value
  if (node.type === 'NullLiteral') return null
  if (node.type === 'ArrayExpression') return node.elements.map(literal)
  if (node.type === 'ObjectExpression') {
    const result = Object.create(null)
    for (const property of node.properties) {
      if (property.type !== 'ObjectProperty' || property.computed || property.shorthand) throw new Error('组件属性只支持静态数据')
      const key = property.key.name ?? property.key.value
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('组件属性名称无效')
      result[key] = literal(property.value)
    }
    return result
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'NumericLiteral') return -node.argument.value
  throw new Error('组件属性只支持字符串、数字、数组和对象')
}

function readLiteral(source) {
  const ast = babelParse(`(${source})`)
  if (ast.program.body.length !== 1 || ast.program.body[0].type !== 'ExpressionStatement') throw new Error('组件属性必须是静态数据')
  return literal(ast.program.body[0].expression)
}

function camelCase(value) { return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase()) }

function safeComponentProps(tag, properties) {
  const result = {}
  for (const property of properties) {
    if (property.type === 6) {
      const name = camelCase(property.name)
      if (componentProps[tag].includes(name)) result[name] = property.value?.content || ''
    } else if (property.type === 7 && property.name === 'bind' && property.exp) {
      const value = readLiteral(property.exp.content)
      if (!property.arg) {
        for (const [key, item] of Object.entries(value || {}))
          if (componentProps[tag].includes(key)) result[key] = item
      } else if (property.arg.isStatic) {
        const name = camelCase(property.arg.content)
        if (componentProps[tag].includes(name)) result[name] = value
      }
    }
  }
  for (const name of ['link', 'logo', 'applyLink']) if (name in result) result[name] = safeUrl(result[name])
  if ('methods' in result) {
    if (!Array.isArray(result.methods)) throw new Error('下载方式必须是数组')
    result.methods = result.methods.map(method => Object.fromEntries(
      Object.entries(method || {}).filter(([key, value]) => typeof value === 'string' && !/^on/i.test(key))
        .map(([key, value]) => [key, /link$|^icon$/i.test(key) ? safeUrl(value) : value]),
    ))
  }
  for (const name of ['responsibilities', 'requirements']) {
    if (name in result && (!Array.isArray(result[name]) || result[name].some(item => typeof item !== 'string')))
      throw new Error('社区卡片列表必须是字符串数组')
  }
  return result
}

function htmlProperties(properties) {
  const result = {}
  for (const property of properties) {
    if (property.type !== 6) continue
    const name = property.name.toLowerCase()
    const value = property.value?.content || ''
    if (['href', 'src'].includes(name)) result[name] = safeUrl(value)
    else if (name === 'style') {
      result.style = value.split(';').filter(declaration =>
        /^\s*(?:--shiki-[\w-]+|color|background-color|text-align|font-style|font-weight|text-decoration|width|height|max-width)\s*:[\w\s#(),.%+-]+$/i.test(declaration)).join(';')
    } else if (/^(?:class|id|title|alt|width|height|loading|decoding|fetchpriority|target|rel|colspan|rowspan|open|start|reversed|type|disabled|checked|card-grid|role|tabindex)$/.test(name) || /^(?:aria|data)-[\w-]+$/.test(name)) {
      result[name] = ['open', 'reversed', 'disabled', 'checked'].includes(name) ? true : value
    }
  }
  if (result.target === '_blank') result.rel = 'noopener noreferrer'
  if (result.type && result.type !== 'checkbox') delete result.type
  return result
}

function paragraphNodes(props, children) {
  const isBlock = node => typeof node !== 'string' && (blockTags.has(node.tag) || Object.hasOwn(componentProps, node.tag))
  if (!children.some(isBlock)) return [{ tag: 'p', props, children }]
  // Markdown treats a multiline custom tag as inline HTML. The component can
  // render a section/div, which browsers move outside <p> before hydration.
  // Split those paragraphs explicitly so server and browser keep one tree.
  const result = []
  let inline = []
  const flush = () => {
    if (inline.some(node => typeof node !== 'string' || node.trim())) result.push({ tag: 'p', props, children: inline })
    inline = []
  }
  for (const child of children) {
    if (isBlock(child)) { flush(); result.push(child) }
    else inline.push(child)
  }
  flush()
  return result
}

function toNodes(children) {
  return children.flatMap(node => {
    if (node.type === 2) return [node.content]
    if (node.type === 5) return ['{{' + node.content.content + '}}']
    if (node.type !== 1) return []
    const tag = node.tag
    // Layout selection comes from the page kind, not from a compiled template.
    if (['DocLayout', 'DownloadLayout'].includes(tag)) return toNodes(node.children)
    if (Object.hasOwn(componentProps, tag)) return [{ tag, props: safeComponentProps(tag, node.props), children: toNodes(node.children) }]
    const lower = tag.toLowerCase()
    if (blockedTags.has(lower)) return []
    if (!htmlTags.has(lower)) return toNodes(node.children)
    const props = htmlProperties(node.props)
    if (lower === 'input') { props.type = 'checkbox'; props.disabled = true }
    const children = toNodes(node.children)
    if (lower === 'p') return paragraphNodes(props, children)
    return [{ tag: lower, props, ...(voidTags.has(lower) ? {} : { children }) }]
  })
}

let markdown
async function getMarkdown() {
  return markdown ||= (async () => {
    const md = new MarkdownIt({ html: true, linkify: true })
    md.use(anchor, { permalink: anchor.permalink.ariaHidden({ placement: 'before', symbol: '#', class: 'header-anchor' }) })
    md.use(toc, { includeLevel: [2, 3], containerClass: 'markdown-toc' })
    md.use(await Shiki({ themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false, langs: ['json', 'toml'] }))
    md.use(Card)
    md.use(imgSize)
    const image = md.renderer.rules.image
    md.renderer.rules.image = (tokens, index, options, env, self) => {
      tokens[index].attrSet('data-md-image-preview', 'true')
      return `<span class="image-loading-frame markdown-image-loading-frame">${image ? image(tokens, index, options, env, self) : self.renderToken(tokens, index, options)}</span>`
    }
    const link = md.renderer.rules.link_open
    md.renderer.rules.link_open = (tokens, index, options, env, self) => {
      if (/^https?:\/\//.test(tokens[index].attrGet('href') || '')) {
        tokens[index].attrSet('target', '_blank')
        tokens[index].attrSet('rel', 'noopener noreferrer')
      }
      return link ? link(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
    }
    for (const type of ['tip', 'warning', 'info', 'details']) md.use(container, {
      name: type,
      openRenderer: (tokens, index) => {
        const info = tokens[index].info
        const title = md.utils.escapeHtml(info.length > type.length ? info.slice(type.length + 1) : type.toUpperCase())
        return type === 'details' ? `<details class="custom-block details"><summary>${title}</summary>\n`
          : `<div class="custom-block ${type}"><p class="custom-block-title">${title}</p>\n`
      },
      closeRenderer: () => type === 'details' ? '</details>\n' : '</div>\n',
    })
    return md
  })()
}

export async function renderContent(page) {
  const md = await getMarkdown()
  // Removing only the historical wrappers before Markdown parsing also keeps
  // headings immediately inside them in the normal Markdown block grammar.
  const source = page.body.replace(/<\/?(?:DocLayout|DownloadLayout)\b[^>]*>/g, '')
  const html = md.render(source)
  const parsed = parseSfc(`<template>${html}</template>`, { filename: 'cms-content.vue' })
  if (parsed.errors.length) throw new Error('Markdown 组件格式无效：' + parsed.errors.map(error => error.message || error).join('; '))
  return toNodes(parsed.descriptor.template?.ast?.children || [])
}
