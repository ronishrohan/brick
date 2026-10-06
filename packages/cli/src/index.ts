#!/usr/bin/env node
import { ArgsError, parseArgs, printHelp } from "./args.js";
import { runModels } from "./commands/models.js";
import { runSessions } from "./commands/sessions.js";
import { runInteractive } from "./modes/interactive.js";
import { runOneShot } from "./modes/oneshot.js";

let args: ReturnType<typeof parseArgs>;
try {
    args = parseArgs(process.argv.slice(2));
} catch (err) {
    if (err instanceof ArgsError) {
        console.error(`error: ${err.message}`);
        process.exit(2);
    }
    throw err;
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
