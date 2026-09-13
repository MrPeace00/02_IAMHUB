import prisma from "../db.server.js";

export const PRINTIFY_CHOICE_ROUTING_OPTION = 99;

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} is required`);
  }
  return value.trim();
}

function requiredInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer`);
  }
  return value;
}

function normalizeStatus(value) {
  const normalized = String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  return normalized || "pending";
}

function lineItemExternalReference(lineItem) {
  return lineItem?.external_id ?? lineItem?.metadata?.external_id ?? null;
}

function selectLineItem(printifyOrder, { lineItemReference, variantReference }) {
  const lineItems = Array.isArray(printifyOrder?.line_items)
    ? printifyOrder.line_items
    : [];

  if (lineItemReference) {
    const byExternalReference = lineItems.find(
      (item) => String(lineItemExternalReference(item)) === String(lineItemReference),
    );
    if (byExternalReference) return byExternalReference;
  }

  const byVariant = lineItems.find(
    (item) => String(item?.variant_id) === String(variantReference),
  );
  if (byVariant) return byVariant;

  return lineItems.length === 1 ? lineItems[0] : null;
}

/**
 * Persist one product-side fulfillment record. Only the explicit allowlist in
 * `data` reaches Prisma, so recipient data in a Printify response cannot be
 * stored accidentally.
 */
export async function recordPrintifyFulfillment({
  orderReference,
  blueprintId,
  routingOption = PRINTIFY_CHOICE_ROUTING_OPTION,
  productTitle,
  variantReference,
  lineItemReference,
  decorationMethod,
  printifyOrder,
  timestamp = new Date(),
  database = prisma,
}) {
  const safeOrderReference = requiredText(orderReference, "orderReference");
  const safeVariantReference = requiredText(String(variantReference ?? ""), "variantReference");
  const lineItem = selectLineItem(printifyOrder, {
    lineItemReference,
    variantReference: safeVariantReference,
  });
  const selectedProvider = Number.isInteger(lineItem?.print_provider_id)
    ? lineItem.print_provider_id
    : null;
  const rawStatus = lineItem?.status ?? printifyOrder?.status;
  const fulfillmentStatus = normalizeStatus(rawStatus);
  const printifyOrderId = printifyOrder?.id ? String(printifyOrder.id) : null;

  const telemetry = {
    blueprintId: requiredInteger(blueprintId, "blueprintId"),
    routingOption: requiredInteger(routingOption, "routingOption"),
    productTitle: requiredText(productTitle, "productTitle"),
    variantReference: safeVariantReference,
    decorationMethod: requiredText(decorationMethod, "decorationMethod").toLowerCase(),
    updatedAt: timestamp,
  };

  return database.fulfillmentRecord.upsert({
    where: { orderReference: safeOrderReference },
    create: {
      orderReference: safeOrderReference,
      ...telemetry,
      printifyOrderId,
      printProviderIdSelected: selectedProvider,
      fulfillmentStatus,
      recordedAt: timestamp,
    },
    update: {
      ...telemetry,
      ...(printifyOrderId ? { printifyOrderId } : {}),
      ...(selectedProvider ? { printProviderIdSelected: selectedProvider } : {}),
      ...(rawStatus ? { fulfillmentStatus } : {}),
    },
  });
}
