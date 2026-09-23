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
const stagingPath = `${outputPath}.importing-${process.pid}`
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
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(stagingPath + suffix, { force: true })
}
const database = new DatabaseSync(stagingPath)
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

function triggerBodyIsOpen(sql) {
  const tokens = []
  let token = ''
  let mode = 'normal'
  let stringQuote = ''
  const pushToken = () => {
    if (token) tokens.push(token.toUpperCase())
    token = ''
  }

  for (let index = 0; index < sql.length; index += 1) {
    const current = sql[index]
    const next = sql[index + 1]
    if (mode === 'line-comment') {
      if (current === '\n') mode = 'normal'
      continue
    }
    if (mode === 'block-comment') {
      if (current === '*' && next === '/') {
        mode = 'normal'
        index += 1
      }
      continue
    }
    if (mode === 'string') {
      if (current === stringQuote) {
        if (next === stringQuote) index += 1
        else mode = 'normal'
      }
      continue
    }
    if (current === '-' && next === '-') {
      pushToken()
      mode = 'line-comment'
      index += 1
    } else if (current === '/' && next === '*') {
      pushToken()
      mode = 'block-comment'
      index += 1
    } else if (current === "'" || current === '"' || current === '`') {
      pushToken()
      mode = 'string'
      stringQuote = current
    } else if (/[A-Za-z_]/.test(current)) {
      token += current
    } else {
      pushToken()
    }
  }
  pushToken()

  const isTrigger =
    tokens[0] === 'CREATE' &&
    (tokens[1] === 'TRIGGER' ||
      ((tokens[1] === 'TEMP' || tokens[1] === 'TEMPORARY') && tokens[2] === 'TRIGGER'))
  if (!isTrigger) return false

  const beginIndex = tokens.indexOf('BEGIN')
  if (beginIndex < 0) return false
  let triggerDepth = 0
  let caseDepth = 0
  for (const tokenValue of tokens.slice(beginIndex)) {
    if (tokenValue === 'CASE') caseDepth += 1
    else if (tokenValue === 'BEGIN') triggerDepth += 1
    else if (tokenValue === 'END') {
      if (caseDepth > 0) caseDepth -= 1
      else triggerDepth -= 1
    }
  }
  return triggerDepth > 0
}

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
      // SQLite triggers contain a BEGIN ... END block with semicolons inside
      // it. Keep those inner semicolons in one statement; splitting them
      // causes later trigger statements to fail with misleading missing-table
      // errors.
      if (triggerBodyIsOpen(buffer.slice(statementStart, scanPosition + 1))) continue
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

let completed = false
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
  // Consolidate the WAL before replacing the previous database file.
  database.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;')
  completed = true
} finally {
  database.close()
  if (completed) {
    for (const suffix of ['-wal', '-shm']) {
      fs.rmSync(outputPath + suffix, { force: true })
      const stagedSidecar = stagingPath + suffix
      if (fs.existsSync(stagedSidecar)) fs.renameSync(stagedSidecar, outputPath + suffix)
    }
    fs.renameSync(stagingPath, outputPath)
    console.log(`字典数据库已导入：${outputPath}（${elapsedSeconds().toFixed(1)} 秒）`)
  } else {
    console.error(`导入未完成，临时文件保留为：${stagingPath}`)
  }
}
