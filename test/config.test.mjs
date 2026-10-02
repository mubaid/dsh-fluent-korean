/**
 * Tests for the real Schemastery `Config` schema — the production path.
 *
 * `index-plugin.test.mjs` exercises `resolveText` and `apply` against a stubbed
 * schemastery so it can run without `node_modules`. That is the right default for
 * most assertions, but it leaves the single most dangerous fact in this plugin
 * untested: what the schema *actually hands to* `apply()`.
 *
 * A `.volatile()` field is not a plain value. The loader gives the plugin a
 * `Volatile<T>` reference — an object with a `get()` method — and rewrites that
 * reference in place when a Settings edit lands, without re-running `apply()`.
 * So `config.style` is never a style id; `config.style.get()` is. An
 * implementation that reads the raw field matches no style and silently
 * contributes nothing, and every stubbed test still passes.
 *
 * These tests therefore run against the real library. They need `node_modules`,
 * so they are the ones that justify `npm install` before `npm test`.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import Schema from '@deepseek-ai/schemastery'

import { Config, apply, resolveText } from '../index.js'
import { DEFAULT_STYLE_ID, STYLE_IDS, styleBody } from '../lib/styles.js'

/** The write symbol the loader uses to commit a value into a reference. */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/** Minimal stand-in for the two services `apply()` touches. */
function mount(config) {
  const sections = []
  const ctx = {
    effect: (fn) => fn(),
    systemPrompt: {
      section: (section) => {
        sections.push(section)
        return () => {}
      },
      getSectionOrder: () => 0,
    },
  }
  apply(ctx, config)
  return { sections }
}

describe('Config schema', () => {
  it('accepts an empty config and fills in both defaults', () => {
    const parsed = Config({})
    assert.equal(unwrap(parsed.enabled), true)
    assert.equal(unwrap(parsed.style), DEFAULT_STYLE_ID)
  })

  it('accepts each published style id', () => {
    for (const id of STYLE_IDS) {
      assert.doesNotThrow(() => Config({ style: id }), `expected "${id}" to validate`)
    }
  })

  it('rejects a style id it does not publish', () => {
    // Guards the union against silently widening: a Settings form built from
    // this schema is the only thing stopping a typo from reaching the prompt.
    assert.throws(() => Config({ style: 'not-a-style' }))
  })

  it('rejects a non-boolean enabled', () => {
    assert.throws(() => Config({ enabled: 'yes' }))
  })

  it('exposes both fields to the Settings form', () => {
    // DSH projects *volatile* fields into an auto-generated form; ordinary
    // fields are excluded from forms entirely. A field that silently loses its
    // `.volatile()` becomes invisible in Settings while still working from YAML.
    assert.equal(Config.dict.enabled.meta.volatile, true)
    assert.equal(Config.dict.style.meta.volatile, true)
  })
})

describe('resolveText against real Config references', () => {
  it('yields the style body for a parsed default config', () => {
    // This is the assertion that would have caught the production bug.
    assert.equal(resolveText(Config({})), styleBody(DEFAULT_STYLE_ID))
  })

  it('yields the matching body for each published style', () => {
    for (const id of STYLE_IDS) {
      assert.equal(resolveText(Config({ style: id })), styleBody(id))
    }
  })

  it('yields nothing when the parsed config disables the plugin', () => {
    assert.equal(resolveText(Config({ enabled: false })), '')
  })

  it('receives reference objects, not plain values', () => {
    // The premise of this whole file, asserted directly: if a future schema
    // change stops producing references, the unwrapping in resolveText is what
    // keeps this plugin working, and these tests should say so loudly.
    const parsed = Config({})
    assert.equal(typeof parsed.style, 'object')
    assert.equal(typeof parsed.style.get, 'function')
    assert.notEqual(typeof parsed.style, 'string', 'style must not be a plain value')
  })
})

describe('live Settings switch through a real reference', () => {
  it('changes the prompt text when the reference is rewritten in place', () => {
    // This is the production mechanism: the loader commits a Settings edit by
    // writing into the existing reference. `apply()` is not re-run, so the only
    // thing that can pick the change up is `text` being a function.
    const live = Config({ style: STYLE_IDS[0] })
    const { sections } = mount(live)

    assert.equal(sections[0].text(), styleBody(STYLE_IDS[0]))

    live.style[VOLATILE_WRITE](STYLE_IDS[1])

    assert.equal(sections[0].text(), styleBody(STYLE_IDS[1]))
  })

  it('keeps the same reference identity across the switch', () => {
    // The binding captured in apply() must not go stale, which is why capturing
    // `config` once is correct rather than a shortcut.
    const live = Config({ style: STYLE_IDS[0] })
    const styleRef = live.style
    const { sections } = mount(live)

    live.style[VOLATILE_WRITE](STYLE_IDS[1])

    assert.equal(live.style, styleRef, 'the reference should be mutated, not replaced')
    assert.equal(sections[0].text(), styleBody(STYLE_IDS[1]))
  })

  it('honours disabling the plugin through an in-place reference write', () => {
    const live = Config({ style: STYLE_IDS[0] })
    const { sections } = mount(live)

    assert.notEqual(sections[0].text(), '')

    live.enabled[VOLATILE_WRITE](false)

    assert.equal(sections[0].text(), '')
  })

  it('takes effect on the next assembly without re-registering the section', () => {
    const live = Config({ style: STYLE_IDS[0] })
    const { sections } = mount(live)

    live.style[VOLATILE_WRITE](STYLE_IDS[1])

    assert.equal(sections.length, 1, 'switching style must not register a second section')
    assert.equal(sections[0].name, 'fluent-korean:style')
  })
})

describe('resolveText regression guard', () => {
  it('still unwraps config fields rather than reading them raw', async () => {
    // A cheap pin on the fix. The behavioural tests above would catch the
    // regression too, but this names the cause in the failure message, which is
    // what a future editor needs to see when they wonder why the text vanished.
    const source = await readFile(new URL('../index.js', import.meta.url), 'utf8')
    assert.match(source, /unwrap\(cfg\.enabled\)/, 'resolveText must unwrap `enabled`')
    assert.match(source, /unwrap\(cfg\.style\)/, 'resolveText must unwrap `style`')
  })
})

/** Read a config field that may be a Volatile reference. Mirrors index.js. */
function unwrap(value) {
  return typeof value === 'object' && value !== null && typeof value.get === 'function' ? value.get() : value
}