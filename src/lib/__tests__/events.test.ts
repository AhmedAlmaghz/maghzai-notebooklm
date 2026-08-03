import { describe, it, expect } from "vitest";
import { serializeEvent, readNdjsonStream, type DeepSearchEvent } from "@/lib/search/events";

describe("serializeEvent", () => {
    it("serializes a stage event as a single NDJSON line", () => {
        const line = serializeEvent({ type: "stage", stage: "planning" });
        expect(line.endsWith("\n")).toBe(true);
        expect(JSON.parse(line.trim())).toEqual({ type: "stage", stage: "planning" });
    });

    it("serializes a done event", () => {
        expect(JSON.parse(serializeEvent({ type: "done" }).trim())).toEqual({ type: "done" });
    });
});

describe("readNdjsonStream", () => {
    function makeResponse(lines: string[]): Response {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                for (const line of lines) {
                    controller.enqueue(encoder.encode(line));
                }
                controller.close();
            },
        });
        return new Response(body, { status: 200 });
    }

    it("parses each line into an event", async () => {
        const events: DeepSearchEvent[] = [];
        const res = makeResponse([
            serializeEvent({ type: "stage", stage: "retrieving" }),
            serializeEvent({ type: "progress", done: 2, total: 8 }),
            serializeEvent({ type: "done" }),
        ]);
        await readNdjsonStream(res, (e) => events.push(e));
        expect(events).toHaveLength(3);
        expect(events[0]).toEqual({ type: "stage", stage: "retrieving" });
        expect(events[2]).toEqual({ type: "done" });
    });

    it("tolerates partial lines split across chunks", async () => {
        const events: DeepSearchEvent[] = [];
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                // Split a single serialized event across two enqueues.
                const line = serializeEvent({ type: "stage", stage: "merging" });
                const half = Math.floor(line.length / 2);
                controller.enqueue(encoder.encode(line.slice(0, half)));
                controller.enqueue(encoder.encode(line.slice(half)));
                controller.close();
            },
        });
        await readNdjsonStream(new Response(body), (e) => events.push(e));
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: "stage", stage: "merging" });
    });

    it("skips malformed lines but keeps later ones", async () => {
        const events: DeepSearchEvent[] = [];
        const res = makeResponse(["not-json\n", serializeEvent({ type: "done" })]);
        await readNdjsonStream(res, (e) => events.push(e));
        expect(events).toEqual([{ type: "done" }]);
    });

    it("handles a response without a body", async () => {
        const res = new Response(null, { status: 204 });
        let called = false;
        await readNdjsonStream(res, () => {
            called = true;
        });
        expect(called).toBe(false);
    });

    it("flushes a trailing partial line at end of stream", async () => {
        const events: DeepSearchEvent[] = [];
        const res = makeResponse([serializeEvent({ type: "citations", citations: [] })]);
        await readNdjsonStream(res, (e) => events.push(e));
        expect(events).toHaveLength(1);
    });
});
