/**
 * Tests for `index.js` — the plugin's exported surface, `resolveText`, and what
 * `apply()` actually registers with the harness.
 *
 * Import strategy
 * ---------------
 * `index.js` imports `@deepseek-ai/schemastery`, which cannot be installed in
 * this repo. Rather than degrade to grepping the source as text — which can only
 * show that the code *looks* right, never that it behaves that way — these tests
 * load the module for real through a `node:module` resolve hook that redirects
 * the bare specifier to `test/stubs/schemastery.mjs`. See
 * `helpers/load-plugin.mjs`. The loader's own soundness is covered separately by
 * `loader.test.mjs`, so a harness fault here is never mistaken for a plugin bug.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { before, describe, it } from 'node:test'

import { loadPlugin } from './helpers/load-plugin.mjs'
import { DEFAULT_STYLE_ID, SECTION, STYLE_IDS, styleBody } from '../lib/styles.js'

const ENTRY_PATH = fileURLToPath(new URL('../index.js', import.meta.url))

/** The plugin, loaded through the stubbed loader. */
let plugin

/**
 * Sentinel order for every section row *except* the one the plugin anchors on.
 * Distinct from 0 so the `order === 10` assertion proves which row was asked for.
 */
const UNRELATED_SECTION_ORDER = 999

/**
 * Mount the plugin against a fake `ctx` and capture what it registers.
 *
 * `config` is passed by reference on purpose: Cordis hands plugins a live config
 * object, and several guarantees below depend on `text()` re-reading it.
 */
function mount(config) {
  const sections = []
  const orders = []
  const effectLabels = []

  const ctx = {
    effect(fn, label) {
      effectLabels.push(label)
      const dispose = fn()
      return dispose
    },
    systemPrompt: {
      section(definition) {
        sections.push(definition)
        return () => {
          const at = sections.indexOf(definition)
          if (at !== -1) sections.splice(at, 1)
        }
      },
      getSectionOrder(row) {
        orders.push(row)
        return row === 'DEPLOYMENT_PERSONA_PREFIX' ? 0 : UNRELATED_SECTION_ORDER
      },
    },
  }

  plugin.apply(ctx, config)

  return { sections, orders, effectLabels, ctx }
}

before(async () => {
  // Load once for the whole file: `apply` runs against a fresh fake ctx per test,
  // but the module graph is shared and stateless by contract.
  plugin = await loadPlugin()
})

describe('plugin entry point', () => {
  it('exists on disk', () => {
    // Without this, a missing implementation shows up as an opaque
    // ERR_MODULE_NOT_FOUND for every test below instead of one clear failure.
    assert.ok(existsSync(ENTRY_PATH), `${ENTRY_PATH} does not exist`)
  })

  it('declares its name, inject list and default export', () => {
    // `name` is how the harness identifies the plugin; `inject` is what grants it
    // access to `ctx.systemPrompt` at all. A wrong inject list makes apply() a
    // silent no-op.
    assert.equal(plugin.name, 'fluent-korean')
    assert.deepEqual(plugin.inject, ['systemPrompt'])
  })

  it('re-exports the same SECTION id as lib/styles.js', () => {
    // Two copies of this string is exactly how the harness ends up with a
    // section that can never be found or disposed of.
    assert.equal(plugin.SECTION, SECTION)
  })

  it('exposes a default export carrying name, inject, apply and Config', () => {
    // DSH loads plugins through the default export; a named-only module is
    // silently inert.
    assert.equal(typeof plugin.default, 'object')
    assert.equal(plugin.default.name, plugin.name)
    assert.equal(plugin.default.inject, plugin.inject)
    assert.equal(typeof plugin.default.apply, 'function')
    assert.notEqual(plugin.default.Config, undefined)
  })
})

describe('resolveText', () => {
  it('returns an empty string when the plugin is disabled, even with a valid style', () => {
    // Disabled must win over the selected style. If it did not, a user who
    // turned the plugin off would keep getting a wall of Korean prose.
    const config = { enabled: false, style: DEFAULT_STYLE_ID }
    assert.equal(plugin.resolveText(config), '')
  })

  it('returns the coding style body for the coding style id', () => {
    // Equality against styleBody, not a substring match: the section must carry
    // the prose verbatim, since the prose explicitly forbids being summarised.
    assert.equal(plugin.resolveText({ style: 'fluent-korean' }), styleBody('fluent-korean'))
  })

  it('returns the non-coding style body for the non-coding style id', () => {
    assert.equal(
      plugin.resolveText({ style: 'fluent-korean-not-coding' }),
      styleBody('fluent-korean-not-coding'),
    )
  })

  it('gives the two style ids different text', () => {
    // The Style setting has to be observable in the prompt; otherwise switching
    // it silently does nothing.
    const coding = plugin.resolveText({ style: STYLE_IDS[0] })
    const nonCoding = plugin.resolveText({ style: STYLE_IDS[1] })
    assert.notEqual(coding, nonCoding)
  })

  it('returns an empty string for an unknown style id instead of throwing', () => {
    // A stale Settings row must not crash prompt assembly. `styleBody` throws by
    // design; resolveText is the boundary that absorbs that.
    let result
    assert.doesNotThrow(() => {
      result = plugin.resolveText({ style: 'not-a-style' })
    })
    assert.equal(result, '')
  })

  it('does not throw for undefined or empty config', () => {
    // apply() runs before Settings are guaranteed to be populated, and the
    // `enabled === false` check means an absent config must read as "on".
    assert.doesNotThrow(() => plugin.resolveText(undefined))
    assert.doesNotThrow(() => plugin.resolveText({}))
  })

  it('resolves an empty config to the default style or to nothing, but never throws', () => {
    // The schema default would normally fill `style` in before resolveText sees
    // it. Under test the stubbed schema cannot fill defaults, so both outcomes
    // are contract-legal; what is NOT legal is a throw or some third string.
    const resolved = plugin.resolveText({})
    assert.ok(
      resolved === '' || resolved === styleBody(DEFAULT_STYLE_ID),
      `unexpected default resolution: ${JSON.stringify(resolved.slice(0, 80))}`,
    )
  })
})

