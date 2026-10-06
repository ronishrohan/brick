#!/usr/bin/env node
import { ArgsError, type ParsedArgs, parseArgs, printHelp } from "./args.js";
import { runModels } from "./commands/models.js";
import { runSessions } from "./commands/sessions.js";
import { runInteractive } from "./modes/interactive.js";
import { runOneShot } from "./modes/oneshot.js";

let args: ParsedArgs;
try {
    args = parseArgs(process.argv.slice(2));
} catch (err) {
    if (!(err instanceof ArgsError)) throw err;
    console.error(`brick: ${err.message}`);
    console.error("Run 'brick --help' for usage.");
    process.exit(2);
}
if (args.help) {
    printHelp();
    process.exit(0);
}

if (args.subcommand === "interactive") {
    await runInteractive(args);
}
if (args.subcommand === "oneshot" && args.task) {
    await runOneShot(args.task, args);
}
if (args.subcommand === "sessions") {
    await runSessions();
}
if (args.subcommand === "models") {
    await runModels();
}
