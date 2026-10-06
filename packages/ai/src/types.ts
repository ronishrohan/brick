import type { TObject } from "@sinclair/typebox";

// --- models ---

export type Provider = "ollama" | "openai" | "custom";

export interface Model {
    provider: Provider;
    id: string;
    baseUrl: string;
    apiKey?: string;
}

// --- message content blocks ---

export interface TextContent {
    type: "text";
    text: string;
}

export interface ImageContent {
    type: "image";
    data: string; // base64
    mimeType: string;
}

export interface ToolCallContent {
    type: "toolCall";
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

// --- messages ---

export interface UserMessage {
    role: "user";
    content: string | Array<TextContent | ImageContent>;
}

export interface AssistantMessage {
    role: "assistant";
    content: Array<TextContent | ToolCallContent>;
    stopReason: StopReason;
    usage?: Usage;
    errorMessage?: string;
}

export interface ToolResultMessage {
    role: "toolResult";
    toolCallId: string;
    toolName: string;
    content: Array<TextContent | ImageContent>;
    isError: boolean;
}

export type Message = UserMessage | AssistantMessage | ToolResultMessage;

// --- tools ---

export interface Tool {
    name: string;
    description: string;
    parameters: TObject;
}

// --- context ---

export interface Context {
    systemPrompt?: string;
    messages: Message[];
    tools?: Tool[];
}

// --- usage ---

export interface Usage {
    inputTokens: number;
    outputTokens: number;
}

// --- stop reasons ---

export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

// --- stream options ---

export interface StreamOptions {
    signal?: AbortSignal;
    apiKey?: string;
    /** Number of retries after a failed attempt that produced no stream events. Defaults to 2. */
    maxRetries?: number;
    /** Initial delay in milliseconds between retries. Defaults to 250. */
    retryDelayMs?: number;
}

// --- stream events ---

export type StreamEvent =
    | { type: "text_delta"; delta: string }
    | { type: "text_end"; text: string }
    | { type: "toolcall_end"; toolCall: ToolCallContent }
    | { type: "done"; reason: StopReason; message: AssistantMessage }
    | { type: "error"; reason: "error" | "aborted"; message: AssistantMessage };
