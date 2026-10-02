/**
 * Tests for `lib/styles.js` — the style catalogue and the on-disk prose.
 *
 * These import the module for real. It depends only on `node:fs`, so there is no
 * reason to fake anything here.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'

import {
  DEFAULT_STYLE_ID,
  SECTION,
  STYLES,
  STYLE_IDS,
  clearStyleCache,
  findStyle,
  styleBody,
} from '../lib/styles.js'

/** Absolute file URL of the module under test, for the spawned-cwd test below. */
const STYLES_MODULE_URL = new URL('../lib/styles.js', import.meta.url).href

const tempDirs = []

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-fluent-korean-test-'))
  tempDirs.push(dir)
  return dir
}

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

describe('style catalogue', () => {
  it('exports exactly the two upstream style ids, in menu order', () => {
    // Order is load-bearing, not cosmetic: STYLES[0] is what the settings menu
    // shows first and what DEFAULT_STYLE_ID names.
    assert.deepEqual(STYLE_IDS, ['fluent-korean', 'fluent-korean-not-coding'])
  })

  it('names a default style that is one of the available styles', () => {
    // A default outside STYLE_IDS would make resolveText() silently blank for a
    // user who never touched Settings.
    assert.ok(STYLE_IDS.includes(DEFAULT_STYLE_ID), `${DEFAULT_STYLE_ID} is not in STYLE_IDS`)
  })

  it('gives every style a complete descriptor', () => {
    // Each field is rendered by the settings UI; an empty one is a blank row.
    for (const style of STYLES) {
      assert.equal(typeof style.id, 'string')
      assert.notEqual(style.id.trim(), '', `style ${style.id} has an empty id`)
      assert.notEqual(style.label, '', `style ${style.id} has an empty label`)
      assert.notEqual(style.labelZh, '', `style ${style.id} has an empty labelZh`)
      assert.notEqual(style.description, '', `style ${style.id} has an empty description`)
      assert.equal(
        typeof style.keepCodingInstructions,
        'boolean',
        `style ${style.id}: keepCodingInstructions must be a boolean`,
      )
    }
  })

  it('uses keepCodingInstructions to distinguish the two styles', () => {
    // This flag is the only record of the upstream split, because DSH cannot
    // suppress the harness coding sections at root scope. If both entries
    // claimed the same value, the setting would be lying to the user.
    const values = STYLES.map(s => s.keepCodingInstructions).sort()
    assert.deepEqual(values, [false, true])
  })

  it('exposes SECTION as the plugin-owned prompt section id', () => {
    // Cross-checked against index.js in index-plugin.test.mjs; having it defined
    // once in lib/styles.js is what keeps the two from drifting apart.
    assert.equal(SECTION, 'fluent-korean:style')
  })
})

describe('findStyle', () => {
  it('returns the descriptor for each known id', () => {
    for (const id of STYLE_IDS) {
      const found = findStyle(id)
      assert.ok(found, `findStyle(${id}) returned undefined`)
      assert.equal(found.id, id)
    }
  })

  it('returns undefined for an unknown id', () => {
    // Callers decide their own error text; findStyle must not throw, or the
    // "unknown setting" path becomes a crash inside prompt assembly.
    assert.equal(findStyle('nope'), undefined)
  })

  it('returns undefined for undefined and null', () => {
    // A missing Settings value reaches here as undefined; a legacy config row
    // can reach it as null. Neither may blow up.
    assert.equal(findStyle(undefined), undefined)
    assert.equal(findStyle(null), undefined)
  })
})

