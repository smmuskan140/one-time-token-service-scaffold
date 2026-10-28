// token-service.js
// A single-use, expiring token service backed by Redis.

import crypto from "node:crypto";
import Redis from "ioredis";
import "dotenv/config";

const redis = new Redis(process.env.REDIS_URL);

// Helper: build the Redis key for a token id.
const keyFor = (id) => "token:" + id;

/**
 * Issue a single-use token that expires after ttlSeconds.
 * The value and TTL are stored atomically.
 */
export async function issueToken(payload, ttlSeconds) {
  const tokenId = crypto.randomBytes(16).toString("hex");
  const value = JSON.stringify(payload);
  const stored = await redis.set(keyFor(tokenId), value, "EX", ttlSeconds, "NX");

  // A 128-bit random collision is extraordinarily unlikely, but don't return
  // an id unless Redis confirms that it was stored.
  if (stored !== "OK") {
    throw new Error("Unable to issue token");
  }

  return tokenId;
}

/**
 * Consume a token exactly once using Redis' atomic GETDEL command.
 */
export async function consumeToken(tokenId) {
  const value = await redis.getdel(keyFor(tokenId));

  if (value === null) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, payload: JSON.parse(value) };
}

// Allow other files to close the connection cleanly (used by test.js).
export function closeRedis() {
  return redis.quit();
}
