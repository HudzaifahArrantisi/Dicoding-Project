import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type Role = 'admin' | 'mitra'
type Result = 'PASS' | 'FAIL' | 'SKIP'
type Route = { method: Method; path: string; source: string }
type Check = { result: Result; method: Method; path: string; probe: string; status?: number; ms?: number; detail?: string }
type Session = { cookie: string; role: Role }

const categories = [
  'Login & Sesi',
  'Admin · Dashboard & AI',
  'Admin · Mitra & Log',
  'Admin · Notifikasi',
  'Mitra · Asisten & Notifikasi',
  'Pesanan · Admin & Mitra',
  'Stok & Produk · Admin & Mitra',
  'Wilayah · Admin & Mitra',
  'Sistem & Berkas',
] as const
type Category = typeof categories[number]

const root = resolve(import.meta.dir, '..')
const apiSource = resolve(root, 'apps/api/src')
const args = process.argv.slice(2)

function option(name: string): string | undefined {
  const at = args.indexOf(name)
  return at < 0 ? undefined : args[at + 1]
}

function usage(): never {
  console.error('Gunakan: bun run qa:api [--base-url http://127.0.0.1:3001] [--timeout-ms 10000] [--fixtures path.json] [--json path.json]')
  process.exit(args.includes('--help') ? 0 : 2)
}

if (args.includes('--help')) usage()
const baseUrl = new URL(option('--base-url') ?? process.env.QA_API_BASE_URL ?? 'http://127.0.0.1:3001')
if (!['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname) || !['http:', 'https:'].includes(baseUrl.protocol)) {
  throw new Error('QA API hanya boleh diarahkan ke server lokal.')
}
const timeoutMs = Number(option('--timeout-ms') ?? 10_000)
if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) usage()
const fixturesPath = option('--fixtures')
const jsonPath = option('--json')
if (fixturesPath && fixturesPath.startsWith('--')) usage()
if (jsonPath && jsonPath.startsWith('--')) usage()

function endpoint(path: string): string {
  const prefix = baseUrl.pathname.replace(/\/$/, '')
  return `${baseUrl.origin}${prefix}${path}`
}

