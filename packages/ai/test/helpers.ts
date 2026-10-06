import { ollamaModel } from "../src/providers/index.js";
import type { Model } from "../src/types.js";

export interface OllamaEnv {
    model: Model;
}

/**
 * Returns ollama config from env, or null if OLLAMA_HOST is not set.
 * Tests that need a real model call this and skip if it returns null.
 */
export function getOllamaEnv(): OllamaEnv | null {
    const host = process.env.OLLAMA_HOST;
    if (!host) return null;
    const modelId = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:1.5b";
    return { model: ollamaModel({ id: modelId, baseUrl: host }) };
}

export function skip(reason: string): never {
    console.log(`skip: ${reason}`);
    process.exit(0);
}
