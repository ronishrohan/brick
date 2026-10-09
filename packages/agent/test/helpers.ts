import type {
    AssistantMessage,
    Context,
    Model,
    StreamEvent,
    StreamHandle,
    StreamOptions,
} from "@brick/ai";
import type { StreamFn } from "../src/types.js";

export const FAKE_MODEL: Model = {
    provider: "ollama",
    id: "fake",
    baseUrl: "http://localhost:0",
};

// A scripted response the fake model will return.
export type FakeResponse =
    | { type: "text"; text: string }
    | { type: "toolCall"; name: string; arguments: Record<string, unknown>; id?: string }
    | { type: "error"; message: string; reason?: "error" | "aborted" };

/**
 * Creates a fake stream function that returns scripted responses in order.
 * Use in AgentOptions.streamFn to test without a real LLM.
 */
export function makeFakeStream(responses: FakeResponse[]): StreamFn {
    let callIndex = 0;

    return (_model: Model, _context: Context, _options?: StreamOptions): StreamHandle => {
        const response = responses[callIndex++];
        if (!response) throw new Error(`no scripted response for stream call ${callIndex}`);

        let finalMessage: AssistantMessage;

        async function* generate(): AsyncGenerator<StreamEvent> {
            if (response.type === "text") {
                yield { type: "text_delta", delta: response.text };
                yield { type: "text_end", text: response.text };
                finalMessage = {
                    role: "assistant",
                    content: [{ type: "text", text: response.text }],
                    stopReason: "stop",
                };
                yield { type: "done", reason: "stop", message: finalMessage };
            } else if (response.type === "toolCall") {
                const toolCall = {
                    type: "toolCall" as const,
                    id: response.id ?? `call-${callIndex}`,
                    name: response.name,
                    arguments: response.arguments,
                };
                yield { type: "toolcall_end", toolCall };
                finalMessage = {
                    role: "assistant",
                    content: [toolCall],
                    stopReason: "toolUse",
                };
                yield { type: "done", reason: "toolUse", message: finalMessage };
            } else {
                finalMessage = {
                    role: "assistant",
                    content: [],
                    stopReason: response.reason ?? "error",
                    errorMessage: response.message,
                };
                yield {
                    type: "error",
                    reason: response.reason ?? "error",
                    message: finalMessage,
                };
            }
        }

        const gen = generate();

        return {
            [Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
                return gen;
            },
            async result(): Promise<AssistantMessage> {
                for await (const _event of gen) {
                    // drain
                }
                return finalMessage;
            },
        };
    };
}
