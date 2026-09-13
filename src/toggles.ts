/**
 * Pure helpers behind the extension: no file system, no pi APIs, so they can
 * be unit tested directly.
 */

export interface Toggle {
	id: string;
	instruction: string;
}

/** Shipped toggles. Any id redefined in a config file overrides the entry here. */
export const BUILTIN_TOGGLES: Toggle[] = [
	{
		id: "concise",
		instruction:
			"Be as brief as possible without losing information or telling me what I already know. Never exceed 3 sentences.",
	},
	{
		id: "no-change",
		instruction:
			"Do not modify any file. Read files and run commands freely, but propose changes instead of applying them.",
	},
];

/** IDs enabled by default when no saved state exists. */
export const DEFAULT_ENABLED_IDS: ReadonlySet<string> = new Set(["concise", "no-change"]);

/**
 * Parse one config file: a flat id -> instruction map.
 *
 * Throws on anything malformed rather than skipping the entry, so a typo
 * surfaces instead of silently dropping a toggle the user expected to have.
 */
export function parseConfig(raw: string): Record<string, string> {
	const parsed: unknown = JSON.parse(raw);
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("config must be a JSON object of id -> instruction");
	}
	for (const [id, instruction] of Object.entries(parsed)) {
		if (typeof instruction !== "string" || instruction.length === 0) {
			throw new Error(`toggle "${id}" must map to a non-empty instruction string`);
		}
	}
	return parsed as Record<string, string>;
}

/**
 * Merge sources by id. Later sources win, so callers pass them in ascending
 * priority: built-ins, then global config, then project config.
 */
export function mergeToggles(builtins: Toggle[], sources: Record<string, string>[]): Toggle[] {
	const merged = new Map<string, Toggle>(builtins.map((toggle) => [toggle.id, toggle]));
	for (const source of sources) {
		for (const [id, instruction] of Object.entries(source)) merged.set(id, { id, instruction });
	}
	return [...merged.values()];
}

/**
 * Cut on a character boundary with an explicit ellipsis, so a list never ends
 * mid-word and the reader can tell text was omitted.
 */
export function preview(text: string, limit = 32): string {
	return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/** Instructions of the enabled toggles, in definition order. */
export function activeInstructions(toggles: Toggle[], enabled: ReadonlySet<string>): string[] {
	return toggles.filter((toggle) => enabled.has(toggle.id)).map((toggle) => toggle.instruction);
}
