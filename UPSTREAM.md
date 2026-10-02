# UPSTREAM.md — file-by-file port map

Source: [`snflkd/fluent-korean`](https://github.com/snflkd/fluent-korean), MIT,
author `snflkd`. Snapshot reviewed: the six files listed below, as fetched for
this port.

Upstream delivered two things of substance — two output-style documents — plus
Claude Code packaging metadata and a README. This file records where each of
those landed and why.

## Disposition vocabulary

- `verbatim` — byte-for-byte the upstream file.
- `adapted` — upstream content, unchanged in substance; only the packaging
  around it differs.
- `rewritten` — same purpose, new content written for DSH.
- `dropped` — intentionally not carried over, with a reason.

## Upstream files

| Upstream file | Size | Our file | Disposition | Reason |
| --- | --- | --- | --- | --- |
| `plugins/fluent-korean/output-styles/fluent-korean.md` | 6317 B | `styles/fluent-korean.md` | adapted | The Korean body is byte-identical to upstream (6119 B, verified). Only the YAML front-matter differs: it carries DSH-facing metadata instead of Claude Code's `keep-coding-instructions` key. |
| `plugins/fluent-korean/output-styles/fluent-korean-not-coding.md` | 5932 B | `styles/fluent-korean-not-coding.md` | adapted | Same treatment: identical Korean body (5744 B, verified), rewritten front-matter. |
| `.claude-plugin/plugin.json` | 530 B | `package.json` | rewritten | Upstream declares a Claude Code plugin manifest. Ours is an npm manifest plus a `dsh` block (`engines.dsh`, and the fact that there is no build step to run). Metadata that still applies — name, version, description, author, repository, license, keywords — is carried over. |
| `.claude-plugin/marketplace.json` | 506 B | — | dropped | A Claude Code marketplace index for a plugin that no longer exists in that form. DSH has its own plugin market and install path; a stale index for a different harness is worse than none. |
| `README.md` | 14135 B | `README.md`, `README.en.md`, `NOTICE` | rewritten | Upstream's README is Claude Code documentation: `/plugin marketplace add`, `/config`, `~/.claude/output-styles/`, and installation advice addressed to Claude itself. None of that applies here. It was read for the feature description and for its section structure, then rewritten for DSH. Korean is the default README because it is this plugin's first language. The optional add-on clauses are carried over as quoted Korean rather than restated. |
| `LICENSE` | 1067 B | `LICENSE` | verbatim | MIT. The upstream grant text is reproduced unchanged; the port author's copyright line is added below `snflkd`'s, and no comment header precedes the text, so that license detection resolves the file as MIT. The port identification moved to `NOTICE`. |

## Our five documentation deliverables

These files have no upstream counterpart; they exist only because this is a port
and the port needs a record of itself.

| Our file | Disposition | Reason |
| --- | --- | --- |
| `README.md` | rewritten | The Korean README, and the default one on the repository. Upstream is written in Korean, so this is the natural primary document rather than a translation. |
| `README.en.md` | rewritten | The English README. Written as a complete document, not a summary of the Korean one. |
| `LICENSE` | verbatim (+ copyright line) | Upstream MIT grant text, unchanged, with the port author's copyright line added under the original author's. |
| `NOTICE` | rewritten | Attribution required by the MIT grant, plus a statement of what the port added and what it did not. |
| `VERIFICATION.md` | rewritten | What was actually run, and what was not. Split out of the README so the README can stay a product description. |
| `UPSTREAM.md` | rewritten | This file. |

## Runtime files written for the port

No upstream counterpart; authored entirely for DSH.

| Our file | Disposition | Reason |
| --- | --- | --- |
| `index.js` | rewritten | The DSH plugin entry point: exports `name`, `inject = ['systemPrompt']`, and `apply(ctx, config)`. Replaces the Claude Code manifest-plus-markdown convention. |
| `package.json` | rewritten | npm manifest. Plain ESM, prebuilt, no build step, so `dsh plugin add` needs no compiler and no extra permission. |
| `styles/*.md` | adapted | The upstream prose, loaded at runtime and injected as one system prompt section. See the byte-identity note below. |
| `lib/` | rewritten | Style loading and text assembly helpers. |
| `test/` | rewritten | Tests for section registration, config defaults, and style selection. |

## What is actually byte-identical

Stated precisely, because "it's a port" should not mean "trust me":

- The **body** of each file in `styles/` is byte-identical to its upstream
  counterpart, from the first byte after the front-matter to the end of file.
  Verified by diffing the two bodies: 6119 B for `fluent-korean.md`, 5744 B for
  `fluent-korean-not-coding.md`, empty diff in both cases. No rewrapping, no
  whitespace normalisation, no editing of the Korean.
- The **front-matter** of each file is not identical. Ours adds `label` and
  `labelZh` for the Settings surface, and keeps upstream's intent as
  `keepCodingInstructions` (`true` / `false`) instead of upstream's
  `keep-coding-instructions`. That key has no runtime effect in DSH — it is
  documentation of what upstream intended — and a comment in the front-matter
  says so. The note lives inside the front-matter precisely so the prose body
  below can stay byte-identical.
- The two upstream style files are **not** identical to each other, and ours are
  not identical to each other either. `fluent-korean.md` has a trailing
  `## 추가 사항` clause about subagents; `fluent-korean-not-coding.md` does not.
  There are also incidental upstream differences — a space in
  `이미 작업중인 파일` versus `이미 작업 중인 파일`, and `문맥과 형식에 따라`
  versus `문맥에 따라`. Those were copied through as-is rather than
  normalised, on the same principle as the rest of the body.

To re-check the byte-identity claim after any edit to `styles/`:

```sh
diff <(tail -n +7 .scratch/fk-upstream/fluent-korean.md) \
     <(tail -n +N  styles/fluent-korean.md)
```

Adjust the line offsets for whatever the front-matter length currently is. If
this diff is not empty, the front-matter edit has leaked into the body.

## Upstream material deliberately not ported

Upstream's README describes a set of optional add-on clauses the user can
paste on: explain coding to a beginner, address the user honorifically, avoid
rare dictionary words, apply the rules to all Korean output, exempt genres with
their own rules, and think and report in Korean at all times. These are
per-user behavioural preferences, not plugin features, and upstream itself
delivers them as copy-and-paste text rather than configuration.

This port does not implement them as configuration toggles. They are quoted
verbatim in each README under "Want more?", for the user to paste into their own
agent instructions. Quoting them is the whole of the support: there is no code
behind them, and the README does not claim there is.