# fluent-korean for DeepSeek Harness

English | [한국어](README.md)

Make DeepSeek Harness write Korean that a Korean reader accepts.

Coding agents are tuned to be short. They drop case particles (*조사*, josa) and
sentence endings (*어미*, eomi), turn sentences into telegraphic noun strings, and
swap plain words for figurative ones. The result is readable to you only if you
already know what was lost.

This plugin adds a set of writing rules to the model's instructions, so it writes
complete sentences and picks words that say what it means. The rules come from
[`snflkd/fluent-korean`](https://github.com/snflkd/fluent-korean), written by a
Korean literature major who was tired of reading it.

---

## Why you might want this

If you give your agent instructions in Korean, you read its answer twice. Once
for the meaning, and once to work out what it actually meant. The same tax applies
to any deliverable that ends up in Korean, including code comments and commit
messages that the agent wrote for you.

Two things make it worse. The first is context length. Agents are set to be brief
to save tokens, and brevity in Korean means dropping the endings that make a
sentence a sentence. The second is compounding: when your agent hands work to a
subagent, and that answer comes back to you, each hop loses a little more.

Here is the same model, same question, asked to describe a project in three Korean
sentences.

**Without the rules:**

> 이 저장소는 DeepSeek Harness라는 AI 에이전트 하네스를 담고 있으며... 일회성(oneshot) 프로파일...

It reaches for a gloss, `일회성(oneshot)`, because the plain Korean word for
"one-shot" did not come readily. The sentence is fine. It is just plainer than a
Korean writer would produce.

**With the rules:**

> ...일회성 실행 프로필... 이벤트를 줄 단위 JSON 이벤트 스트림으로 투영하고...

Full endings. Sino-Korean technical compounds used the way a Korean engineer uses
them. Nothing exotic, just the register you were expecting.

We should be straight about the limits of this comparison. The model we tested was
already good at Korean on its own. So this is a shift in register, not a rescue
from broken output. Expect more from it with a weaker model. Expect less than a
miracle from a strong one.

---

## Why this exists as a Harness plugin

The original project is a Claude Code plugin. Claude Code users could install it in
one command. Everyone else was told to copy the rules out of the repository and
paste them somewhere. That works until you update, and then it quietly rots.

This is the same rules, packaged for DeepSeek Harness. Install it once, pick a
style in Settings, and it applies to every session.

The rules themselves are unchanged. We did not touch a word of the Korean. The
original author wrote them to be read by a model as instructions, and every line
carries an example that shows what it means. Editing them would remove the part
that makes them work. This plugin is packaging, not authorship.

If you want the rules for a model that is not a Harness agent, they are still
plain text in [the original repository](https://github.com/snflkd/fluent-korean).

---

## Two styles

Pick one in Settings. The difference is small.

| Style | Use it when |
| --- | --- |
| **Fluent Korean** | The agent writes code as well as Korean. This one also checks its Korean before it calls a subagent. |
| **Fluent Korean (non-coding)** | The agent is not editing code, so the subagent clause is not relevant. |

> **One honest difference from the Claude Code version.** In Claude Code the
> "non-coding" style removes the built-in coding instructions. Nothing can do that
> in Harness at the top level, because the one component that can replace the whole
> system prompt only works inside a single agent's scope. So both styles here add
> Korean guidance, and neither removes Harness's coding guidance. If you expected
> the second style to silence the coding rules, it will not.

---

## Install

Ask your agent. It is one sentence, and it usually gets it right:

```
https://github.com/mubaid/dsh-fluent-korean 링크 README 읽고, 설치 안내 단락 읽고 어떻게 설치해서 사용할지 설명해줘
```

Or do it yourself:

```
dsh plugin add mubaid/dsh-fluent-korean
```

Then open **Settings → Plugins → Fluent Korean** and choose a style. You do not
need to edit any file. The change applies to the next message, not the next
session.

---

## Want more?

The original author published optional clauses for cases the base rules do not
cover. Ask your agent to append the ones you want to the end of the rules. It
knows where they live.

**If you are new to coding and want the agent to explain things simply:**

```
- 코딩에 관해서는 초보 개발자가 이해할 수 있도록 서술하고, 현장감이 과한 구어체 표현은 더욱 자제합니다. (박아넣다, 치우다, 얹다 등)
```

**If you want it to address you formally:**

```
- 사용자를 '사용자님'이라고 호칭하고, 선어말어미와 어말어미, 조사, 공손어휘를 통해 사용자께 높임말을 사용합니다. 사용자에게 반말이나 비존대로 발화하지 않습니다. [네가 한 말대로 내가 진행할까? → '사용자님'께서 하신 말씀대로 제가 진행하면 될까요?]
```

**If you want it to think in Korean, not just answer in Korean:**

```
- 항상, 한국어로 사고하고, 한국어로 보고하고, 한국어로 출력합니다.
```

**If you work on writing that has its own rules — fiction, scripts, exam papers:**

```
- 구체적인 지침이 따로 존재하는 산출물 유형에는 이 지침을 적용하지 않습니다. 적용 여부가 애매하다면 사용자에게 확인합니다.
```

The original repository has the full set, with more detail on each.

---

## Good to know

- **It costs a few more tokens.** The model puts back the sentence parts and
  endings it dropped. Expect a small increase in message length and in context
  use.
- **It is guidance, not enforcement.** The longer the task runs and the more
  other instructions compete for attention, the more the rules can drift. If you
  notice the style slipping on your main deliverables, tell the agent to check its
  own output against them before it hands the result back.
- **It applies to Korean output.** It is not an instruction to translate. When the
  task needs English, you get English.

---

## Credits

The rules are by [snflkd](https://github.com/snflkd), from
[`snflkd/fluent-korean`](https://github.com/snflkd/fluent-korean), and are used
under the MIT License with the original copyright notice kept in
[LICENSE](LICENSE). See [NOTICE](NOTICE) for the full attribution, and
[UPSTREAM.md](UPSTREAM.md) for a file-by-file account of what came from upstream
and what this port wrote.

Tested with DeepSeek Harness `0.2.0-rc.2`. Details in
[VERIFICATION.md](VERIFICATION.md).