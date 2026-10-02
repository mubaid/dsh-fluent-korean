/**
 * Self-check for the test harness itself.
 *
 * `index.js` imports `@deepseek-ai/schemastery`, which cannot be installed here,
 * so `helpers/load-plugin.mjs` redirects it to a stub. If that redirect ever
 * breaks, every `index.js` test fails for a reason that has nothing to do with
 * the plugin. These tests load a fixture with the same import shape instead, so
 * a harness fault is reported separately from a missing implementation.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadPlugin } from './helpers/load-plugin.mjs'

const FIXTURE_URL = new URL('./fixtures/plugin/index.js', import.meta.url).href

describe('module-resolution stub', () => {
  it('loads a module that imports @deepseek-ai/schemastery as a bare specifier', async () => {
    // The whole point of the loader: without it this fixture cannot even import.
    const mod = await loadPlugin(FIXTURE_URL)

    assert.equal(mod.LOADED_FROM_FIXTURE, true)
    assert.notEqual(mod.Config, undefined)
  })

  it('lets the stub chain the builder methods a schema definition needs', async () => {
    const { Config } = await loadPlugin(FIXTURE_URL)

    // `Schema.object({...}).volatile()` must stay chainable; if the stub stopped
    // returning a node, the real index.js would throw at import time.
    assert.equal(typeof Config, 'function')
  })

  it('passes relative imports through untouched so lib/styles.js still resolves', async () => {
    // Deliberately NOT routed through the stub: this is the path the plugin's own
    // `import { styleBody } from './lib/styles.js'` takes.
    const { styleBody, STYLE_IDS } = await import('../lib/styles.js')

    assert.deepEqual(STYLE_IDS, ['fluent-korean', 'fluent-korean-not-coding'])
    assert.equal(typeof styleBody(STYLE_IDS[0]), 'string')
  })
})