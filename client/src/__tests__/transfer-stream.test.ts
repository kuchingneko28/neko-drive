import { describe, expect, test } from "bun:test";
import { readFrame } from "../lib/transfer-manager";

function streamOf(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(p);
      controller.close();
    },
  });
}

async function collectFrames(
  parts: Uint8Array[],
  sizes: number[],
): Promise<Uint8Array[]> {
  const reader = streamOf(parts).getReader();
  const frames: Uint8Array[] = [];
  let leftover: Uint8Array | null = null;
  for (const size of sizes) {
    const result = await readFrame(reader, size, leftover);
    leftover = result.leftover;
    frames.push(Uint8Array.from(result.frame));
  }
  return frames;
}

describe("readFrame stream frame assembly", () => {
  test("splits misaligned reads into chunk-aligned frames", async () => {
    const data = new Uint8Array(24);
    for (let i = 0; i < 24; i++) data[i] = i;
    // three reads misaligned with the [10, 10, 4] frame sizes
    const frames = await collectFrames(
      [data.subarray(0, 7), data.subarray(7, 20), data.subarray(20)],
      [10, 10, 4],
    );
    expect(frames.length).toBe(3);
    expect(Array.from(frames[0])).toEqual(Array.from(data.subarray(0, 10)));
    expect(Array.from(frames[1])).toEqual(Array.from(data.subarray(10, 20)));
    expect(Array.from(frames[2])).toEqual(Array.from(data.subarray(20, 24)));
  });

  test("one oversized read coalescing multiple frames stays aligned", async () => {
    // regression: server writes chunks back-to-back and a single read() can
    // span several frames; surplus beyond the first frame must carry over
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const frames = await collectFrames([data], [4, 4, 4]);
    expect(Array.from(frames[0])).toEqual([1, 2, 3, 4]);
    expect(Array.from(frames[1])).toEqual([5, 6, 7, 8]);
    expect(Array.from(frames[2])).toEqual([9, 10, 11, 12]);
  });

  test("frame smaller than carried surplus keeps the remainder", async () => {
    // leftover can exceed the next frame's size (last chunk is usually small)
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const frames = await collectFrames([data], [5, 3]);
    expect(Array.from(frames[0])).toEqual([1, 2, 3, 4, 5]);
    expect(Array.from(frames[1])).toEqual([6, 7, 8]);
  });

  test("rejects when the stream ends before the frame is full", async () => {
    const reader = streamOf([new Uint8Array([1, 2, 3])]).getReader();
    expect(readFrame(reader, 10, null)).rejects.toThrow(/ended early/);
  });

  test("empty reads between frames are handled", async () => {
    const data = new Uint8Array([9, 8, 7, 6, 5, 4]);
    const frames = await collectFrames(
      [new Uint8Array(0), data.subarray(0, 3), data.subarray(3)],
      [3, 3],
    );
    expect(Array.from(frames[0])).toEqual([9, 8, 7]);
    expect(Array.from(frames[1])).toEqual([6, 5, 4]);
  });
});
