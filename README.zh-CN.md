[English](README.md) | 简体中文

# pi-prompt-toggle

在一个 [pi](https://github.com/earendil-works/pi) 会话内，随时开关可叠加的提示词指令。

Agent 回复经常很啰嗦！如果提醒 Agent「在不丢失信息的前提下回复尽可能简洁，永远不要超过 5 句话」，问题会有所改善。

我们可以把通用规则写进全局 `AGENTS.md`，但「永远不要超过 5 句话」一旦加进去，遇到需要深入详细讨论的场景，限制太严反而会讲不清楚。

所以 prompt-toggle 把 prompt 做成了开关，类似快捷键：不需要反复跟 Agent 说这些，需要的时候打开，它就会自动传给 Agent。

可以同时开多个 prompt，从下一条消息开始生效。

```
────────────────────────────────────────────────────────────────────────
Prompt Toggles  1 of 2 active

→ ◉ concise        Be as brief as possible without losing informati…
  ○ no-change      Do not modify any file. Read files and run comma…

↑↓ move      space toggle      enter close
────────────────────────────────────────────────────────────────────────
```

## 安装

```bash
pi install npm:pi-prompt-toggle
```

不想装，只想试试：

```bash
pi -e npm:pi-prompt-toggle
```

## 使用

| 命令 | 作用 |
| :-- | :-- |
| `/prompt-toggle` | 打开勾选面板 |
| `/prompt-toggle concise` | 直接开关某一条 |
| `/prompt-toggle off` | 全部关闭 |

已开启的会显示在状态栏：`prompt-toggle: concise · no-change`。

## 配置

在下面任意一个文件里定义你自己的条目，两个都是可选的：

```
~/.pi/agent/extension-settings/pi-prompt-toggle.json   # 你的私人配置，不进任何仓库
<项目>/.pi/extension-settings/pi-prompt-toggle.json    # 跟着仓库走，可以和同事共享
```

格式是一层的 `id -> 指令` 映射，id 就是你在命令后面敲的东西：

```json
{
  "简洁": "在不丢失信息的前提下回复尽可能简洁，不要讲我已经知道的东西。永远不要超过 5 句话。",
  "不改": "不要修改任何文件。可以随意读文件、执行命令，但把改动作为建议提出来，不要直接动手。"
}
```

上面就是内置两条的中文版。所有来源按 id 合并：换个 id 就是新增一条；同一个 id 出现在多处时只保留一份，优先级是**项目 > 全局 > 内置**。id 支持中文，所以 `/prompt-toggle 简洁` 是可以的。

## 原理

每个开启的条目，都会在每一轮把自己的指令追加到 system prompt 上，走的是 pi 的 `before_agent_start` 事件。

**你自己的消息永远不会被改写。** 这个插件只往 system prompt 追加内容，模型看到的用户消息，和你敲进去的一字不差。

## 设计说明

**一条命令只处理一个 id。** `/prompt-toggle a b` 是有意不支持的。一次传多个，就必须规定那些**没被提到**的条目该怎么办——是保持原样，还是关掉？两种理解都说得通，与其武断选一个，不如让面板来做批量操作：你看到勾上的，就是开着的。

**这不是模式切换器。** 「模式」通常是互斥的，一次只能有一个。这里的条目是叠加的，这正是它存在的意义。

**这不是用来取代 `AGENTS.md` 的。** 任何应该始终生效的规则都该写在那里——零成本，而且不会忘记打开。这个插件只负责那些「价值取决于你此刻在做什么」的要求。

## 许可

Apache-2.0
