// Requires Docker, Node.js 20+, and a locally available nginx:alpine image.
// Runs the real production config with a stub backend in an isolated container.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const name = `semesti-nginx-test-${randomUUID()}`
const fixture = mkdtempSync(join(tmpdir(), 'semesti-nginx-test-'))
const config = fileURLToPath(new URL('../nginx.conf', import.meta.url))
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim()
let networkCreated = false
let containerStarted = false

try {
  mkdirSync(join(fixture, 'html', 'assets'), { recursive: true })
  writeFileSync(join(fixture, 'html', 'index.html'), '<!doctype html><title>Test app</title>')
  writeFileSync(join(fixture, 'html', 'assets', 'test.js'), 'console.log("test")')
  writeFileSync(join(fixture, 'backend.conf'), `server {
    listen 4000;
    location /api/ { return 200 "$http_x_forwarded_proto"; }
  }`)
  docker('network', 'create', name)
  networkCreated = true
  docker('run', '--detach', '--rm', '--pull=never', '--name', name,
    '--network', name, '--network-alias', 'backend', '--publish', '127.0.0.1::3000',
    '--mount', `type=bind,source=${config},target=/etc/nginx/conf.d/default.conf,readonly`,
    '--mount', `type=bind,source=${join(fixture, 'backend.conf')},target=/etc/nginx/conf.d/backend.conf,readonly`,
    '--mount', `type=bind,source=${join(fixture, 'html')},target=/usr/share/nginx/html,readonly`,
    'nginx:alpine')
  containerStarted = true
  docker('exec', name, 'nginx', '-t')
  const baseUrl = `http://${docker('port', name, '3000/tcp')}`

  async function check(path, proto, status, location = null, method = 'GET') {
    const headers = { Host: 'semesti.plani.dev' }
    if (proto) headers['X-Forwarded-Proto'] = proto
    const response = await new Promise((resolve, reject) => {
      const req = request(`${baseUrl}${path}`, { headers, method }, (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.setTimeout(5000, () => req.destroy(new Error('Request timed out')))
      req.end()
    })
    const label = `${method} ${path} (${proto || 'local HTTP'})`
    assert.equal(response.status, status, label)
    assert.equal(response.headers.location ?? null, location, `${label}: redirect`)
    assert.equal(response.headers['strict-transport-security'], undefined,
      `${label}: HSTS is managed by Cloudflare`)
    console.log(`PASS ${label}`)
    return response.body
  }

  await check('/', null, 200)
  await check('/stundenplan', null, 200)
  await check('/share/example?next=%2F', 'http', 200)
  assert.equal(await check('/api/plans', 'http', 200, null, 'POST'), 'http')
  await check('/', 'https', 200)
  await check('/api?query=one', 'https', 308, '/api/?query=one')
  await check('/api?query=one', 'http', 308, '/api/?query=one')
  await check('/api', null, 308, '/api/')
  assert.equal(await check('/api/echo', 'https', 200), 'https')
  assert.equal(await check('/api/echo', null, 200), 'http')
  await check('/assets/test.js', 'https', 200)
  await check('/assets/missing.js', 'https', 404)
  await check('/assets/test.js', null, 200)
} finally {
  if (containerStarted) docker('stop', name)
  if (networkCreated) docker('network', 'rm', name)
  rmSync(fixture, { recursive: true, force: true })
}
