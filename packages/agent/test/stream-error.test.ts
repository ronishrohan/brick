/**
 * Stream errors become a saved terminal agent message.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAgent } from "../src/loop.js";
import { loadSession } from "../src/session.js";
import { FAKE_MODEL, makeFakeStream } from "./helpers.js";

const tmpDir = await mkdtemp(join(tmpdir(), "brick-test-"));
const sessionDir = join(tmpDir, "sessions");

const result = await runAgent("Respond", FAKE_MODEL, {
    cwd: tmpDir,
    sessionDir,
    streamFn: makeFakeStream([{ type: "error", message: "provider unavailable" }]),
});

assert.equal(result.finalMessage.stopReason, "error");
assert.equal(result.finalMessage.errorMessage, "provider unavailable");
assert.deepEqual(result.session.messages.at(-1), result.finalMessage);

const saved = await loadSession(result.session.id, sessionDir);
assert.deepEqual(saved.messages.at(-1), result.finalMessage);
console.log("ok: stream errors become saved agent terminal messages");

await rm(tmpDir, { recursive: true });
