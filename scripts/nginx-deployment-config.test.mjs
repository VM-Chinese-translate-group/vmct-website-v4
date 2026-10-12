import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const template = fs.readFileSync(new URL('../server/nginx-www.vmct.top.conf', import.meta.url), 'utf8')
const deploy = fs.readFileSync(new URL('../server/deploy-ecs.sh', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const include = 'include /etc/nginx/conf.d/www-public-downloads.in[c];'

test('WWW template includes the optional download fragment once at server scope', () => {
  assert.equal(template.split(include).length - 1, 1)
  assert.ok(template.indexOf(include) < template.indexOf('location '))
  assert.ok(!template.includes('www-public-downloads*.inc'))
  // The WWW template must reference the container-mounted directory.
  assert.ok(!template.includes('include /home/vmct/nginx/'))
})

test('the optional glob tolerates first bootstrap and matches only the existing fragment', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vmct-nginx-include-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const pattern = path.posix.basename(include.slice('include '.length, -1))
  assert.deepEqual(fs.globSync(pattern, { cwd: directory }), [])
  const fragment = 'location ~ ^/(downloads|files|download-catalog)(/|$) { proxy_pass http://172.17.0.1:8080; }\n'
  fs.writeFileSync(path.join(directory, 'www-public-downloads.inc'), fragment)
  fs.writeFileSync(path.join(directory, 'www-public-downloads-backup.inc'), 'backup')
  fs.writeFileSync(path.join(directory, 'www-public-downloads.inc.bak'), 'backup')
  const matched = fs.globSync(pattern, { cwd: directory })
  assert.deepEqual(matched, ['www-public-downloads.inc'])
  assert.equal(fs.readFileSync(path.join(directory, matched[0]), 'utf8'), fragment)
})

test('the deployer updates WWW configs while preserving the separately managed fragment', () => {
  assert.match(deploy, /install -m 0644 server\/nginx-www\.vmct\.top\.conf "\$\{NGINX_CONF_DIR\}\/www\.vmct\.top\.conf"/)
  assert.match(deploy, /install -m 0644 "\$\{tls_tmp\}" "\$\{NGINX_CONF_DIR\}\/www\.vmct\.top\.ssl\.conf"/)
  assert.ok(!deploy.includes('www-public-downloads'))
  // Legacy WWW host cleanup must not match the shared download fragment.
  assert.match(deploy, /-name '\*www\.vmct\.top\*'/)
  assert.ok(!'www-public-downloads.inc'.includes('www.vmct.top'))
})

test('the actual TLS transformation retains the same optional download include', { skip: process.platform !== 'linux' }, () => {
  const start = deploy.indexOf('  awk -v cert=')
  const from = deploy.indexOf("'\n", start)
  const until = deploy.indexOf("' server/nginx-www.vmct.top.conf", from)
  assert.ok(start >= 0 && from > start && until > from)
  const awk = deploy.slice(from + 2, until)
  const result = spawnSync('awk', ['-v', 'cert=/fixture/fullchain.pem', '-v', 'key=/fixture/privkey.pem', awk],
    { input: template, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.split(include).length - 1, 1)
  assert.match(result.stdout, /listen 443 ssl;/)
  assert.match(result.stdout, /listen \[::\]:443 ssl;/)
  assert.match(result.stdout, /ssl_certificate \/fixture\/fullchain\.pem;/)
})

test('automatic website updates inherit API configuration before update-specific overrides', () => {
  const service = fs.readFileSync(new URL('../server/vmct-website-update.service', import.meta.url), 'utf8')
  const environmentFiles = service.split(/\r?\n/).filter(line => line.startsWith('EnvironmentFile='))
  assert.deepEqual(environmentFiles, [
    'EnvironmentFile=-/etc/vmct-website/api.env',
    'EnvironmentFile=-/etc/vmct-website/update.env',
  ])
})
