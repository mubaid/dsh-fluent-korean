/**
 * dsh-fluent-korean — the two output styles, and how to read one off disk.
 *
 * Upstream this was a Claude Code `output-styles/` pair: YAML front-matter plus
 * a Korean prose body injected verbatim into the system prompt. The prose is the
 * deliverable, so this module never touches it — it strips the front-matter and
 * hands the rest back untouched. The body itself explicitly forbids summarising
 * its own clauses, which is why the two files are copied verbatim instead of
 * being restated here.
 *
 * The `keepCodingInstructions` intent is carried as data rather than behaviour:
 * DSH cannot suppress the harness identity/coding sections at root scope, so the
 * distinction is recorded for the reader instead of silently dropped.
 *
 * @module dsh-fluent-korean/styles
 */
import { readFileSync } from 'node:fs'

/** Prompt section id this plugin contributes. */
export const SECTION = 'fluent-korean:style'

/**
 * The available styles, in menu order: coding guidance kept, then the variant
 * that drops it. The order is fixed because the first entry is the default.
 *
 * `label`/`labelZh`/`description` duplicate the front-matter of the matching
 * `styles/*.md` rather than being parsed from it: parsing would mean a YAML
 * dependency at load time, and the no-build rule already rules out generating
 * this table. A test asserts the two stay in step.
 */
export const STYLES = [
  {
    id: 'fluent-korean',
    label: 'Fluent Korean',
    labelZh: '流利的韩语',
    keepCodingInstructions: true,
    description: '의미가 명확한 한국어 문장을 출력하게 하는 지침입니다. Claude Code의 코딩 지침을 유지합니다.',
  },
  {
    id: 'fluent-korean-not-coding',
    label: 'Fluent Korean (non-coding)',
    labelZh: '流利的韩语（非编程）',
    keepCodingInstructions: false,
    description: '의미가 명확한 한국어 문장을 출력하게 하는 지침입니다. Claude Code의 코딩 지침은 유지하지 않습니다.',
  },
]

/** Style ids in menu order; the shape a settings field validates against. */
export const STYLE_IDS = STYLES.map(s => s.id)

/** Style applied when the user has not chosen one. */
export const DEFAULT_STYLE_ID = 'fluent-korean'

// Bodies are immutable prompt text on a read-only path, so a second read within
// a process can only cost I/O. The map is exported-to-be-cleared so a test can
// observe a cold read without spawning a new process.
const cache = new Map()

/** Descriptor for `id`, or undefined if unknown — callers pick their own error text. */
export function findStyle(id) {
  return STYLES.find(s => s.id === id)
}

/**
 * Prompt text for `id`, with the YAML front-matter removed and the body trimmed.
 *
 * Resolved against `import.meta.url`, not `process.cwd()`: the plugin is loaded
 * by the harness from wherever it is installed, so the styles directory has to
 * follow the module rather than the shell that happened to start it.
 */
export function styleBody(id) {
  if (cache.has(id)) return cache.get(id)

  const style = findStyle(id)
  if (style === undefined) {
    throw new Error(`unknown style "${id}"; expected one of ${STYLE_IDS.join(', ')}`)
  }

  const raw = readFileSync(new URL(`../styles/${id}.md`, import.meta.url), 'utf8')
  const front = /^---[^\S\n]*\n[\s\S]*?\n---[^\S\n]*\n?/.exec(raw)
  if (front === null) {
    throw new Error(`style "${id}" has no front-matter block`)
  }

  const body = raw.slice(front[0].length).trim()
  cache.set(id, body)
  return body
}

/** Drop every cached body so the next call re-reads from disk. Test-only. */
export function clearStyleCache() {
  cache.clear()
}