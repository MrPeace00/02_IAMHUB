import assert from "node:assert/strict";
import test from "node:test";

import {
  PRINTIFY_CHOICE_ROUTING_OPTION,
  recordPrintifyFulfillment,
} from "../app/services/fulfillment-record.server.js";
import { createPrintifyClient } from "../app/services/printify.server.js";

const telemetry = {
  orderReference: "shopify-order-101:line-1",
  blueprintId: 77,
  routingOption: PRINTIFY_CHOICE_ROUTING_OPTION,
  productTitle: "PEACE Hoodie",
  variantReference: "34509",
  lineItemReference: "line-1",
  decorationMethod: "dtg",
};

function memoryDatabase() {
  const rows = new Map();
  return {
    rows,
    fulfillmentRecord: {
      async upsert({ where, create, update }) {
        const existing = rows.get(where.orderReference);
        const row = existing ? { ...existing, ...update } : { ...create };
        rows.set(where.orderReference, row);
        return row;
      },
    },
  };
}

function printifyOrder(overrides = {}) {
  return {
    id: "printify-order-501",
    status: "pending",
    address_to: {
      first_name: "Never",
      last_name: "Persist",
      email: "never-persist@example.com",
      address1: "1 Private Lane",
    },
    line_items: [{
      external_id: "line-1",
      variant_id: 34509,
      print_provider_id: 42,
      status: "in-production",
      metadata: { title: "PEACE Hoodie", variant_label: "Black / L" },
    }],
    ...overrides,
  };
}

test("a simulated successful order writes exactly one telemetry-only record", async () => {
  const database = memoryDatabase();
  const timestamp = new Date("2026-09-13T01:00:00.000Z");

  const row = await recordPrintifyFulfillment({
    ...telemetry,
    printifyOrder: printifyOrder(),
    timestamp,
    database,
  });

  assert.equal(database.rows.size, 1);
  assert.deepEqual(row, {
    orderReference: "shopify-order-101:line-1",
    printifyOrderId: "printify-order-501",
    blueprintId: 77,
    printProviderIdSelected: 42,
    routingOption: 99,
    productTitle: "PEACE Hoodie",
    variantReference: "34509",
    decorationMethod: "dtg",
    fulfillmentStatus: "in_production",
    recordedAt: timestamp,
    updatedAt: timestamp,
  });
  for (const prohibited of ["name", "age", "audience", "email", "address", "conversationId"]) {
    assert.equal(Object.hasOwn(row, prohibited), false);
  }
});

test("re-delivery updates the same order reference without a duplicate", async () => {
  const database = memoryDatabase();

  await recordPrintifyFulfillment({
    ...telemetry,
    printifyOrder: printifyOrder(),
    database,
  });
  const updated = await recordPrintifyFulfillment({
    ...telemetry,
    printifyOrder: printifyOrder({
      status: "fulfilled",
      line_items: [{
        external_id: "line-1",
        variant_id: 34509,
        print_provider_id: 42,
        status: "fulfilled",
      }],
    }),
    database,
  });

  assert.equal(database.rows.size, 1);
  assert.equal(updated.fulfillmentStatus, "fulfilled");

  const incompleteRedelivery = await recordPrintifyFulfillment({
    ...telemetry,
    printifyOrder: {},
    database,
  });
  assert.equal(database.rows.size, 1);
  assert.equal(incompleteRedelivery.printProviderIdSelected, 42);
  assert.equal(incompleteRedelivery.fulfillmentStatus, "fulfilled");
});

test("a pending Choice order records option 99 then a status refresh resolves the provider", async () => {
  const database = memoryDatabase();
  const calls = [];
  const responses = [
    { id: "printify-order-501", status: "pending", line_items: [] },
    { id: "printify-order-501", status: "pending", line_items: [] },
    printifyOrder(),
  ];
  const client = createPrintifyClient({
    token: "test-token-not-a-real-secret",
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(responses.shift()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const submitted = await client.submitOrder({
    shopId: "shop-1",
    payload: { external_id: "shopify-order-101", line_items: [] },
    fulfillmentItems: [telemetry],
    database,
  });
  assert.equal(submitted.records[0].routingOption, 99);
  assert.equal(submitted.records[0].printProviderIdSelected, null);
  assert.equal(calls.length, 2);

  const refreshed = await client.refreshOrder({
    shopId: "shop-1",
    orderId: "printify-order-501",
    fulfillmentItems: [telemetry],
    database,
  });
  assert.equal(refreshed.records[0].printProviderIdSelected, 42);
  assert.equal(database.rows.size, 1);
});

test("Printify failures do not write fulfillment records or expose the API token", async () => {
  const database = memoryDatabase();
  const client = createPrintifyClient({
    token: "sensitive-test-token",
    fetchImplementation: async () => new Response(
      JSON.stringify({ message: "order rejected" }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    ),
  });

  await assert.rejects(
    client.submitOrder({
      shopId: "shop-1",
      payload: { external_id: "shopify-order-101", line_items: [] },
      fulfillmentItems: [telemetry],
      database,
    }),
    (error) => {
      assert.match(error.message, /order rejected/);
      assert.doesNotMatch(error.message, /sensitive-test-token/);
      return true;
    },
  );
  assert.equal(database.rows.size, 0);
});