describe('apply', () => {
  it('registers exactly one prompt section', () => {
    // Two sections would inject the Korean prose twice into every prompt.
    const { sections } = mount({ enabled: true, style: DEFAULT_STYLE_ID })
    assert.equal(sections.length, 1)
  })

  it('registers it under the plugin-owned section name', () => {
    const { sections } = mount({ enabled: true })
    assert.equal(sections[0].name, 'fluent-korean:style')
  })

  it('does not squat on the deployment persona prefix row', () => {
    // Root-scope collision guard. `deployment:persona-prefix` is a harness-owned
    // row; if this plugin claimed that name, the harness's persona section would
    // be replaced by Korean style prose and the agent would lose its identity.
    // Claiming it is a loud failure at root, but a silent failure in a session
    // scope, so it is worth a test.
    const { sections } = mount({ enabled: true })
    assert.notEqual(sections[0].name, 'deployment:persona-prefix')
  })

  it('anchors the order just after the deployment persona prefix', () => {
    // The style text must land after the harness identity block. `getSectionOrder`
    // returns 0 for that row and 999 for everything else, so `order === 10` can
    // only hold if the plugin anchored on the row it meant to.
    const { sections, orders } = mount({ enabled: true })
    assert.ok(orders.includes('DEPLOYMENT_PERSONA_PREFIX'), 'plugin never asked for the anchor row')
    assert.equal(sections[0].order, 10)
  })

  it('installs the section inside an effect, with a disposal label', () => {
    // An un-disposed effect leaks a live section across plugin reloads. The
    // label is what makes the leak identifiable in a harness log.
    const { effectLabels } = mount({ enabled: true })
    assert.equal(effectLabels.length, 1)
    assert.match(effectLabels[0], /fluent-korean/)
  })

  it('supplies text as a function, not a string', () => {
    // A plain string would freeze whatever style was selected when apply() ran,
    // and the Settings switch would need a plugin restart to take effect.
    const { sections } = mount({ enabled: true })
    assert.equal(typeof sections[0].text, 'function')
  })

  it('yields empty text when the plugin is disabled', () => {
    const { sections } = mount({ enabled: false, style: DEFAULT_STYLE_ID })
    assert.equal(sections[0].text(), '')
  })

  it('yields the matching body for each style id', () => {
    for (const id of STYLE_IDS) {
      const { sections } = mount({ enabled: true, style: id })
      assert.equal(sections[0].text(), styleBody(id))
    }
  })

  it('yields empty text for an unknown style id rather than throwing during prompt assembly', () => {
    // text() is called on every prompt build, inside harness code this plugin
    // does not control. A throw here takes the whole session down.
    const { sections } = mount({ enabled: true, style: 'not-a-style' })
    assert.equal(sections[0].text(), '')
  })

  it('re-reads the config on every call, so switching style needs no restart', () => {
    // The live-Settings-switch guarantee. Cordis hands plugins a live config
    // object, so mutating it between two text() calls must change the output.
    // If text() had captured the body at apply() time, this would fail while
    // every other test in this file still passed.
    const config = { enabled: true, style: STYLE_IDS[0] }
    const { sections } = mount(config)

    const first = sections[0].text()
    config.style = STYLE_IDS[1]
    const second = sections[0].text()

    assert.equal(first, styleBody(STYLE_IDS[0]))
    assert.equal(second, styleBody(STYLE_IDS[1]))
    assert.notEqual(first, second)
  })

  it('honours disabling the plugin after the first prompt was built', () => {
    // Same live-config guarantee on the other axis: turning the plugin off in
    // Settings must not require a restart either.
    const config = { enabled: true, style: STYLE_IDS[0] }
    const { sections } = mount(config)

    assert.notEqual(sections[0].text(), '')
    config.enabled = false
    assert.equal(sections[0].text(), '')
  })

  it('re-reads a Volatile settings reference, which is what the loader actually hands over', () => {
    // `.volatile()` does not give the plugin a plain value — it hands over a
    // `{ get() }` reference that the loader mutates *in place* when a Settings
    // edit lands. That in-place mutation, not a config-object reassignment, is
    // the real live-switch mechanism in DSH, so it needs its own guarantee:
    // without unwrapping `.get()`, `config.style` is an object that matches no
    // style and the plugin silently contributes nothing at all.
    let selected = STYLE_IDS[0]
    const config = {
      enabled: { get: () => true },
      style: { get: () => selected },
    }
    const { sections } = mount(config)

    assert.equal(sections[0].text(), styleBody(STYLE_IDS[0]))
    selected = STYLE_IDS[1]
    assert.equal(sections[0].text(), styleBody(STYLE_IDS[1]))
  })

  it('returns empty text when a Volatile enabled reference reads false', () => {
    const { sections } = mount({
      enabled: { get: () => false },
      style: { get: () => STYLE_IDS[0] },
    })
    assert.equal(sections[0].text(), '')
  })

  it('does not leak the selected style from one mount into the next', () => {
    // Guards against the section text being memoised in module scope, which
    // would make the second plugin instance in a process inherit the first
    // instance's style.
    const first = mount({ enabled: true, style: STYLE_IDS[1] })
    assert.equal(first.sections[0].text(), styleBody(STYLE_IDS[1]))

    const second = mount({ enabled: true, style: STYLE_IDS[0] })
    assert.equal(second.sections[0].text(), styleBody(STYLE_IDS[0]))
  })
})