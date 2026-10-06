/**
 * ollamaModel — no network required.
 */
import assert from "node:assert/strict";
import { ollamaModel } from "../src/providers/ollama.js";

function test(description: string, fn: () => void): void {
    fn();
    console.log(`ok: ${description}`);
}

const savedHost = process.env.OLLAMA_HOST;

function withEnv(host: string | undefined, fn: () => void): void {
    if (host === undefined) {
        Reflect.deleteProperty(process.env, "OLLAMA_HOST");
    } else {
        process.env.OLLAMA_HOST = host;
    }
    try {
        fn();
    } finally {
        if (savedHost === undefined) {
            Reflect.deleteProperty(process.env, "OLLAMA_HOST");
        } else {
            process.env.OLLAMA_HOST = savedHost;
        }
    }
}

test("sets provider and id", () => {
    const model = ollamaModel({ id: "llama3" });
    assert.equal(model.provider, "ollama");
    assert.equal(model.id, "llama3");
});

test("uses explicit baseUrl", () => {
    withEnv("http://env-host:11434", () => {
        const model = ollamaModel({ id: "llama3", baseUrl: "http://explicit-host:11434" });
        assert.equal(model.baseUrl, "http://explicit-host:11434");
    });
});

test("falls back to OLLAMA_HOST", () => {
    withEnv("http://env-host:11434", () => {
        const model = ollamaModel({ id: "llama3" });
        assert.equal(model.baseUrl, "http://env-host:11434");
    });
});

test("falls back to localhost when OLLAMA_HOST is unset", () => {
    withEnv(undefined, () => {
        const model = ollamaModel({ id: "llama3" });
        assert.equal(model.baseUrl, "http://localhost:11434");
    });
});
