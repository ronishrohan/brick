import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { stream } from "../src/stream.js";
import type { Context, Model } from "../src/types.js";

const context: Context = {
    messages: [{ role: "user", content: "Say hello" }],
};

const model = (baseUrl: string): Model => ({
    provider: "custom",
    id: "test-model",
    baseUrl,
});

async function withServer(
    onRequest: Parameters<typeof createServer>[0],
    run: (baseUrl: string) => Promise<void>
): Promise<void> {
    const server = createServer(onRequest);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    assert.ok(address && typeof address !== "string");

    try {
        await run(`http://127.0.0.1:${address.port}`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
    }
}

// Retry failures before the provider emits output.
{
    let requests = 0;
    await withServer(
        (_, response) => {
            requests++;
            if (requests === 1) {
                response.writeHead(503).end("temporarily unavailable");
                return;
            }

            response.writeHead(200, { "Content-Type": "text/event-stream" });
            response.end(
                'data: {"choices":[{"delta":{"content":"hello"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
            );
        },
        async (baseUrl) => {
            const events = [];
            for await (const event of stream(model(baseUrl), context, {
                maxRetries: 1,
                retryDelayMs: 0,
            })) {
                events.push(event);
            }

            assert.equal(requests, 2);
            assert.equal(events[0]?.type, "text_delta");
            assert.equal(events.at(-1)?.type, "done");
        }
    );
    console.log("ok: stream retries a pre-output failure");
}

// Error events remain visible, and result() rejects instead of resolving an error message.
await withServer(
    (_, response) => {
        response.writeHead(503).end("unavailable");
    },
    async (baseUrl) => {
        const handle = stream(model(baseUrl), context, { maxRetries: 0 });
        const iterator = handle[Symbol.asyncIterator]();
        const first = await iterator.next();

        assert.equal(first.value?.type, "error");
        if (first.value?.type === "error") {
            assert.equal(first.value.message.errorMessage, "HTTP 503: unavailable");
        }
        assert.equal((await iterator.next()).done, true);
        await assert.rejects(handle.result(), /HTTP 503: unavailable/);
    }
);
console.log("ok: stream errors propagate through result");

// Client errors are surfaced immediately rather than retried.
{
    let requests = 0;
    await withServer(
        (_, response) => {
            requests++;
            response.writeHead(401).end("unauthorized");
        },
        async (baseUrl) => {
            await assert.rejects(
                stream(model(baseUrl), context, { maxRetries: 2, retryDelayMs: 0 }).result(),
                /HTTP 401: unauthorized/
            );
        }
    );
    assert.equal(requests, 1);
    console.log("ok: stream does not retry client errors");
}