describe('styleBody', () => {
  it('returns non-empty prose for both styles', () => {
    for (const id of STYLE_IDS) {
      const body = styleBody(id)
      assert.equal(typeof body, 'string')
      assert.notEqual(body.trim(), '', `body for ${id} is empty`)
    }
  })

  it('strips the YAML front-matter', () => {
    for (const id of STYLE_IDS) {
      const body = styleBody(id)

      // A stray '---' fence means the front-matter stripper regressed; the
      // markers would be injected into the model prompt as literal text.
      assert.doesNotMatch(body, /^---\s*$/m, `body for ${id} still contains a '---' fence`)

      // Front-matter keys are equally bad, and easier to spot than the fence.
      assert.doesNotMatch(body, /^name:\s/m, `body for ${id} leaked the 'name' front-matter key`)
      assert.doesNotMatch(body, /^labelZh:\s/m, `body for ${id} leaked the 'labelZh' key`)
    }
  })

  it('returns real Korean prose, not a stub placeholder', () => {
    // 한국어 is the subject of the entire document. Its absence means the style
    // file was emptied or replaced by a placeholder during packaging.
    for (const id of STYLE_IDS) {
      assert.ok(styleBody(id).includes('한국어'), `body for ${id} does not mention 한국어`)
    }
  })

  it('gives the two styles genuinely different bodies', () => {
    // If these ever matched, the style setting would be a no-op the user can
    // see through.
    assert.notEqual(styleBody('fluent-korean'), styleBody('fluent-korean-not-coding'))
  })

  it('throws on an unknown id, naming the id and the valid ones', () => {
    // This message surfaces in the harness log when a config row references a
    // style that was removed, so it has to be actionable on its own.
    assert.throws(
      () => styleBody('nope'),
      (error) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /nope/, 'error message does not name the offending id')
        for (const id of STYLE_IDS) {
          assert.ok(
            error.message.includes(id),
            `error message does not list the valid style id "${id}"`,
          )
        }
        return true
      },
    )
  })

  it('keeps the subagent clause only in the coding style', () => {
    // This is the one substantive difference between the two upstream files:
    // the coding variant adds a clause about checking your own Korean before
    // calling a subagent, and relaying subagent output unchanged. Losing it
    // would quietly merge the two styles into one.
    const coding = styleBody('fluent-korean')
    const nonCoding = styleBody('fluent-korean-not-coding')

    assert.ok(coding.includes('서브에이전트'), 'fluent-korean.md lost its 서브에이전트 clause')
    assert.ok(
      !nonCoding.includes('서브에이전트'),
      'fluent-korean-not-coding.md should not carry the 서브에이전트 clause',
    )
  })
})

describe('styleBody path resolution', () => {
  it('reads styles relative to the module, not the current working directory', () => {
    // The single most valuable test in this file. The harness loads plugins from
    // wherever they are installed while the shell's cwd is something else
    // entirely, so a `process.cwd()`-based lookup works in the developer's
    // shell and fails in production. To make the failure unambiguous, the
    // subprocess runs from a temp directory that contains a DECOY
    // styles/fluent-korean.md: if the implementation followed cwd it would print
    // the decoy instead of the real body.
    const cwd = makeTempDir()
    mkdirSync(join(cwd, 'styles'))
    writeFileSync(join(cwd, 'styles', 'fluent-korean.md'), '---\nname: decoy\n---\n\nDECOY BODY\n')

    const script = `
      const { styleBody } = await import(${JSON.stringify(STYLES_MODULE_URL)})
      process.stdout.write(styleBody('fluent-korean'))
    `

    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd,
      encoding: 'utf8',
    })

    // Guard the guard: a broken spawn must not read as "no decoy was used".
    assert.equal(result.status, 0, `subprocess failed: ${result.stderr}`)

    assert.ok(
      !result.stdout.includes('DECOY BODY'),
      'styleBody() followed process.cwd() instead of import.meta.url',
    )
    assert.ok(
      result.stdout.includes('한국어'),
      'subprocess did not print the real style body',
    )
  })
})

describe('clearStyleCache', () => {
  it('exists and returns without throwing', () => {
    // Exercised because it is part of the module's exported surface and the
    // plugin's own tests rely on it; a missing export is a loud failure here
    // rather than a mysterious undefined deep in a suite.
    assert.equal(typeof clearStyleCache, 'function')
    assert.doesNotThrow(() => clearStyleCache())
  })

  it('leaves styleBody returning the same text after clearing', () => {
    // Clearing is meant to force a cold read, not to invalidate anything. A
    // mismatch here means the cache key or the front-matter stripping is wrong.
    const before = styleBody('fluent-korean')
    clearStyleCache()
    assert.equal(styleBody('fluent-korean'), before)
  })
})