import { describe, expect, test } from "bun:test";

describe("Chunk assembly integrity", () => {
  test("blobs assembled in order produce correct output", async () => {
    const parts = [new Blob(["Hello "]), new Blob(["World!"])];
    const combined = new Blob(parts);
    const text = await combined.text();
    expect(text).toBe("Hello World!");
  });

  test("blobs assembled out of order produce wrong output", async () => {
    const parts = [new Blob(["World!"]), new Blob(["Hello "])];
    const combined = new Blob(parts);
    const text = await combined.text();
    // Out of order produces wrong result
    expect(text).not.toBe("Hello World!");
    expect(text).toBe("World!Hello ");
  });

  test("empty blob in array is ignored", async () => {
    const parts = [new Blob(["A"]), new Blob([]), new Blob(["B"])];
    const combined = new Blob(parts);
    const text = await combined.text();
    expect(text).toBe("AB");
  });

  test("missing chunks produce incomplete file", async () => {
    // Simulating what happens when blobs[i] = undefined (sparse array)
    const parts: Blob[] = [];
    parts[0] = new Blob(["chunk0"]);
    // parts[1] is intentionally missing
    parts[2] = new Blob(["chunk2"]);

    const combined = new Blob(parts);
    const text = await combined.text();
    // Blob constructor ignores undefined entries, so only chunk0 and chunk2 remain
    expect(text).toBe("chunk0chunk2");
  });

  test("null in blob array is skipped", async () => {
    const parts = [new Blob(["data"])];
    (parts as any)[1] = null;
    const combined = new Blob(parts as Blob[]);
    const text = await combined.text();
    expect(text).toBe("data");
  });
});

describe("File size calculation", () => {
  test("total encrypted size should match sum of chunks", () => {
    const chunks = [
      { size: 8388608 }, // 8MB
      { size: 8388608 },
      { size: 1048576 }, // 1MB (last chunk)
    ];
    const total = chunks.reduce((acc, chunk) => acc + chunk.size, 0);
    expect(total).toBe(17825792); // ~17MB
  });

  test("chunk count for various file sizes", () => {
    const CHUNK_SIZE = 8388608; // 8MB

    const cases = [
      { size: 0, expected: 0 },
      { size: 1, expected: 1 },
      { size: CHUNK_SIZE, expected: 1 },
      { size: CHUNK_SIZE + 1, expected: 2 },
      { size: CHUNK_SIZE * 5, expected: 5 },
      { size: CHUNK_SIZE * 5 + 1, expected: 6 },
    ];

    for (const { size, expected } of cases) {
      const count = Math.ceil(size / CHUNK_SIZE);
      expect(count).toBe(expected);
    }
  });
});

describe("Concurrent access scenarios", () => {
  test("parallel writes to shared array should use correct indices", () => {
    const results = new Array(5);
    const promises = [2, 0, 4, 1, 3].map((idx, val) => {
      return Promise.resolve().then(() => {
        results[idx] = `item${val}`;
      });
    });

    return Promise.all(promises).then(() => {
      // Each write went to its correct index regardless of completion order
      expect(results[0]).toBe("item1");
      expect(results[1]).toBe("item3");
      expect(results[2]).toBe("item0");
      expect(results[3]).toBe("item4");
      expect(results[4]).toBe("item2");
    });
  });

  test("using push instead of index causes wrong order", () => {
    const results: string[] = [];
    const promises = [2, 0, 4, 1, 3].map((idx) => {
      return Promise.resolve().then(() => {
        results.push(`item${idx}`);
      });
    });

    return Promise.all(promises).then(() => {
      // Push appends in completion order, not index order
      // The order depends on microtask scheduling
      expect(results.length).toBe(5);
      // results may be [item2, item0, item4, item1, item3] or similar
      // but NOT [item0, item1, item2, item3, item4]
      const isOrdered = results.every((value, i) => value === `item${i}`);
      expect(isOrdered).toBe(false);
    });
  });
});

describe("Progress calculation edge cases", () => {
  test("0 chunks should not divide by zero", () => {
    const totalChunks = 0;
    const completed = 0;
    const pct =
      totalChunks > 0 ? Math.round((completed / totalChunks) * 100) : 0;
    expect(pct).toBe(0);
  });

  test("partial progress rounding", () => {
    // 3 out of 10 chunks = 30%
    expect(Math.round((3 / 10) * 100)).toBe(30);
    // 1 out of 3 chunks = 33%
    expect(Math.round((1 / 3) * 100)).toBe(33);
    // 2 out of 3 chunks = 67%
    expect(Math.round((2 / 3) * 100)).toBe(67);
  });

  test("speed calculation with zero elapsed time", () => {
    const elapsed = 0;
    const downloaded = 100;
    const speed = elapsed > 0 ? downloaded / elapsed : 0;
    expect(speed).toBe(0);
  });

  test("ETA with zero speed", () => {
    const speed = 0;
    const remaining = 1000;
    const eta = speed > 0 ? remaining / speed : 0;
    expect(eta).toBe(0);
  });
});
