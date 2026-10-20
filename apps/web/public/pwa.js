// Capture the browser event before React hydrates or the login route mounts.
;(() => {
  const standalone = window.matchMedia('(display-mode: standalone)')
  const state = {
    prompt: null,
    installed: standalone.matches || navigator.standalone === true,
  }
  window.daisukiPwa = state
  const notify = () => window.dispatchEvent(new Event('daisuki:pwa-change'))

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    state.prompt = event
    state.installed = false
    notify()
  })

  window.addEventListener('appinstalled', () => {
    state.prompt = null
    state.installed = true
    notify()
  })

  standalone.addEventListener('change', (event) => {
    if (event.matches) {
      state.prompt = null
      state.installed = true
      notify()
    }
  })

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener(
      'load',
      () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/', updateViaCache: 'none' })
          .catch((error) =>
            console.warn('Service worker Daisuki belum terdaftar:', error),
          )
      },
      { once: true },
    )
  }
})()
