import { Buffer } from "node:buffer";
import process from "node:process";
import { getCorsHeaders, isAllowedOrigin } from "../services/cors.server.js";
import {
  enforceVisionRateLimit,
  getClientIp,
  validateGenerationSession,
} from "../services/generation-rate-limit.server.js";
import { createAnthropicService } from "../services/anthropic.server.js";
import { createSseStream } from "../services/streaming.server.js";
import {
  prepareVisionImage,
  resolveGeneratedVisionImage,
} from "../services/vision-image.server.js";
import {
  buildVisionRequest,
  generateVisionCopy,
  sanitizeVisionContext,
  VISION_TASKS,
} from "../services/vision-copy.server.js";

const MAX_REQUEST_BYTES = 5 * 1024 * 1024 + 32 * 1024;

function jsonResponse(request, body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Cache-Control": "private, no-store",
      ...extraHeaders,
    },
  });
}

function errorResponse(request, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const publicMessage = status >= 500
    ? "Image analysis is temporarily unavailable"
    : error.message;
  if (status >= 500) console.error("Claude vision request failed", error);
  const extraHeaders = error?.retryAfter ? { "Retry-After": String(error.retryAfter) } : {};
  return jsonResponse(request, { error: publicMessage }, status, extraHeaders);
}

async function readVisionInput(request, sessionId) {
  const contentType = request.headers.get("Content-Type") || "";
  let task;
  let context;
  let imageBytes;
  let claimedMediaType;

  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    const form = await request.formData();
    const image = form.get("image");
    if (!image || typeof image.arrayBuffer !== "function") {
      const error = new Error("Choose an image to continue");
      error.status = 400;
      throw error;
    }
    task = form.get("task");
    context = form.get("context");
    claimedMediaType = image.type;
    imageBytes = Buffer.from(await image.arrayBuffer());
  } else if (contentType.toLowerCase().startsWith("application/json")) {
    const payload = await request.json();
    task = payload?.task;
    context = payload?.context;
    imageBytes = resolveGeneratedVisionImage(payload?.image_reference, sessionId);
  } else {
    const error = new Error("Use JSON for generated artwork or multipart form data for an upload");
    error.status = 415;
    throw error;
  }

  if (!VISION_TASKS.has(task)) {
    const error = new Error("Choose a supported image action");
    error.status = 400;
    throw error;
  }

  return {
    task,
    context: sanitizeVisionContext(context),
    image: await prepareVisionImage(imageBytes, claimedMediaType),
  };
}

export async function loader({ request }) {
  if (request.method !== "OPTIONS") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }
  if (!isAllowedOrigin(request)) {
    return jsonResponse(request, { error: "Origin not allowed" }, 403);
  }
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function action({ request }) {
  if (!isAllowedOrigin(request)) {
    return jsonResponse(request, { error: "Origin not allowed" }, 403);
  }

  const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(request, { error: "Image request is too large" }, 413);
  }

  const sessionId = request.headers.get("X-Lazy-Session");
  if (!validateGenerationSession(sessionId)) {
    return jsonResponse(request, { error: "A valid image session is required" }, 400);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse(request, { error: "Image analysis is not configured" }, 503);
  }

  try {
    await enforceVisionRateLimit({
      sessionId,
      ipAddress: getClientIp(request),
    });
    const input = await readVisionInput(request, sessionId);
    if (input.task === "copy") {
      const copy = await generateVisionCopy(input);
      return jsonResponse(request, { copy, source: "anthropic" });
    }

    const aiService = createAnthropicService();
    const responseStream = createSseStream(async (stream) => {
      await aiService.streamResponse(
        buildVisionRequest({ ...input, task: "guidance" }),
        { onText: (chunk) => stream.sendMessage({ type: "chunk", chunk }) },
      );
      stream.sendMessage({ type: "message_complete" });
    });

    return new Response(responseStream, {
      headers: {
        ...getCorsHeaders(request),
        "Cache-Control": "private, no-store",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}
