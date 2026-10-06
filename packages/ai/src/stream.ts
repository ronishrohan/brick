import { doStream } from "./providers/index.js";
import type { AssistantMessage, Context, Model, StreamEvent, StreamOptions } from "./types.js";

export interface StreamHandle {
    [Symbol.asyncIterator](): AsyncIterator<StreamEvent>;
    result(): Promise<AssistantMessage>;
}

export function stream(model: Model, context: Context, options?: StreamOptions): StreamHandle {
    let finalMessage: AssistantMessage | undefined;
    let streamError: unknown;
    let hasStreamError = false;

    const maxRetries = options?.maxRetries ?? 2;
    const retryDelayMs = options?.retryDelayMs ?? 250;

    async function* generate(): AsyncGenerator<StreamEvent> {
        let retries = 0;

        while (true) {
            let emittedEvent = false;

            try {
                for await (const event of doStream(model, context, options)) {
                    emittedEvent = true;
                    if (event.type === "done" || event.type === "error") {
                        finalMessage = event.message;
                    }
                    yield event;
                }
                return;
            } catch (err) {
                const aborted =
                    options?.signal?.aborted || (err instanceof Error && err.name === "AbortError");

                if (!aborted && !emittedEvent && isRetryable(err) && retries < maxRetries) {
                    retries++;
                    await waitForRetry(retryDelayMs * 2 ** (retries - 1), options?.signal);
                    continue;
                }

                const message: AssistantMessage = {
                    role: "assistant",
                    content: [],
                    stopReason: aborted ? "aborted" : "error",
                    errorMessage: err instanceof Error ? err.message : String(err),
                };
                finalMessage = message;
                streamError = err;
                hasStreamError = true;
                yield { type: "error", reason: aborted ? "aborted" : "error", message };
                throw err;
            }
        }
    }

    const gen = generate();

    return {
        [Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
            return gen;
        },
        async result(): Promise<AssistantMessage> {
            for await (const _event of gen) {
                // drain remaining events — final message is captured in generate()
            }
            if (hasStreamError) throw streamError;
            if (!finalMessage) throw new Error("stream completed without a final message");
            return finalMessage;
        },
    };
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
    if (delayMs <= 0 || signal?.aborted) return Promise.resolve();

    return new Promise((resolve) => {
        const timeout = setTimeout(cleanup, delayMs);

        function cleanup(): void {
            clearTimeout(timeout);
            signal?.removeEventListener("abort", cleanup);
            resolve();
        }

        signal?.addEventListener("abort", cleanup, { once: true });
    });
}

function isRetryable(err: unknown): boolean {
    if (!(err instanceof Error)) return true;

    const status = /^HTTP (\d{3}):/.exec(err.message)?.[1];
    if (!status) return true;

    const code = Number(status);
    return code === 408 || code === 429 || code >= 500;
}
