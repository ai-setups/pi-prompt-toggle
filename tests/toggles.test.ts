import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	activeInstructions,
	BUILTIN_TOGGLES,
	mergeToggles,
	parseConfig,
	preview,
	type Toggle,
} from "../src/toggles.ts";

describe("parseConfig", () => {
	it("reads a flat id -> instruction map", () => {
		assert.deepEqual(parseConfig('{"a":"first","b":"second"}'), { a: "first", b: "second" });
	});

	it("accepts non-ASCII ids, which are usable as command arguments", () => {
		assert.deepEqual(parseConfig('{"简洁":"回复不超过 5 句话。"}'), { 简洁: "回复不超过 5 句话。" });
	});

	it("accepts an empty object", () => {
		assert.deepEqual(parseConfig("{}"), {});
	});

	// Rejecting rather than skipping is deliberate: a silently dropped entry
	// looks identical to a toggle that simply does nothing.
	it("rejects a non-string instruction", () => {
		assert.throws(() => parseConfig('{"a":42}'), /must map to a non-empty instruction string/);
	});

	it("rejects an empty instruction", () => {
		assert.throws(() => parseConfig('{"a":""}'), /must map to a non-empty instruction string/);
	});

	it("rejects the nested object shape used before the config was flattened", () => {
		assert.throws(() => parseConfig('{"a":{"instruction":"x"}}'), /must map to a non-empty instruction string/);
	});

	it("rejects a top-level array", () => {
		assert.throws(() => parseConfig('["a"]'), /must be a JSON object/);
	});

	it("rejects top-level null", () => {
		assert.throws(() => parseConfig("null"), /must be a JSON object/);
	});

	it("propagates invalid JSON", () => {
		assert.throws(() => parseConfig("{ not json"), SyntaxError);
	});
});

describe("mergeToggles", () => {
	const builtins: Toggle[] = [
		{ id: "concise", instruction: "builtin concise" },
		{ id: "no-change", instruction: "builtin no-change" },
	];

	it("returns the builtins when there is no config", () => {
		assert.deepEqual(mergeToggles(builtins, []), builtins);
	});

	it("adds entries under new ids", () => {
		const merged = mergeToggles(builtins, [{ extra: "added" }]);
		assert.deepEqual(
			merged.map((t) => t.id),
			["concise", "no-change", "extra"],
		);
	});

	it("lets a later source override an earlier one", () => {
		const merged = mergeToggles(builtins, [{ concise: "from global" }, { concise: "from project" }]);
		assert.equal(merged.find((t) => t.id === "concise")?.instruction, "from project");
	});

	it("keeps one entry per id, never duplicating or concatenating", () => {
		const merged = mergeToggles(builtins, [{ concise: "a" }, { concise: "b" }]);
		assert.equal(merged.filter((t) => t.id === "concise").length, 1);
	});

	it("leaves untouched builtins in place when a sibling is overridden", () => {
		const merged = mergeToggles(builtins, [{ concise: "from project" }]);
		assert.equal(merged.find((t) => t.id === "no-change")?.instruction, "builtin no-change");
	});

	it("preserves builtin order and appends new ids", () => {
		const merged = mergeToggles(builtins, [{ zzz: "last" }, { concise: "still first" }]);
		assert.deepEqual(
			merged.map((t) => t.id),
			["concise", "no-change", "zzz"],
		);
	});

	it("does not mutate the builtins it was given", () => {
		mergeToggles(builtins, [{ concise: "overridden" }]);
		assert.equal(builtins[0].instruction, "builtin concise");
	});
});

describe("activeInstructions", () => {
	const toggles: Toggle[] = [
		{ id: "a", instruction: "first" },
		{ id: "b", instruction: "second" },
	];

	it("returns nothing when none are enabled", () => {
		assert.deepEqual(activeInstructions(toggles, new Set()), []);
	});

	it("stacks every enabled instruction", () => {
		assert.deepEqual(activeInstructions(toggles, new Set(["a", "b"])), ["first", "second"]);
	});

	it("follows definition order, not the order entries were enabled", () => {
		assert.deepEqual(activeInstructions(toggles, new Set(["b", "a"])), ["first", "second"]);
	});

	it("ignores ids that no longer exist, so a removed config entry cannot crash a restored session", () => {
		assert.deepEqual(activeInstructions(toggles, new Set(["a", "deleted"])), ["first"]);
	});
});

describe("preview", () => {
	it("leaves short text alone", () => {
		assert.equal(preview("short", 32), "short");
	});

	it("leaves text of exactly the limit alone", () => {
		assert.equal(preview("x".repeat(32), 32), "x".repeat(32));
	});

	it("truncates and marks the omission", () => {
		assert.equal(preview("x".repeat(40), 32), `${"x".repeat(32)}…`);
	});

	it("counts characters, so CJK text is not cut mid-character", () => {
		assert.equal(preview("简洁模式说明文字", 4), "简洁模式…");
	});
});

describe("BUILTIN_TOGGLES", () => {
	it("has unique ids, since ids address entries in the command and config", () => {
		const ids = BUILTIN_TOGGLES.map((t) => t.id);
		assert.equal(new Set(ids).size, ids.length);
	});

	it("ships ids that are safe to type as a command argument", () => {
		for (const { id } of BUILTIN_TOGGLES) assert.match(id, /^[a-z][a-z0-9-]*$/);
	});

	it("ships a non-empty instruction for every entry", () => {
		for (const { instruction } of BUILTIN_TOGGLES) assert.ok(instruction.length > 0);
	});

	it("reserves 'off', which the command uses to clear everything", () => {
		assert.ok(!BUILTIN_TOGGLES.some((t) => t.id === "off"));
	});
});
