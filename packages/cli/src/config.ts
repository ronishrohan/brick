import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brickConfigDir } from "@brick/agent";
import { ollamaModel, openaiModel } from "@brick/ai";
import type { Model } from "@brick/ai";
import type { ParsedArgs } from "./args.js";

export interface BrickConfig {
    defaultModel: string;
    ollamaHost: string;
}

const DEFAULTS: BrickConfig = {
    defaultModel: "ollama/qwen2.5-coder:7b",
    ollamaHost: "http://localhost:11434",
};

export function parseModelString(s: string): { provider: string; id: string } {
    const slashIdx = s.indexOf("/");
    if (slashIdx === -1) {
        return { provider: "ollama", id: s };
    }
    return { provider: s.slice(0, slashIdx), id: s.slice(slashIdx + 1) };
}

export async function loadConfig(overrides?: { model?: string }): Promise<BrickConfig> {
    const configPath = join(brickConfigDir(), "config.json");

    let fileConfig: Partial<BrickConfig> = {};
    try {
        const content = await readFile(configPath, "utf-8");
        fileConfig = JSON.parse(content) as Partial<BrickConfig>;
    } catch {
        // missing or unreadable config — use defaults
    }

    const merged: BrickConfig = {
        defaultModel: fileConfig.defaultModel ?? DEFAULTS.defaultModel,
        ollamaHost: fileConfig.ollamaHost ?? DEFAULTS.ollamaHost,
    };

    if (overrides?.model !== undefined) {
        merged.defaultModel = overrides.model;
    }

    return merged;
}

export async function buildModel(args: Pick<ParsedArgs, "model">): Promise<Model> {
    const config = await loadConfig(args.model !== undefined ? { model: args.model } : undefined);
    const { provider, id } = parseModelString(config.defaultModel);
    return provider === "openai"
        ? openaiModel(id)
        : ollamaModel({ id, baseUrl: config.ollamaHost });
}
