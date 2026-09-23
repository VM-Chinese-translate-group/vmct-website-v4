import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const root = process.cwd()
const sourcePath = path.join(root, 'functions', 'api', 'content', '[[path]].ts')
const outputDir = path.join(root, 'server', 'generated')
const outputPath = path.join(outputDir, 'content-api.mjs')

const source = await fs.readFile(sourcePath, 'utf8')
const result = ts.transpileModule(source, {
  fileName: sourcePath,
  compilerOptions: {
    // Numeric enum values keep this script compatible with TypeScript 6/7,
    // whose runtime package exports differ across distributions.
    target: 9, // ScriptTarget.ES2022
    module: 99, // ModuleKind.ESNext
    sourceMap: false,
  },
})

if (result.diagnostics?.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) {
  throw new Error('CMS API TypeScript 编译失败')
}

await fs.mkdir(outputDir, { recursive: true })
await fs.writeFile(outputPath, result.outputText, 'utf8')
console.log(`CMS API 已编译：${path.relative(root, outputPath)}`)
