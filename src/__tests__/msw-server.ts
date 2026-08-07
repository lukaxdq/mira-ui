import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const server = setupServer(
  http.get('*/observer/status', () => HttpResponse.json({ active: false, message: 'no session' })),
  http.get('*/auth/status', () =>
    HttpResponse.json({ required: false, url: null, loading: false }),
  ),
  http.get('*/bluetooth/pairing', () => HttpResponse.json({ pending: false })),
  http.get('*/bluetooth/known', () => HttpResponse.json([])),
  http.post('*/bluetooth/discover/*', () => HttpResponse.json({})),
  http.post('*/bluetooth/network/*', () => HttpResponse.json({})),
  // the settings store PUTs on a 400ms debounce; without these any test that lets a
  // timer run trips onUnhandledRequest: 'error' with a confusing failure
  http.get('*/settings', () => HttpResponse.json({ v: 1 })),
  http.put('*/settings', () => HttpResponse.json({ ok: true })),
  // timezone auto-detection IP providers (SettingsSheet + ClockScreen fire this on
  // mount; UTC keeps the response deterministic and isolated from the real network)
  http.get('https://ipapi.co/json/', () => HttpResponse.json({ timezone: 'UTC' })),
  http.get('https://get.geojs.io/v1/ip/geo.json', () =>
    HttpResponse.json({ timezone: 'UTC' }),
  ),
  http.get('https://ipwho.is/', () => HttpResponse.json({ timezone: { id: 'UTC' } })),
)
