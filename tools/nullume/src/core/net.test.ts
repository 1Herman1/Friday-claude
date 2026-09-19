import { test } from "node:test";
import assert from "node:assert";
import { RateLimiter, fetchJson } from "./net.js";

test("RateLimiter acquires tokens", async () => {
  const limiter = new RateLimiter(2, 1000);
  await limiter.acquire();
  await limiter.acquire();
  const start = Date.now();
  await limiter.acquire();
  const elapsed = Date.now() - start;
  assert(elapsed > 400, "Third token should be delayed");
});

test("fetchJson handles 429 and retries", async () => {
  let attempts = 0;
  const mockFetch: any = async () => {
    attempts++;
    if (attempts < 2) {
      return new Response(JSON.stringify({}), { status: 429 });
    }
    return new Response(JSON.stringify({ ok: true }));
  };

  const result = await fetchJson("http://test", {
    fetchImpl: mockFetch,
    maxRetries: 3,
  });

  assert.strictEqual(attempts, 2);
  assert(result.ok);
});

test("fetchJson rejects on bad HTTP status", async () => {
  const mockFetch: any = async () => {
    return new Response("error", { status: 500 });
  };

  try {
    await fetchJson("http://test", { fetchImpl: mockFetch, maxRetries: 1 });
    assert.fail("Should throw");
  } catch (e) {
    assert((e as any).message.includes("HTTP"));
  }
});
