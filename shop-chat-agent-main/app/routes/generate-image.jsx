import { Buffer } from "node:buffer";
import process from "node:process";
import {
  GenerationRateLimitError,
  enforceGenerationRateLimit,
  getClientIp,
  validateGenerationSession,
} from "../services/generation-rate-limit.server";
import { getCorsHeaders, isAllowedOrigin } from "../services/cors.server";
import { storeGeneratedVisionImage } from "../services/vision-image.server";

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const MAX_BODY_BYTES = 8 * 1024;
const MAX_PROMPT_LENGTH = 1000;

function jsonError(request, status, error, extraHeaders = {}) {
  return Response.json(
    { error },
    { status, headers: { ...getCorsHeaders(request), "Cache-Control": "no-store", ...extraHeaders } },
  );
}

export async function loader({ request }) {
  if (request.method !== "OPTIONS") {
    return jsonError(request, 405, "Method not allowed", { Allow: "POST, OPTIONS" });
  }
  if (!isAllowedOrigin(request)) {
    return jsonError(request, 403, "Origin not allowed");
  }
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function action({ request }) {
  if (!isAllowedOrigin(request)) {
    return jsonError(request, 403, "Origin not allowed");
  }

  const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError(request, 413, "Request is too large");
  }

  const sessionId = request.headers.get("X-Lazy-Session");
  if (!validateGenerationSession(sessionId)) {
    return jsonError(request, 400, "A valid generation session is required");
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonError(request, 400, "Request body must be valid JSON");
  }

  const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
  if (prompt.length < 3 || prompt.length > MAX_PROMPT_LENGTH) {
    return jsonError(request, 400, `Prompt must be between 3 and ${MAX_PROMPT_LENGTH} characters`);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(request, 503, "Artwork generation is not configured");
  }

  try {
    await enforceGenerationRateLimit({
      sessionId,
      ipAddress: getClientIp(request),
    });
  } catch (error) {
    if (error instanceof GenerationRateLimitError) {
      return jsonError(request, 429, "You have reached the artwork limit. Please try again later.", {
        "Retry-After": String(error.retryAfter),
      });
    }
    console.error("Failed to check image generation limit", error);
    return jsonError(request, 503, "Artwork generation is temporarily unavailable");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const openAIResponse = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2.5-flare",
        prompt: `Create original, centered, print-ready artwork from this customer request. Return the artwork only: no product mockup, frame, room, garment, watermark, or presentation scene. Use a transparent background when appropriate. Customer request: ${prompt}`,
        size: "1024x1024",
        quality: "low",
        background: "transparent",
        output_format: "png",
        n: 1,
      }),
      signal: controller.signal,
    });

    const result = await openAIResponse.json();
    if (!openAIResponse.ok) {
      const code = result?.error?.code;
      if (code === "moderation_blocked") {
        return jsonError(request, 400, "That artwork request cannot be generated. Try a different description.");
      }
      console.error("OpenAI image generation failed", openAIResponse.status, code || "unknown_error");
      return jsonError(request, 502, "Artwork generation failed. Please try again.");
    }

    const base64Image = result?.data?.[0]?.b64_json;
    if (!base64Image) {
      console.error("OpenAI image generation returned no image data");
      return jsonError(request, 502, "Artwork generation returned no image");
    }

    const imageBytes = Buffer.from(base64Image, "base64");
    const imageReference = storeGeneratedVisionImage(sessionId, imageBytes);
    return new Response(imageBytes, {
      status: 200,
      headers: {
        ...getCorsHeaders(request),
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="lazy-custom-art.png"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Expose-Headers": "X-Lazy-Image-Reference",
        "X-Lazy-Image-Reference": imageReference,
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return jsonError(request, 504, "Artwork generation timed out. Please try again.");
    }
    console.error("Artwork generation request failed", error);
    return jsonError(request, 502, "Artwork generation failed. Please try again.");
  } finally {
    clearTimeout(timeout);
  }
}
