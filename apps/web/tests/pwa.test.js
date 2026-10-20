import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const publicFile = (path) => new URL(`../public/${path}`, import.meta.url)
const bootstrap = readFileSync(publicFile('pwa.js'), 'utf8')
const worker = readFileSync(publicFile('sw.js'), 'utf8')

function browser({ secure = true, standalone = false } = {}) {
  const window = new EventTarget()
  const displayMode = Object.assign(new EventTarget(), { matches: standalone })
  const registrations = []
  window.matchMedia = () => displayMode
  window.isSecureContext = secure
  const navigator = {
    serviceWorker: {
      register: async (...args) => registrations.push(args),
    },
  }
  runInNewContext(bootstrap, { window, navigator, Event, console })
  return { window, registrations }
}

describe('PWA installation bootstrap', () => {
  test('retains the install event before React mounts, then clears it after installation', () => {
    const { window } = browser()
    const event = new Event('beforeinstallprompt', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(window.daisukiPwa.prompt).toBe(event)
    window.dispatchEvent(new Event('appinstalled'))
    expect(window.daisukiPwa.prompt).toBeNull()
    expect(window.daisukiPwa.installed).toBe(true)
  })

  test('recognizes an app opened in standalone mode', () => {
    expect(browser({ standalone: true }).window.daisukiPwa.installed).toBe(true)
  })

  test('registers the worker once on secure origins and never on insecure origins', () => {
    const secure = browser()
    secure.window.dispatchEvent(new Event('load'))
    secure.window.dispatchEvent(new Event('load'))
    expect(secure.registrations).toEqual([
      ['/sw.js', { scope: '/', updateViaCache: 'none' }],
    ])
    const insecure = browser({ secure: false })
    insecure.window.dispatchEvent(new Event('load'))
    expect(insecure.registrations).toEqual([])
  })
})

describe('PWA offline boundary', () => {
  function workerFetch() {
    const handlers = {}
    const self = {
      location: { origin: 'https://inventory.test' },
      addEventListener: (name, callback) => {
        handlers[name] = callback
      },
    }
    runInNewContext(worker, {
      self,
      URL,
      Response,
      fetch: async () => {
        throw new Error('offline')
      },
      caches: { match: async () => new Response('offline page') },
    })
    return handlers.fetch
  }

  test('does not intercept API requests, mutations, or cross-origin navigation', () => {
    const fetch = workerFetch()
    let intercepted = 0
    for (const request of [
      { method: 'GET', mode: 'cors', url: 'https://inventory.test/api/stocks' },
      { method: 'PUT', mode: 'cors', url: 'https://inventory.test/api/stocks' },
      { method: 'GET', mode: 'navigate', url: 'https://other.test/' },
    ]) {
      fetch({
        request,
        respondWith: () => {
          intercepted++
        },
      })
    }
    expect(intercepted).toBe(0)
  })

  test('serves an offline explanation when navigation fails', async () => {
    let response
    workerFetch()({
      request: {
        method: 'GET',
        mode: 'navigate',
        url: 'https://inventory.test/admin',
      },
      respondWith: (promise) => {
        response = promise
      },
    })
    expect(await (await response).text()).toBe('offline page')
  })
})

test('manifest provides standalone launch and valid 192px/512px PNG icons', () => {
  const manifest = JSON.parse(
    readFileSync(publicFile('manifest.webmanifest'), 'utf8'),
  )
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/login')
  expect(manifest.scope).toBe('/')
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((item) => item.sizes === `${size}x${size}`)
    const png = readFileSync(publicFile(icon.src.slice(1)))
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.readUInt32BE(16)).toBe(size)
    expect(png.readUInt32BE(20)).toBe(size)
  }
})