async function discoverRoutes(): Promise<Route[]> {
  const routes: Route[] = []
  for await (const entry of new Bun.Glob('**/*.ts').scan({ cwd: apiSource })) {
    const file = resolve(apiSource, entry)
    const source = await readFile(file, 'utf8')
    if (!source.includes('new Elysia')) continue
    const token = /new\s+Elysia\s*\(\s*(?:\{[^}]*?prefix\s*:\s*["']([^"']+)["'][^}]*\})?\s*\)|\.(get|post|put|patch|delete)\s*\(\s*["'](\/[^"']*)["']/g
    let prefix = ''
    for (const match of source.matchAll(token)) {
      if (match[2]) {
        const path = `${prefix}${match[3]}`.replace(/\/$/, '') || '/'
        routes.push({ method: match[2].toUpperCase() as Method, path, source: relative(root, file).replaceAll('\\', '/') })
      } else {
        prefix = match[1] ?? ''
      }
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}

async function request(path: string, init: RequestInit = {}): Promise<{ status: number; ms: number; detail: string; response: Response; json?: unknown }> {
  const start = performance.now()
  const response = await fetch(endpoint(path), { ...init, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' })
  const ms = Math.round(performance.now() - start)
  const body = await response.text()
  let detail = body.slice(0, 240).replace(/\s+/g, ' ')
  let json: unknown
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string }
    json = parsed
    detail = String(parsed.error ?? parsed.message ?? '').slice(0, 240)
  } catch { /* CSV and plain text responses are valid. */ }
  return { response, status: response.status, ms, detail, json }
}

async function login(role: Role): Promise<Session | null> {
  const upper = role.toUpperCase()
  const email = process.env[`QA_${upper}_EMAIL`]
  const password = process.env[`QA_${upper}_PASSWORD`]
  if (!email || !password) return null
  const { response, status, detail } = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (status !== 200) throw new Error(`Login ${role} gagal: HTTP ${status} ${detail}`)
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
  if (!cookie) throw new Error(`Login ${role} tidak mengirim cookie sesi.`)
  const profile = await request('/me', { headers: { cookie } })
  if (profile.status !== 200) throw new Error(`Sesi ${role} gagal diverifikasi: HTTP ${profile.status}.`)
  const data = profile.json as { user?: { role?: string } } | undefined
  if (data.user?.role !== role) throw new Error(`Akun QA_${upper}_EMAIL bukan akun ${role}.`)
  return { cookie, role }
}

function requiredRole(path: string): Role {
  if (path.startsWith('/assistant/') || path === '/notifications' || path === '/orders' || path === '/stocks/logs') return 'mitra'
  return 'admin'
}

function fixtureFor(route: Route, fixtures: Record<string, string>): string | null {
  const key = `${route.method} ${route.path}`
  const value = fixtures[key]
  if (!value || !value.startsWith('/') || value.includes(':') || value.includes('*')) return null
  const expected = new RegExp(`^${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[^/]+/g, '[^/]+').replace(/\\\*/g, '.+')}\\??(?:.*)?$`)
  return expected.test(value) ? value : null
}

function rows(value: unknown): Record<string, unknown>[] {
  const data = (value as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : []
}

function autoFixture(route: Route, responses: Record<string, unknown>): string | null {
  const partners = rows(responses['/admin/partners'])
  const orders = rows(responses['/orders'])
  if (route.path === '/admin/stock-logs/partners/:partnerId') {
    const id = partners.find((item) => typeof item.id === 'string')?.id
    return typeof id === 'string' ? `/admin/stock-logs/partners/${encodeURIComponent(id)}` : null
  }
  if (route.path === '/orders/:id/receipt-proof') {
    const id = orders.find((item) => typeof item.id === 'string')?.id
    return typeof id === 'string' ? `/orders/${encodeURIComponent(id)}/receipt-proof` : null
  }
  const regionField: Record<string, string> = {
    '/regions/regencies/:code': 'province_code',
    '/regions/districts/:code': 'regency_code',
    '/regions/villages/:code': 'district_code',
  }
  const field = regionField[route.path]
  if (field) {
    const code = partners.find((item) => typeof item[field] === 'string' && item[field])?.[field]
    return typeof code === 'string' ? route.path.replace(':code', encodeURIComponent(code)) : null
  }
  return null
}

function categoryFor(path: string): Category {
  if (path.startsWith('/auth/') || path === '/me' || path.startsWith('/me/')) return 'Login & Sesi'
  if (path.startsWith('/admin/ai-insights') || path === '/admin/metrics' || path === '/admin/weekly-summary') return 'Admin · Dashboard & AI'
  if (path.startsWith('/admin/')) return 'Admin · Mitra & Log'
  if (path === '/notification' || path.startsWith('/notification/')) return 'Admin · Notifikasi'
  if (path.startsWith('/assistant/') || path === '/notifications' || path.startsWith('/notifications/')) return 'Mitra · Asisten & Notifikasi'
  if (path === '/orders' || path.startsWith('/orders/')) return 'Pesanan · Admin & Mitra'
  if (path === '/stocks' || path.startsWith('/stocks/') || path === '/products' || path.startsWith('/products/')) return 'Stok & Produk · Admin & Mitra'
  if (path.startsWith('/regions/')) return 'Wilayah · Admin & Mitra'
  return 'Sistem & Berkas'
}

function counts(checks: Check[]) {
  return {
    pass: checks.filter((check) => check.result === 'PASS').length,
    fail: checks.filter((check) => check.result === 'FAIL').length,
    skip: checks.filter((check) => check.result === 'SKIP').length,
  }
}

function wrapCell(value: string, width: number): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line)
      line = ''
    }
    if (word.length > width) {
      if (line) lines.push(line)
      for (let start = 0; start < word.length; start += width) {
        const part = word.slice(start, start + width)
        if (part.length === width) lines.push(part)
        else line = part
      }
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line || !lines.length) lines.push(line)
  return lines
}

