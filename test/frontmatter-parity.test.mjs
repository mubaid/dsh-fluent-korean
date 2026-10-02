/**
 * Keeps the `STYLES` table in step with the front-matter of the shipped files.
 *
 * `lib/styles.js` duplicates `label`, `labelZh`, `description` and
 * `keepCodingInstructions` as literals instead of parsing the front-matter,
 * because parsing would mean a YAML dependency at load time and the no-build
 * rule already rules out generating the table. The cost of that choice is two
 * sources of truth for the same four fields, which is exactly the kind of
 * duplication that drifts silently.
 *
 * It already drifted once during development: the two files disagreed on
 * `labelZh`, and the two styles briefly shared a `label`. Nothing failed at
 * runtime — the plugin only ever reads `id` — so without this test the drift
 * would have shipped.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { STYLES } from '../lib/styles.js'

/**
 * Read a single scalar out of a style file's front-matter.
 *
 * Hand-rolled on purpose: the front-matter is four known scalar keys with no
 * nesting, no quoting subtleties beyond plain strings, and the repo has no YAML
 * dependency. Adding a parser to assert a parser is not needed would be worse
 * than the duplication this test exists to catch.
 */
function frontMatterField(source, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(source.split(/^---$/m)[1] ?? '')
  assert.notEqual(match, null, `expected a "${key}:" line in the front-matter`)
  return match[1].trim()
}

describe('STYLES and the shipped front-matter agree', () => {
  for (const style of STYLES) {
    it(`"${style.id}" matches styles/${style.id}.md`, async () => {
      const path = new URL(`../styles/${style.id}.md`, import.meta.url)
      const source = await readFile(path, 'utf8')

      assert.equal(frontMatterField(source, 'name'), style.id)
      assert.equal(frontMatterField(source, 'label'), style.label)
      assert.equal(frontMatterField(source, 'labelZh'), style.labelZh)
      assert.equal(frontMatterField(source, 'description'), style.description)
      assert.equal(
        frontMatterField(source, 'keepCodingInstructions'),
        String(style.keepCodingInstructions),
      )
    })
  }

  it('gives the two styles different labels', () => {
    // Otherwise Settings renders two menu entries the user cannot tell apart.
    const labels = STYLES.map(s => s.label)
    assert.equal(new Set(labels).size, labels.length)
  })

  it('gives the two styles different Chinese labels', () => {
    const labels = STYLES.map(s => s.labelZh)
    assert.equal(new Set(labels).size, labels.length)
  })

  it('has no style whose front-matter file is missing', () => {
    // styleBody() would throw at prompt-assembly time if a file were absent, so
    // this asserts the catalogue and the directory have the same shape.
    assert.equal(STYLES.length, 2)
    for (const style of STYLES) assert.match(style.id, /^fluent-korean(-not-coding)?$/)
  })
})