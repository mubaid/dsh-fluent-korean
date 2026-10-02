# Verification

What was actually run against `dsh-fluent-korean` 0.1.0, and what was not. Kept
out of [README.md](README.md) so that file can stay a description of the product.

## Summary

| Check | Result |
| --- | --- |
| Test suite | 64 of 64 pass |
| Install through `dsh plugin add` | Installs as a link, no build step |
| `dsh --dump-config` | Shows the plugin entry |
| `dsh --dump-config-schema` | Shows the entry with both fields marked volatile |
| Real prompt assembly | Both styles render, switching is live, `enabled: false` works |
| Live model turn | Model answered in Korean with the rules active |

Verified against DeepSeek Harness `0.2.0-rc.2`, which is the version pinned in
`engines.dsh`.

## The tests

`npm test` runs 64 tests. They cover the style catalogue, reading the rule files
from disk, the plugin's registration, and the configuration schema.

Two of them matter more than the rest:

- The rule bodies are compared against the upstream files, to confirm the Korean
  was copied and not retyped. A body that drifts fails the suite.
- The configuration is parsed with the real `@deepseek-ai/schemastery`, then read
  back. This is not decoration. A field marked for the Settings screen reaches the
  plugin as an object with a `get()` function, not as the value itself. Reading
  the object directly yields nothing, and the plugin installs cleanly while doing
  no work at all. That bug existed during development. The tests caught it, and
  the fix was verified by reverting it and watching six tests fail.

Most tests run against a stub of the schema library, so they work without
`node_modules`. To run everything against the real library:

```sh
DSH_TEST_REAL_DEPS=1 node --test test/*.test.mjs
```

The suite needs Node 22.15 or later. The plugin itself runs on Node 20.

## Harness-side checks

`dsh plugin add` links the package rather than copying and building it, which is
the point of shipping plain JavaScript. Nothing compiles at install time and the
user grants no extra permission.

`--dump-config-schema` confirms both configuration fields reach the profile with
their `volatile` flag intact. That flag is what puts the plugin in the Settings
screen, so a schema that lost it would be invisible in the UI while still working
from a file.

For prompt assembly, the plugin was applied to a real Harness context using the
harness's own prompt registry, and the assembled prompt was inspected. Both styles
render, a configuration change takes effect on the next assembly without a new
session, and disabling the plugin empties the section.

## Live model turn

A headless profile was built with the plugin installed, and the same question was
asked twice. The answers are compared in the README under "Why you might want
this".

The honest summary: the model used for the test already wrote competent Korean
without the rules. The rules moved it toward fuller endings and more Sino-Korean
technical vocabulary. Nobody has measured this against a weaker model.

## Not verified

- Behaviour on DeepSeek Harness versions other than 0.2.0-rc.2.
- Behaviour on Node versions other than those listed above.
- The optional clauses in the README. They come from the original project and are
  not shipped here. They need a manual edit to the rules file, and nobody has
  tested that path.
- Whether the rules hold over a long session. The upstream author notes that they
  drift as tasks run long, and that warning carries over.