function table(headers: string[], rows: string[][], widths: number[]): string {
  const border = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`
  const render = (cells: string[]) => {
    const wrapped = cells.map((cell, index) => wrapCell(cell, widths[index]))
    const height = Math.max(...wrapped.map((cell) => cell.length))
    return Array.from({ length: height }, (_, line) =>
      `|${widths.map((width, index) => ` ${(wrapped[index][line] ?? '').padEnd(width)} `).join('|')}|`,
    ).join('\n')
  }
  return [border, render(headers), border, ...rows.map(render), border].join('\n')
}

function printReport(routes: Route[], checks: Check[]): Record<Category, ReturnType<typeof counts>> {
  const byCategory = Object.fromEntries(categories.map((category) => [category, counts(checks.filter((check) => categoryFor(check.path) === category))])) as Record<Category, ReturnType<typeof counts>>
  const categoryRows = categories.map((category) => {
    const count = routes.filter((route) => categoryFor(route.path) === category).length
    const result = byCategory[category]
    return [category, String(count), String(result.pass), String(result.fail), String(result.skip)]
  })
  const summary = counts(checks)
  console.log(`\nQA API | ${baseUrl.origin}${baseUrl.pathname} | ${routes.length} route`)
  console.log(table(['Fitur', 'Route', 'Lulus', 'Gagal', 'Skip'], categoryRows, [31, 5, 5, 5, 5]))
  for (const category of categories) {
    const entries = checks.filter((check) => categoryFor(check.path) === category)
    if (!entries.length) continue
    const result = byCategory[category]
    console.log(`\n${category} | Lulus ${result.pass} · Gagal ${result.fail} · Skip ${result.skip}`)
    const wide = (process.stdout.columns ?? 120) >= 110
    const widths = wide ? [5, 6, 35, 14, 4, 8, 26] : [5, 6, 18, 12, 4, 16]
    const headers = wide ? ['Hasil', 'Metode', 'Endpoint', 'Pengujian', 'HTTP', 'Waktu', 'Keterangan'] : ['Hasil', 'Metode', 'Endpoint', 'Pengujian', 'HTTP', 'Keterangan']
    const rows = entries.map((check) => wide
      ? [check.result, check.method, check.path, check.probe, String(check.status ?? '-'), check.ms === undefined ? '-' : `${check.ms}ms`, check.detail ?? '-']
      : [check.result, check.method, check.path, check.probe, String(check.status ?? '-'), check.detail ?? (check.ms === undefined ? '-' : `${check.ms} ms`)])
    console.log(table(headers, rows, widths))
  }
  console.log(`\nTotal: ${summary.pass} lulus · ${summary.fail} gagal · ${summary.skip} belum diuji`)
  return byCategory
}

async function main(): Promise<void> {
  const routes = await discoverRoutes()
  if (!routes.length) throw new Error('Tidak ada route Elysia yang terdeteksi.')
  const fixtures = fixturesPath ? JSON.parse(await readFile(resolve(root, fixturesPath), 'utf8')) as Record<string, string> : {}
  const checks: Check[] = []
  let reachable = false
  try {
    const health = await request('/health')
    reachable = health.status === 200
    checks.push({ result: reachable ? 'PASS' : 'FAIL', method: 'GET', path: '/health', probe: 'koneksi', status: health.status, ms: health.ms, detail: health.detail })
  } catch (error) {
    checks.push({ result: 'FAIL', method: 'GET', path: '/health', probe: 'koneksi', detail: error instanceof Error ? error.message : String(error) })
  }
  const sessions: Partial<Record<Role, Session>> = {}
  if (reachable) {
    for (const role of ['admin', 'mitra'] as const) {
      try {
        const session = await login(role)
        if (session) {
          sessions[role] = session
          checks.push({ result: 'PASS', method: 'POST', path: '/auth/login', probe: `login ${role}`, status: 200 })
        }
      } catch (error) {
        checks.push({ result: 'FAIL', method: 'POST', path: '/auth/login', probe: `login ${role}`, detail: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  const responses: Record<string, unknown> = {}
  const orderedRoutes = [...routes].sort((a, b) => Number(a.path.includes(':') || a.path.includes('*')) - Number(b.path.includes(':') || b.path.includes('*')))
  for (const route of orderedRoutes) {
    if (route.path === '/health' && route.method === 'GET') continue
    if (route.method !== 'GET') {
      if (route.path === '/auth/login' && Object.keys(sessions).length) continue
      checks.push({ result: 'SKIP', ...route, probe: 'mutasi', detail: 'Tidak dijalankan agar data development tidak berubah.' })
      continue
    }
    if (route.path === '/events') {
      if (reachable) {
        try {
          const anonymous = await request('/events')
          checks.push({ result: anonymous.status === 401 ? 'PASS' : 'FAIL', ...route, probe: 'tanpa login', status: anonymous.status, ms: anonymous.ms, detail: anonymous.status === 401 ? undefined : `Diharapkan HTTP 401. ${anonymous.detail}` })
        } catch (error) {
          checks.push({ result: 'FAIL', ...route, probe: 'tanpa login', detail: error instanceof Error ? error.message : String(error) })
        }
      }
      checks.push({ result: 'SKIP', ...route, probe: 'stream', detail: 'SSE berlangsung terus; perlu pemeriksaan terpisah.' })
      continue
    }
    const path = route.path.includes(':') || route.path.includes('*') ? fixtureFor(route, fixtures) ?? autoFixture(route, responses) : route.path
    if (!path) {
      if (route.path === '/uploads/*' && reachable) {
        try {
          const anonymous = await request('/uploads/receipts/qa-missing.jpg')
          checks.push({ result: anonymous.status === 401 ? 'PASS' : 'FAIL', ...route, probe: 'tanpa login', status: anonymous.status, ms: anonymous.ms, detail: anonymous.status === 401 ? undefined : `Diharapkan HTTP 401. ${anonymous.detail}` })
        } catch (error) {
          checks.push({ result: 'FAIL', ...route, probe: 'tanpa login', detail: error instanceof Error ? error.message : String(error) })
        }
      }
      checks.push({ result: 'SKIP', ...route, probe: 'data', detail: `Butuh fixture URL konkret untuk ${route.method} ${route.path}.` })
      continue
    }
    if (!reachable) {
      checks.push({ result: 'SKIP', ...route, probe: 'koneksi', detail: 'Server API tidak terjangkau.' })
      continue
    }
    try {
      const anonymous = await request(path)
      const expected = route.path === '/health' ? 200 : 401
      checks.push({ result: anonymous.status === expected ? 'PASS' : 'FAIL', ...route, probe: 'tanpa login', status: anonymous.status, ms: anonymous.ms, detail: anonymous.status === expected ? undefined : `Diharapkan HTTP ${expected}. ${anonymous.detail}` })
    } catch (error) {
      checks.push({ result: 'FAIL', ...route, probe: 'tanpa login', detail: error instanceof Error ? error.message : String(error) })
    }
    const role = requiredRole(route.path)
    const session = sessions[role]
    if (!session) {
      checks.push({ result: 'SKIP', ...route, probe: `login ${role}`, detail: `Isi QA_${role.toUpperCase()}_EMAIL dan QA_${role.toUpperCase()}_PASSWORD.` })
      continue
    }
    try {
      const actual = await request(path, { headers: { cookie: session.cookie } })
      checks.push({ result: actual.status >= 200 && actual.status < 300 ? 'PASS' : 'FAIL', ...route, probe: `login ${role}`, status: actual.status, ms: actual.ms, detail: actual.status >= 200 && actual.status < 300 ? undefined : actual.detail })
      if (actual.status >= 200 && actual.status < 300) responses[route.path] = actual.json
    } catch (error) {
      checks.push({ result: 'FAIL', ...route, probe: `login ${role}`, detail: error instanceof Error ? error.message : String(error) })
    }
  }

  const summary = counts(checks)
  const summaryByCategory = printReport(routes, checks)
  if (jsonPath) {
    const output = resolve(root, jsonPath)
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, JSON.stringify({ generated_at: new Date().toISOString(), base_url: `${baseUrl.origin}${baseUrl.pathname}`, routes, checks: checks.map((check) => ({ ...check, category: categoryFor(check.path) })), summary, summary_by_category: summaryByCategory }, null, 2) + '\n')
    console.log(`Laporan JSON: ${output}`)
  }
  if (summary.fail) process.exitCode = 1
}

await main()
