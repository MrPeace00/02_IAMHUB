import process from "node:process";

const productionOrigins = [
  "https://lazycustoms.com",
  "https://www.lazycustoms.com",
  "https://lazy-customs-2.myshopify.com",
  "https://vbw9zu-f7.myshopify.com",
];

function configuredOrigins() {
  const values = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const origins = new Set([...productionOrigins, ...values]);
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:5173");
  }
  return origins;
}

export function isAllowedOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;

  try {
    return configuredOrigins().has(new URL(origin).origin) && new URL(origin).origin === origin;
  } catch {
    return false;
  }
}

export function getCorsHeaders(request, methods = "POST, OPTIONS") {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Accept, X-Lazy-Session, X-Shopify-Shop-Id",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  if (isAllowedOrigin(request)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}
