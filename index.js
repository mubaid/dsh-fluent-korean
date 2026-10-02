/**
 * dsh-fluent-korean — Korean output styles for DeepSeek Harness.
 *
 * A port of the Claude Code output-style plugin `snflkd/fluent-korean`: two
 * prompt sections of Korean prose that ask the model for clear, natural Korean
 * sentences, one keeping the coding guidance and one dropping it.
 *
 * The prose itself lives in `styles/*.md` and is read by `./lib/styles.js`; this
 * file is only the runtime — one prompt section, one style setting, no tools.
 * Nothing else is registered: the plugin contributes guidance, nothing more.
 *
 * @module dsh-fluent-korean
 */
import Schema from '@deepseek-ai/schemastery'

import { DEFAULT_STYLE_ID, findStyle, SECTION, STYLE_IDS, styleBody } from './lib/styles.js'

export const name = 'fluent-korean'
export const inject = ['systemPrompt']

/**
 * Prompt section id this plugin owns, re-exported so callers and tests can
 * address the section without reaching into `lib/`.
 */
export { SECTION }

/**
 * Loader and Settings schema.
 *
 * Both fields are `.volatile()` and that is the whole reason the plugin shows
 * up in Settings → Plugins: DSH auto-generates a form for the volatile fields of
 * an active plugin entry, and ordinary fields are excluded from forms. There is
 * no `settings.installSection` here on purpose — that API does not exist in this
 * DSH release, and relying on it would break the plugin-only-API rule.
 */
export const Config = Schema.object({
  /** Turn the section off without removing the plugin. */
  enabled: Schema.boolean().default(true).volatile(),
  /** Which prose body to inject. */
  style: Schema.union([...STYLE_IDS]).default(DEFAULT_STYLE_ID).volatile(),
})

/**
 * Read a config field that may be a volatile reference rather than a value.
 *
 * A `.volatile()` field does not hand the plugin a plain boolean or string: it
 * hands over a `Volatile<T>` reference — an object with a `get()` method — and
 * the loader mutates that reference *in place* when a Settings edit lands. So
 * `config.style` is never the style id; `config.style.get()` is. Reading the raw
 * field yields an object that matches no style, and the plugin silently
 * contributes nothing.
 *
 * Duck-typed on `get` rather than importing `isVolatile` so this module keeps
 * `@deepseek-ai/cosmokit` (a transitive dependency) out of the plugin's own
 * dependency list, and so the function still accepts the plain objects a caller
 * passes in directly.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function unwrap(value) {
  return typeof value === 'object' && value !== null && typeof value.get === 'function' ? value.get() : value
}

/**
 * Prompt text for one config value.
 *
 * Returns `''` when disabled, `''` when the style id is unknown, and otherwise
 * the style body. A bad id degrades to no guidance instead of throwing: this
 * runs during prompt assembly, and a wrong style name typed into settings must
 * not be able to break the agent's prompt.
 *
 * @param {{ enabled?: unknown, style?: unknown }} [config]
 * @returns {string}
 */
export function resolveText(config) {
  const cfg = config ?? {}
  if (unwrap(cfg.enabled) === false) return ''
  const style = unwrap(cfg.style)
  // `styleBody` throws on an unknown id, so validate first — see above.
  if (findStyle(style) === undefined) return ''
  return styleBody(style)
}

/**
 * Register the style section.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {typeof Config.Infer} config
 */
export function apply(ctx, config) {
  // Live config accessor, initialised to the value apply() was handed.
  //
  // Capturing `config` once is correct, not a shortcut: a `.volatile()` field is
  // a stable reference object that the loader rewrites *in place* when a
  // Settings edit lands, so this binding never goes stale and `apply` is not
  // re-run. What makes the edit visible is the `text` *function* below — it
  // re-reads through the reference on every prompt assembly, whereas a captured
  // string would be fixed at load time.
  let current = () => config ?? {}

  // The section name is plugin-owned rather than `deployment:persona-prefix` on
  // purpose. DSH's `persona` row mounts that name globally in the base bundle,
  // so a global mount with the same name collides and fails loud. Owning the
  // name is what keeps this plugin installable at root scope.
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION,
        // Just after the persona prefix: the style modifies how the model
        // speaks, so it belongs in the persona's neighbourhood, not buried
        // under the tool or coding sections.
        order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX') + 10,
        // A function, not a captured string — see `current` above.
        text: () => resolveText(current()),
      }),
    'fluent-korean: style section',
  )
}

export default { name, inject, apply, Config }