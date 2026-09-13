English | [简体中文](README.zh-CN.md)

# pi-prompt-toggle

[![npm](https://img.shields.io/npm/v/pi-prompt-toggle)](https://www.npmjs.com/package/pi-prompt-toggle)
[![CI](https://img.shields.io/github/actions/workflow/status/ai-setups/pi-prompt-toggle/ci.yml?label=CI)](https://github.com/ai-setups/pi-prompt-toggle/actions/workflows/ci.yml)
[![downloads](https://img.shields.io/npm/dm/pi-prompt-toggle)](https://www.npmjs.com/package/pi-prompt-toggle)
[![GitHub](https://img.shields.io/github/license/ai-setups/pi-prompt-toggle)](https://github.com/ai-setups/pi-prompt-toggle)

Toggle stackable prompt instructions inside a single [pi](https://github.com/earendil-works/pi) session.

Agents are often far too verbose! Telling the agent "be as brief as possible without losing information, never exceed 5 sentences" does help.

You could put a general rule like that in your global `AGENTS.md`. But once "never exceed 5 sentences" is in there, any discussion that genuinely needs depth gets cut short by a limit that is too strict.

So prompt-toggle turns prompts into switches, much like hotkeys: instead of repeating yourself to the agent, you switch one on when you need it and it is passed along automatically.

Several prompts can be on at once, effective from your next message.

```
────────────────────────────────────────────────────────────────────────
Prompt Toggles  1 of 2 active

→ ◉ concise        Be as brief as possible without losing informati…
  ○ no-change      Do not modify any file. Read files and run comma…

↑↓ move      space toggle      enter close
────────────────────────────────────────────────────────────────────────
```

## Install

```bash
pi install npm:pi-prompt-toggle
```

Or try it without installing:

```bash
pi -e npm:pi-prompt-toggle
```

## Usage

| Command | Effect |
| :-- | :-- |
| `/prompt-toggle` | Open the checkbox panel |
| `/prompt-toggle concise` | Toggle one entry directly |
| `/prompt-toggle off` | Turn everything off |

Active toggles show in the status bar as `prompt-toggle: concise · no-change`.

## Configuration

Define your own entries in either file. Both are optional:

```
~/.pi/agent/extension-settings/pi-prompt-toggle.json   # yours, private
<project>/.pi/extension-settings/pi-prompt-toggle.json # shared with the repo
```

A flat `id -> instruction` map. The id is what you type after the command:

```json
{
  "concise": "Be as brief as possible without losing information or telling me what I already know. Never exceed 5 sentences.",
  "简洁": "在不丢失信息的前提下回复尽可能简洁，不要讲我已经知道的东西。永远不要超过 5 句话。"
}
```

Everything is merged by id. A new id adds an entry; a repeated id keeps only one, in the order **project > global > built-in**. Ids may be non-ASCII, so `/prompt-toggle 简洁` works.

## How it works

Each enabled toggle appends its `instruction` to the system prompt on every turn, via pi's `before_agent_start` event.

**Your own message is never rewritten.** Toggles only append to the system prompt, so the model sees exactly the text you typed.

## Design notes

**One id per command.** `/prompt-toggle a b` is intentionally rejected. Passing several at once needs a rule for the ids you *didn't* mention — leave them alone, or turn them off? Both readings are defensible, so the panel handles bulk changes instead: what you see checked is what's on.

**Not a mode switcher.** Modes are usually mutually exclusive, one at a time. These stack. That's the point.

**Not a replacement for `AGENTS.md`.** Anything that should always apply belongs there — it costs nothing and you cannot forget to switch it on. This is only for instructions whose value depends on what you are doing right now.

## License

Apache-2.0
