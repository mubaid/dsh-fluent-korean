/**
 * A stand-in for `@deepseek-ai/schemastery`, for use only by this test suite.
 *
 * Why this exists
 * ---------------
 * This repo has no `node_modules` and installing one is out of scope, but
 * `index.js` imports `@deepseek-ai/schemastery` at module top level. ESM has no
 * way to inject a fake into that import from the outside, so `test/helpers/
 * load-plugin.mjs` installs a `node:module` resolve hook that points the bare
 * specifier at this file. That makes a *real* behavioural test of `apply()` and
 * `resolveText()` possible without a package install.
 *
 * What it does and does not do
 * ----------------------------
 * It reproduces the builder *shape* — `Schema.object({...})`, `.volatile()`,
 * `.default(x)`, `.describe(...)` and friends return something you can keep
 * chaining — so that importing `index.js` cannot blow up. It deliberately does
 * NOT validate, coerce, or apply defaults: the stub's job is to let the module
 * graph load, not to stand in for the schema engine.
 *
 * Consequence for the tests: `resolveText()` must never depend on the schema
 * having filled in `enabled`/`style` for it. The assertions in
 * `index-plugin.test.mjs` therefore hold whether the implementation treats
 * `undefined` as "on" or leaves it unresolved.
 *
 * Because the stub is chainable and total, an unknown builder name still
 * resolves instead of throwing — that keeps the loader robust if the
 * implementation reaches for a constructor this stub does not enumerate.
 */

/** Chainable no-op node. Callable so `Config(value)` degrades to identity. */
function schemaNode(kind) {
  const target = function configSchema() {
    // Schemastery schemas are callable validators. Returning the input keeps
    // the common `Config(raw)` shape from crashing without pretending to check.
    return arguments[0]
  }

  return new Proxy(target, {
    get(_t, prop) {
      // Symbols (inspection, `then`, `Symbol.toPrimitive`, …) must pass through
      // untouched or node:test output turns into garbage.
      if (typeof prop === 'symbol') return Reflect.get(target, prop)

      // `.describe(...)`, `.volatile()`, `.default(...)`, `.title(...)` and the
      // rest all just yield another chainable node.
      return (..._args) => schemaNode(`${kind}.${String(prop)}`)
    },
    apply(_t, _thisArg, args) {
      return args[0]
    },
    has() {
      return true
    },
  })
}

/**
 * A constructor: `Schema.object` itself. Kept distinct from `schemaNode` because
 * `Schema.object({...})` must build a new node, whereas the *node* it builds is
 * what the builder methods hang off.
 */
function constructorFor(kind) {
  // Arity checks. The real library rejects `Schema.union()` with no members and
  // `Schema.object()` with no props, and both fail at *module load* — which would
  // break the plugin in production while a fully permissive stub reported the
  // suite green. Checking the two constructors that actually crash is the point
  // of this stub.
  const required = kind === 'union' || kind === 'object' ? 1 : 0
  return (...args) => {
    if (args.length < required) {
      throw new TypeError(`[schemastery stub] Schema.${kind}() needs at least ${required} argument(s)`)
    }
    return schemaNode(kind)
  }
}

/** Catch-all namespace so `Schema.anythingAtAll` resolves instead of crashing. */
export const Schema = new Proxy(
  {},
  {
    get(_t, prop) {
      if (typeof prop === 'symbol') return undefined
      return constructorFor(String(prop))
    },
    has() {
      return true
    },
  },
)

// Enumerated constructors. The proxy above would answer any property, but named
// imports are static in ESM, so the common ones are exported explicitly — that
// covers both `import { Schema } from '…'` and `import * as z from '…'`.
export const object = constructorFor('object')
export const boolean = constructorFor('boolean')
export const string = constructorFor('string')
export const number = constructorFor('number')
export const natural = constructorFor('natural')
export const union = constructorFor('union')
export const intersect = constructorFor('intersect')
export const const_ = constructorFor('const')
export { const_ as literal }
export const array = constructorFor('array')
export const record = constructorFor('record')
export const enum_ = constructorFor('enum')
export { enum_ as enum }
export const optional = constructorFor('optional')
export const null_ = constructorFor('null')
export const never = constructorFor('never')
export const any = constructorFor('any')
export const unknown = constructorFor('unknown')
export const transform = constructorFor('transform')
export const exclude = constructorFor('exclude')
export const create = constructorFor('create')

export default Schema