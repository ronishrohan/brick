export type Subcommand = "oneshot" | "interactive" | "sessions" | "models";

export interface ParsedArgs {
    subcommand: Subcommand;
    task?: string;
    model?: string;
    cwd?: string;
    session?: string;
    help: boolean;
}

/** Thrown when argv is malformed. `message` is suitable for showing to the user. */
export class ArgsError extends Error {
    override name = "ArgsError";
}

const SUPPORTED_PROVIDERS = ["ollama", "openai"];

function requireValue(flag: string, value: string | undefined): string {
    if (value === undefined || value === "" || value.startsWith("-")) {
        throw new ArgsError(`${flag} requires a value`);
    }
    return value;
}

function validateModel(model: string): string {
    const slashIdx = model.indexOf("/");
    if (slashIdx === -1) return model;
    const provider = model.slice(0, slashIdx);
    const id = model.slice(slashIdx + 1);
    if (provider === "" || id === "") {
        throw new ArgsError(`--model must be <provider/id> or <id>, got "${model}"`);
    }
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
        throw new ArgsError(
            `unknown provider "${provider}" in --model (supported: ${SUPPORTED_PROVIDERS.join(", ")})`
        );
    }
    return model;
}

export function parseArgs(argv: string[]): ParsedArgs {
    let help = false;
    let model: string | undefined;
    let cwd: string | undefined;
    let session: string | undefined;

    const positional: string[] = [];

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === undefined) continue;

        if (arg === "--help" || arg === "-h") {
            help = true;
        } else if (arg === "--model") {
            model = validateModel(requireValue(arg, argv[++i]));
        } else if (arg === "--cwd") {
            cwd = requireValue(arg, argv[++i]);
        } else if (arg === "--session") {
            session = requireValue(arg, argv[++i]);
        } else if (arg.startsWith("--model=")) {
            model = validateModel(requireValue("--model", arg.slice("--model=".length)));
        } else if (arg.startsWith("--cwd=")) {
            cwd = requireValue("--cwd", arg.slice("--cwd=".length));
        } else if (arg.startsWith("--session=")) {
            session = requireValue("--session", arg.slice("--session=".length));
        } else if (arg.startsWith("-")) {
            throw new ArgsError(`unknown option: ${arg}`);
        } else {
            positional.push(arg);
        }
    }

    const base = {
        ...(model !== undefined ? { model } : {}),
        ...(cwd !== undefined ? { cwd } : {}),
        ...(session !== undefined ? { session } : {}),
        help,
    };

    const first = positional[0];

    if (first === "sessions") {
        return { subcommand: "sessions", ...base };
    }
    if (first === "models") {
        return { subcommand: "models", ...base };
    }
    if (first !== undefined) {
        return { subcommand: "oneshot", task: positional.join(" "), ...base };
    }
    return { subcommand: "interactive", ...base };
}

export function printHelp(): void {
    console.log(`brick — AI coding agent

Usage:
  brick [task]              Run a one-shot task
  brick                     Start interactive session
  brick sessions            List past sessions
  brick models              List available models

Options:
  --model <provider/id>     Model to use (default: ollama/qwen2.5-coder:7b)
  --cwd <path>              Working directory
  --session <id>            Resume a session
  --help, -h                Show this help message`);
}
