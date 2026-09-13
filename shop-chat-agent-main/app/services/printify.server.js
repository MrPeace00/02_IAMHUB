import { recordPrintifyFulfillment } from "./fulfillment-record.server.js";

const PRINTIFY_API_BASE_URL = "https://api.printify.com/v1";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} is required`);
  }
  return value.trim();
}

function errorMessage(status, body) {
  const detail = body?.error?.message ?? body?.message;
  return detail
    ? `Printify request failed (${status}): ${detail}`
    : `Printify request failed (${status})`;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Printify returned an invalid JSON response (${response.status})`);
  }
}

export function createPrintifyClient({
  token = process.env.PRINTIFY_API_TOKEN,
  fetchImplementation = fetch,
  baseUrl = PRINTIFY_API_BASE_URL,
  recordFulfillment = recordPrintifyFulfillment,
} = {}) {
  const apiToken = requiredText(token, "PRINTIFY_API_TOKEN");
  if (typeof fetchImplementation !== "function") {
    throw new TypeError("A fetch implementation is required");
  }

  async function request(path, options = {}) {
    const response = await fetchImplementation(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "User-Agent": "LazyCustoms/fulfillment-recorder",
        ...options.headers,
      },
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error(errorMessage(response.status, body));
    return body;
  }

  async function getOrder(shopId, orderId) {
    const safeShopId = encodeURIComponent(requiredText(String(shopId ?? ""), "shopId"));
    const safeOrderId = encodeURIComponent(requiredText(String(orderId ?? ""), "orderId"));
    return request(`/shops/${safeShopId}/orders/${safeOrderId}.json`);
  }

  async function persistFulfillmentItems(printifyOrder, fulfillmentItems, database) {
    if (!Array.isArray(fulfillmentItems) || fulfillmentItems.length === 0) {
      throw new TypeError("fulfillmentItems must contain at least one telemetry item");
    }

    return Promise.all(fulfillmentItems.map((item) => recordFulfillment({
      ...item,
      printifyOrder,
      database,
    })));
  }

  async function submitOrder({ shopId, payload, fulfillmentItems, database }) {
    const safeShopId = encodeURIComponent(requiredText(String(shopId ?? ""), "shopId"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new TypeError("payload is required");
    }

    let order = await request(`/shops/${safeShopId}/orders.json`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Printify Choice may not expose the concrete provider in the initial
    // submission response. Fetch current order details once when possible;
    // callers can invoke refreshOrder later as the status advances.
    const hasResolvedLineItems = order.line_items?.some(
      (item) => Number.isInteger(item?.print_provider_id),
    );
    if (!hasResolvedLineItems && order.id) {
      order = await getOrder(shopId, order.id);
    }

    const records = await persistFulfillmentItems(order, fulfillmentItems, database);
    return { order, records };
  }

  async function refreshOrder({ shopId, orderId, fulfillmentItems, database }) {
    const order = await getOrder(shopId, orderId);
    const records = await persistFulfillmentItems(order, fulfillmentItems, database);
    return { order, records };
  }

  return { getOrder, refreshOrder, submitOrder };
}
