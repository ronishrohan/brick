import type { Model } from "../types.js";

export interface OllamaConfig {
    id: string;
    baseUrl?: string;
}

export function ollamaModel(config: OllamaConfig): Model {
    return {
        provider: "ollama",
        id: config.id,
        baseUrl: config.baseUrl ?? process.env.OLLAMA_HOST ?? "http://localhost:11434",
    };
}
