/**
 * Tests for parseArgs.
 */
import assert from "node:assert/strict";
import { ArgsError, parseArgs } from "../src/args.js";

// brick "do a thing" → oneshot with task
{
    const result = parseArgs(["do a thing"]);
    assert.equal(result.subcommand, "oneshot");
    assert.equal(result.task, "do a thing");
    assert.equal(result.help, false);
    console.log("ok: single positional arg → oneshot");
}

// brick (no args) → interactive
{
    const result = parseArgs([]);
    assert.equal(result.subcommand, "interactive");
    assert.equal(result.task, undefined);
    assert.equal(result.help, false);
    console.log("ok: no args → interactive");
}

// brick sessions → sessions subcommand
{
    const result = parseArgs(["sessions"]);
    assert.equal(result.subcommand, "sessions");
    assert.equal(result.task, undefined);
    console.log("ok: sessions → sessions subcommand");
}

// brick models → models subcommand
{
    const result = parseArgs(["models"]);
    assert.equal(result.subcommand, "models");
    assert.equal(result.task, undefined);
    console.log("ok: models → models subcommand");
}

// --model flag
{
    const result = parseArgs(["--model", "ollama/qwen2.5-coder:7b", "do a thing"]);
    assert.equal(result.model, "ollama/qwen2.5-coder:7b");
    assert.equal(result.subcommand, "oneshot");
    assert.equal(result.task, "do a thing");
    console.log("ok: --model flag parsed");
}

// --cwd flag
{
    const result = parseArgs(["--cwd", "/some/path", "do a thing"]);
    assert.equal(result.cwd, "/some/path");
    assert.equal(result.subcommand, "oneshot");
    console.log("ok: --cwd flag parsed");
}

// --session flag
{
    const result = parseArgs(["--session", "abc123"]);
    assert.equal(result.session, "abc123");
    assert.equal(result.subcommand, "interactive");
    console.log("ok: --session flag parsed");
}

// --help sets help: true
{
    const result = parseArgs(["--help"]);
    assert.equal(result.help, true);
    console.log("ok: --help sets help: true");
}

// -h sets help: true
{
    const result = parseArgs(["-h"]);
    assert.equal(result.help, true);
    console.log("ok: -h sets help: true");
}

// multiple positional args join into task
{
    const result = parseArgs(["fix", "the", "bug"]);
    assert.equal(result.subcommand, "oneshot");
    assert.equal(result.task, "fix the bug");
    console.log("ok: multiple positional args join into task");
}

// all flags together
{
    const result = parseArgs([
        "--model",
        "openai/gpt-4",
        "--cwd",
        "/tmp",
        "--session",
        "s1",
        "refactor",
    ]);
    assert.equal(result.subcommand, "oneshot");
    assert.equal(result.task, "refactor");
    assert.equal(result.model, "openai/gpt-4");
    assert.equal(result.cwd, "/tmp");
    assert.equal(result.session, "s1");
    assert.equal(result.help, false);
    console.log("ok: all flags together parsed correctly");
}

// value flags require a value
for (const argv of [
    ["--model"],
    ["--cwd"],
    ["--session"],
    ["--model", "--cwd", "/tmp"],
    ["--model="],
    ["--cwd=  "],
    ["--session="],
]) {
    assert.throws(() => parseArgs(argv), ArgsError, `expected ArgsError for ${argv.join(" ")}`);
}
console.log("ok: value flags without a value throw ArgsError");

// --flag=value form still works
{
    const result = parseArgs(["--model=ollama/x", "--cwd=/tmp", "--session=s1"]);
    assert.equal(result.model, "ollama/x");
    assert.equal(result.cwd, "/tmp");
    assert.equal(result.session, "s1");
    console.log("ok: --flag=value form parsed");
}
