/**
 * pi-prompt-toggle
 *
 * Toggle stackable prompt instructions inside a single session. Each enabled
 * toggle appends its instruction to the system prompt on every turn.
 *
 * Your own prompt text is never rewritten: toggles only append to the system
 * prompt, so the model sees exactly what you typed as your message.
 *
 * Usage:
 *   /prompt-toggle              open the checkbox panel (space toggles, enter closes)
 *   /prompt-toggle concise      toggle one entry directly, without the panel
 *   /prompt-toggle off          turn everything off
 *
 * Deliberately one id per invocation. Passing several at once would need a
 * rule for the ones left unmentioned (leave them alone, or turn them off?),
 * and there is no good answer yet. Use the panel for bulk changes.
 *
 * State lives in the current session via pi.appendEntry, so it survives
 * /resume and never touches global or project config files.
 *
 * Toggles are merged from two optional files, project taking precedence:
 *   ~/.pi/agent/extension-settings/pi-prompt-toggle.json   (global, private to you)
 *   <cwd>/.pi/extension-settings/pi-prompt-toggle.json     (project-local)
 *
 * The file is a flat id -> instruction map. The id is what you type after the
 * command, and may be non-ASCII:
 *   {
 *     "english": "Always answer in English.",
 *     "简洁": "回复不超过 5 句话。"
 *   }
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, DynamicBorder, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Spacer, Text } from "@earendil-works/pi-tui";
import {
	activeInstructions,
	BUILTIN_TOGGLES,
	DEFAULT_ENABLED_IDS,
	mergeToggles,
	parseConfig,
	preview,
	type Toggle,
} from "../src/toggles.ts";

const STATE_ENTRY = "prompt-toggle-state";
const CONFIG_SUBDIR = "extension-settings";
const CONFIG_FILE = "pi-prompt-toggle.json";

export default function promptToggleExtension(pi: ExtensionAPI) {
	const enabled = new Set<string>();
	let toggles: Toggle[] = [...BUILTIN_TOGGLES];

	/** Builtins first, then the global config file, then the project one. */
	function loadToggles(cwd: string, ctx: ExtensionContext): void {
		const paths = [
			join(getAgentDir(), CONFIG_SUBDIR, CONFIG_FILE),
			join(cwd, CONFIG_DIR_NAME, CONFIG_SUBDIR, CONFIG_FILE),
		];
		const sources: Record<string, string>[] = [];
		for (const path of paths) {
			if (!existsSync(path)) continue;
			try {
				sources.push(parseConfig(readFileSync(path, "utf-8")));
			} catch (err) {
				ctx.ui.notify(`prompt-toggle: failed to load ${path}: ${err}`, "error");
			}
		}
		toggles = mergeToggles(BUILTIN_TOGGLES, sources);
	}

	function findToggle(id: string): Toggle | undefined {
		return toggles.find((toggle) => toggle.id === id);
	}

	function activeIds(): string[] {
		return toggles.filter((toggle) => enabled.has(toggle.id)).map((toggle) => toggle.id);
	}

	/** Persist immediately on every change, not on turn_start: a toggle must
	 *  survive even if the user switches sessions before talking to the model. */
	function persist(): void {
		pi.appendEntry(STATE_ENTRY, { enabled: activeIds() });
	}

	function updateStatus(ctx: ExtensionContext): void {
		const ids = activeIds();
		if (ids.length === 0) {
			ctx.ui.setStatus("prompt-toggle", undefined);
			return;
		}
		// Prefix is the command name verbatim, so the footer also tells you how to change it.
		ctx.ui.setStatus("prompt-toggle", ctx.ui.theme.fg("accent", `prompt-toggle: ${ids.join(" · ")}`));
	}

	/** Filled circle reads as "on" at a glance; plain ASCII brackets do not. */
	function checkbox(toggle: Toggle): string {
		return `${enabled.has(toggle.id) ? "◉" : "○"} ${toggle.id}`;
	}

	function renderList(): string {
		if (toggles.length === 0) return "(no toggles defined)";
		return toggles.map((toggle) => `${checkbox(toggle)}  ${preview(toggle.instruction)}`).join("\n");
	}

	function flip(id: string, ctx: ExtensionContext): boolean {
		const turningOn = !enabled.has(id);
		if (turningOn) enabled.add(id);
		else enabled.delete(id);
		persist();
		updateStatus(ctx);
		return turningOn;
	}

	/** Checkbox panel. Toggles apply immediately, so enter and esc both just close. */
	async function showPanel(ctx: ExtensionContext): Promise<void> {
		if (toggles.length === 0) {
			ctx.ui.notify("No toggles defined", "warning");
			return;
		}

		// SelectList keeps this array by reference, so mutating a label re-renders it.
		// The id is the command argument; the description shows what it tells the model.
		// Description shows what the toggle actually tells the model, not a restated name.
		const items: SelectItem[] = toggles.map((toggle) => ({
			value: toggle.id,
			label: checkbox(toggle),
			description: preview(toggle.instruction),
		}));

		await ctx.ui.custom<null>((tui, theme, _kb, done) => {
			const container = new Container();
			const accent = (text: string) => theme.fg("accent", text);
			const dim = (text: string) => theme.fg("dim", text);

			const header = new Text("", 0, 0);
			const syncHeader = () => {
				const count = activeIds().length;
				header.setText(`${accent(theme.bold("Prompt Toggles"))}  ${dim(`${count} of ${toggles.length} active`)}`);
			};
			syncHeader();

			const list = new SelectList(
				items,
				Math.min(items.length, 10),
				{
					selectedPrefix: accent,
					selectedText: accent,
					description: (text) => theme.fg("muted", text),
					scrollInfo: dim,
					noMatch: (text) => theme.fg("warning", text),
				},
				// Names are short; give the freed width to the instruction preview.
				{ maxPrimaryColumnWidth: 18 },
			);
			list.onSelect = () => done(null);
			list.onCancel = () => done(null);

			container.addChild(new DynamicBorder(accent));
			container.addChild(header);
			container.addChild(new Spacer(1));
			container.addChild(list);
			container.addChild(new Spacer(1));
			container.addChild(new Text(dim("↑↓ move      space toggle      enter close"), 0, 0));
			container.addChild(new DynamicBorder(accent));

			return {
				render: (width: number) => container.render(width),
				invalidate: () => container.invalidate(),
				handleInput: (data: string) => {
					if (data === " ") {
						const selected = list.getSelectedItem();
						if (selected) {
							flip(selected.value, ctx);
							for (const [index, toggle] of toggles.entries()) items[index].label = checkbox(toggle);
							syncHeader();
						}
					} else {
						list.handleInput(data);
					}
					tui.requestRender();
				},
			};
		});
	}

	pi.registerCommand("prompt-toggle", {
		description: "Toggle stackable prompt instructions",
		getArgumentCompletions: (prefix: string) => {
			const items = [
				...toggles.map((toggle) => ({ value: toggle.id, label: toggle.id, description: preview(toggle.instruction) })),
				{ value: "off", label: "off", description: "Turn everything off" },
			];
			const filtered = items.filter((item) => item.value.startsWith(prefix));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			const arg = args?.trim();

			if (!arg) {
				// custom() is TUI-only; elsewhere fall back to plain text.
				if (ctx.mode === "tui") await showPanel(ctx);
				else ctx.ui.notify(`Units:\n${renderList()}`, "info");
				return;
			}

			if (arg === "off") {
				enabled.clear();
				persist();
				updateStatus(ctx);
				ctx.ui.notify("All toggles off", "info");
				return;
			}

			const toggle = findToggle(arg);
			if (!toggle) {
				const available = toggles.map((u) => u.id).join(", ") || "(none)";
				const hint = /\s/.test(arg) ? " One toggle per command." : "";
				ctx.ui.notify(`Unknown toggle "${arg}".${hint} Available: ${available}`, "error");
				return;
			}

			const turningOn = flip(toggle.id, ctx);
			ctx.ui.notify(turningOn ? `${toggle.id} on` : `${toggle.id} off`, "info");
		},
	});

	// Append instructions of every enabled toggle. The user's prompt is untouched.
	pi.on("before_agent_start", async (event) => {
		const instructions = activeInstructions(toggles, enabled);
		if (instructions.length === 0) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${instructions.join("\n\n")}` };
	});

	// Restore state from the current session file.
	pi.on("session_start", async (_event, ctx) => {
		loadToggles(ctx.cwd, ctx);

		const entries = ctx.sessionManager.getEntries();
		const last = entries
			.filter(
				(entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === STATE_ENTRY,
			)
			.pop() as { data?: { enabled?: string[] } } | undefined;

		enabled.clear();
		if (last) {
			for (const id of last.data?.enabled ?? []) {
				if (findToggle(id)) enabled.add(id);
			}
		} else {
			for (const id of DEFAULT_ENABLED_IDS) {
				if (findToggle(id)) enabled.add(id);
			}
		}
		updateStatus(ctx);
	});
}
