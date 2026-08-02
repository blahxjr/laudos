import assert from 'node:assert/strict'
import test from 'node:test'
import viteConfig from '../vite.config.ts'

test('Vite dev server proxies service-order and communications routes to the backend', () => {
  const proxy = viteConfig.server?.proxy
  assert.ok(proxy, 'expected Vite proxy configuration to exist')

  const proxyEntries = Object.entries(proxy)
  const hasServiceOrdersProxy = proxyEntries.some(([path]) => path === '/service-orders')
  const hasCommunicationsProxy = proxyEntries.some(([path]) => path === '/communications')
  const hasServicesProxy = proxyEntries.some(([path]) => path === '/services')
  const hasPartsProxy = proxyEntries.some(([path]) => path === '/parts')
  const hasSettingsProxy = proxyEntries.some(([path]) => path === '/settings/whatsapp')

  assert.equal(hasServiceOrdersProxy, true, 'expected /service-orders to be proxied')
  assert.equal(hasCommunicationsProxy, true, 'expected /communications to be proxied')
  assert.equal(hasServicesProxy, true, 'expected /services to be proxied')
  assert.equal(hasPartsProxy, true, 'expected /parts to be proxied')
  assert.equal(hasSettingsProxy, true, 'expected /settings/whatsapp to be proxied')
})
