/**
 * Fixture plugin: exists only so `loader.test.mjs` can prove the schemastery
 * redirect works, independently of whether the real `index.js` exists yet.
 *
 * It mirrors the import shape of the real entry point — a bare
 * `@deepseek-ai/schemastery` import used to build a `Config` schema at module
 * scope — so if this loads, the loader is sound.
 *
 * The import is the *default* form because that is what the real package
 * provides; running the suite with `DSH_TEST_REAL_DEPS=1` is what caught the
 * named-import version of this line failing.
 */
import Schema from '@deepseek-ai/schemastery'

export const Config = Schema.object({
  enabled: Schema.boolean().default(true).volatile(),
  style: Schema.union([Schema.const('a'), Schema.const('b')]).volatile(),
})

export const LOADED_FROM_FIXTURE = true

export default { name: 'loader-fixture' }