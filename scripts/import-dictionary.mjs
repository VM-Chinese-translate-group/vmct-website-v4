import fs from 'node:fs'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { DatabaseSync } from 'node:sqlite'

const input = process.argv[2]
const output = process.argv[3] || process.env.DICT_DB_PATH || '/var/lib/vmct-website/data/dictionary.sqlite'

if (!input) {
  console.error('用法：node scripts/import-dictionary.mjs <d1backup.sql> [dictionary.sqlite]')
  process.exit(1)
}

const inputPath = path.resolve(input)
const outputPath = path.resolve(output)
const totalBytes = fs.statSync(inputPath).size
const batchLimitBytes = 4 * 1024 * 1024
const batchLimitStatements = 5000
const startedAt = Date.now()

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KiB', 'MiB', 'GiB']
  let value = bytes / 1024
  let unit = units[0]
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024
    unit = units[index]
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${unit}`
}

function elapsedSeconds() {
  return Math.max(0.1, (Date.now() - startedAt) / 1000)
}

function showProgress(readBytes, statementCount, phase) {
  const percent = totalBytes ? Math.min(100, (readBytes / totalBytes) * 100) : 100
  const rate = readBytes / elapsedSeconds()
  process.stdout.write(
    `\r${phase} ${percent.toFixed(1)}% | ${formatBytes(readBytes)}/${formatBytes(totalBytes)} | ` +
      `${statementCount.toLocaleString()} 条 SQL | ${formatBytes(rate)}/s`,
  )
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
const database = new DatabaseSync(outputPath)
database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')

let readBytes = 0
let statementCount = 0
let lastProgressAt = 0
let batch = []
let batchBytes = 0

function flushBatch() {
  if (batch.length === 0) return
  database.exec(batch.join('\n'))
  statementCount += batch.length
  batch = []
  batchBytes = 0
  const now = Date.now()
  if (now - lastProgressAt >= 500 || readBytes >= totalBytes) {
    showProgress(readBytes, statementCount, '导入字典')
    lastProgressAt = now
  }
}

// Split the dump at semicolons while respecting SQL strings and comments. This
// lets us execute small batches and report progress without loading the whole
// 300+ MiB dump into memory or blocking on one giant database.exec() call.
let buffer = ''
let scanPosition = 0
let statementStart = 0
let state = 'normal'
let quote = ''

function scan(text) {
  buffer += text
  for (; scanPosition < buffer.length; scanPosition += 1) {
    const current = buffer[scanPosition]
    const next = buffer[scanPosition + 1]

    if (state === 'line-comment') {
      if (current === '\n') state = 'normal'
      continue
    }
    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        state = 'normal'
        scanPosition += 1
      }
      continue
    }
    if (state === 'quote') {
      if (current === quote) {
        if (next === quote) scanPosition += 1
        else state = 'normal'
      }
      continue
    }

    if (current === '-' && next === '-') {
      state = 'line-comment'
      scanPosition += 1
    } else if (current === '/' && next === '*') {
      state = 'block-comment'
      scanPosition += 1
    } else if (current === "'" || current === '"' || current === '`') {
      state = 'quote'
      quote = current
    } else if (current === '[') {
      state = 'quote'
      quote = ']'
    } else if (current === ';') {
      const statement = buffer.slice(statementStart, scanPosition + 1)
      batch.push(statement)
      batchBytes += Buffer.byteLength(statement)
      statementStart = scanPosition + 1
      if (batchBytes >= batchLimitBytes || batch.length >= batchLimitStatements) flushBatch()
    }
  }

  // Keep only the unfinished statement and adjust the scanner indexes. This
  // bounds memory usage even when the input is hundreds of megabytes.
  if (statementStart > 0) {
    buffer = buffer.slice(statementStart)
    scanPosition -= statementStart
    statementStart = 0
  }
}

try {
  console.log(`开始导入字典：${formatBytes(totalBytes)}，目标：${outputPath}`)
  const decoder = new StringDecoder('utf8')
  for await (const chunk of fs.createReadStream(inputPath)) {
    readBytes += chunk.length
    scan(decoder.write(chunk))
  }
  scan(decoder.end())

  const trailing = buffer.slice(statementStart).trim()
  if (trailing) {
    batch.push(trailing)
    batchBytes += Buffer.byteLength(trailing)
  }
  flushBatch()
  showProgress(totalBytes, statementCount, '导入字典')
  process.stdout.write('\n')
  console.log(`字典数据库已导入：${outputPath}（${elapsedSeconds().toFixed(1)} 秒）`)
} finally {
  database.close()
}
