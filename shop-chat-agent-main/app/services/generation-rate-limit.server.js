import { createHmac } from "node:crypto";
import process from "node:process";
import prisma from "../db.server";

export class GenerationRateLimitError extends Error {
  constructor(retryAfter) {
    super("Image generation limit reached");
    this.name = "GenerationRateLimitError";
    this.retryAfter = retryAfter;
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function getSecret() {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SHOPIFY_API_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_SECRET is required in production");
  }
  return "lazy-customs-local-development";
}

function bucketKey(kind, value) {
  const digest = createHmac("sha256", getSecret()).update(value).digest("hex");
  return `${kind}:${digest}`;
}

export function getClientIp(request) {
  const connectingIp = request.headers.get("CF-Connecting-IP");
  if (connectingIp) return connectingIp.trim();

  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unavailable";
}

export function validateGenerationSession(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

export async function enforceGenerationRateLimit({ sessionId, ipAddress }) {
  const windowSeconds = boundedInteger(process.env.IMAGE_RATE_WINDOW_SECONDS, 3600, 60, 86400);
  const limits = [
    { key: bucketKey("session", sessionId), limit: boundedInteger(process.env.IMAGE_SESSION_LIMIT, 3, 1, 20) },
    { key: bucketKey("ip", ipAddress), limit: boundedInteger(process.env.IMAGE_IP_LIMIT, 10, 1, 100) },
  ];
  const now = new Date();
  const windowMilliseconds = windowSeconds * 1000;

  await prisma.$transaction(async (transaction) => {
    for (const bucket of limits) {
      const existing = await transaction.generationRateLimit.findUnique({
        where: { key: bucket.key },
      });

      if (!existing || now.getTime() - existing.windowStart.getTime() >= windowMilliseconds) {
        await transaction.generationRateLimit.upsert({
          where: { key: bucket.key },
          create: { key: bucket.key, count: 1, windowStart: now },
          update: { count: 1, windowStart: now },
        });
        continue;
      }

      if (existing.count >= bucket.limit) {
        const retryAfter = Math.max(
          1,
          Math.ceil((existing.windowStart.getTime() + windowMilliseconds - now.getTime()) / 1000),
        );
        throw new GenerationRateLimitError(retryAfter);
      }

      await transaction.generationRateLimit.update({
        where: { key: bucket.key },
        data: { count: { increment: 1 } },
      });
    }
  });
}
