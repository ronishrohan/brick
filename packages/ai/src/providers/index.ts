import type {
    AssistantMessage,
    Context,
    Model,
    StopReason,
    StreamEvent,
    StreamOptions,
    ToolCallContent,
} from "../types.js";
import { buildRequest } from "./convert.js";
import { parseSSE } from "./sse.js";

export { ollamaModel } from "./ollama.js";
export type { OllamaConfig } from "./ollama.js";
export { openaiModel } from "./openai.js";

// Internal wire chunk shape from OpenAI-compatible streaming responses.
interface OAIChunk {
    choices: Array<{
        delta: {
            content?: string | null;
            tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
            }>;
        };
        finish_reason?: string | null;
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number } | null;
}

function mapFinishReason(raw: string | null | undefined): StopReason {
    if (raw === "tool_calls") return "toolUse";
    if (raw === "length") return "length";
    return "stop";
}

export async function* doStream(
    model: Model,
    context: Context,
    options?: StreamOptions
): AsyncGenerator<StreamEvent> {
    const url = `${model.baseUrl}/v1/chat/completions`;
    const apiKey = options?.apiKey ?? model.apiKey;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const body = buildRequest(model.id, context);

    let response: Response;
    response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        // exactOptionalPropertyTypes: signal must be null, not undefined
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${text}`);
    }

    let accText = "";
    // If the response starts with '{', it might be a text-based tool call.
    // Buffer those deltas and only emit them after confirming it's real text.
    let maybeTextToolCall = false;
    // accumulate tool calls by index since arguments arrive fragmented
    const pendingToolCalls = new Map<number, { id: string; name: string; args: string }>();
    let stopReason: StopReason = "stop";
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const raw of parseSSE(response)) {
        let chunk: OAIChunk;
        try {
            chunk = JSON.parse(raw) as OAIChunk;
        } catch {
            continue;
        }

        if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens;
            outputTokens = chunk.usage.completion_tokens;
        }

        for (const choice of chunk.choices) {
            const delta = choice.delta;

            if (delta.content) {
                if (accText === "" && delta.content.trimStart().startsWith("{")) {
                    maybeTextToolCall = true;
                }
                accText += delta.content;
                if (!maybeTextToolCall) {
                    yield { type: "text_delta", delta: delta.content };
                }
            }

            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    const existing = pendingToolCalls.get(tc.index) ?? {
                        id: "",
                        name: "",
                        args: "",
                    };
                    if (tc.id) existing.id = tc.id;
                    if (tc.function?.name) existing.name += tc.function.name;
                    if (tc.function?.arguments) existing.args += tc.function.arguments;
                    pendingToolCalls.set(tc.index, existing);
                }
            }

            if (choice.finish_reason) {
                stopReason = mapFinishReason(choice.finish_reason);
            }
        }
    }

    // Detect text-based tool calls: some local models output {"name":"...","arguments":{}}
    // as text content instead of using the API's tool_calls field.
    if (pendingToolCalls.size === 0 && accText.trim().startsWith("{")) {
        try {
            const parsed = JSON.parse(accText.trim()) as {
                name?: unknown;
                arguments?: unknown;
            };
            if (
                typeof parsed.name === "string" &&
                parsed.arguments !== null &&
                typeof parsed.arguments === "object"
            ) {
                const textToolCall: ToolCallContent = {
                    type: "toolCall",
                    id: `text-${Date.now()}`,
                    name: parsed.name,
                    arguments: parsed.arguments as Record<string, unknown>,
                };
                // suppress the raw JSON text — it was actually a tool call
                accText = "";
                pendingToolCalls.set(0, {
                    id: textToolCall.id,
                    name: textToolCall.name,
                    args: JSON.stringify(textToolCall.arguments),
                });
                stopReason = "toolUse";
            }
        } catch {
            // not a tool call — keep accText as-is
        }
    }

    // If we buffered text thinking it might be a tool call but it wasn't, emit it now.
    if (maybeTextToolCall && accText) {
        yield { type: "text_delta", delta: accText };
    }

    if (accText) yield { type: "text_end", text: accText };

    // parse accumulated tool calls and emit
    const resolvedToolCalls: ToolCallContent[] = [];
    for (const [, tc] of pendingToolCalls) {
        let args: Record<string, unknown> = {};
        try {
            args = JSON.parse(tc.args) as Record<string, unknown>;
        } catch {
            // model returned malformed JSON — pass empty args
        }
        const toolCall: ToolCallContent = {
            type: "toolCall",
            id: tc.id,
            name: tc.name,
            arguments: args,
        };
        resolvedToolCalls.push(toolCall);
        yield { type: "toolcall_end", toolCall };
    }

    const content: AssistantMessage["content"] = [];
    if (accText) content.push({ type: "text", text: accText });
    for (const tc of resolvedToolCalls) content.push(tc);

    const message: AssistantMessage = {
        role: "assistant",
        content,
        stopReason,
        usage: { inputTokens, outputTokens },
    };

    yield { type: "done", reason: stopReason, message };
}
