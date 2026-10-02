/**
 * Loads the plugin's `index.js` with `@deepseek-ai/schemastery` redirected at a
 * local stub, so a real behavioural test is possible without `node_modules`.
 *
 * Mechanism
 * ---------
 * `node:module`'s synchronous `registerHooks` (Node >= 22.15) installs a resolve
 * hook on the current thread. Every bare specifier the plugin imports is then
 * pointed at `test/stubs/schemastery.mjs`; relative imports and `node:` builtins
 * are passed through untouched so `lib/styles.js` and `fs` resolve exactly as
 * they do in production.
 *
 * This is preferred over the fallback of grepping `index.js` as text: a text
 * assertion can only prove the source *looks* right, whereas this lets us call
 * the exported functions and observe what `apply()` actually registers.
 */
import { registerHooks } from 'node:module'

const STUB_URL = new URL('../stubs/schemastery.mjs', import.meta.url).href
const PLUGIN_URL = new URL('../../index.js', import.meta.url).href

/**
 * True only for package-style specifiers (`schemastery`, `lodash/merge`).
 *
 * The scheme check matters: `import()` is given an absolute `file:` URL here,
 * and a naive "does not start with a dot" test would happily stub that too and
 * silently hand back the stub in place of the module under test.
 */
function isBare(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return false
  return !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(specifier)
}

let installed = false

function installHooks() {
  // Registering twice in one process would stack duplicate hooks; the result is
  // identical either way, but staying idempotent keeps the failure mode obvious.
  if (installed) return
  installed = true

  // Escape hatch. This repo originally had no node_modules at all, which is why
  // the stub exists. If dependencies are installed later, `DSH_TEST_REAL_DEPS=1`
  // skips the redirect so the suite can be re-run against the genuine
  // schemastery — which is how you check that the stub is not papering over a
  // real failure. Tests should pass identically either way.
  if (process.env.DSH_TEST_REAL_DEPS === '1') return

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (isBare(specifier)) {
        return { url: STUB_URL, shortCircuit: true, format: 'module' }
      }
      return nextResolve(specifier, context)
    },
  })
}

/**
 * Import `index.js` and return its namespace.
 *
 * @param {string} [url] Module to import. Defaults to the plugin's `index.js`;
 *   the loader self-check passes its own fixture instead.
 */
export async function loadPlugin(url = PLUGIN_URL) {
  installHooks()
  return import(url)
}

/** Absolute `file:` URL of the plugin entry point, for spawned subprocesses. */
export const PLUGIN_FILE_URL = PLUGIN_URL