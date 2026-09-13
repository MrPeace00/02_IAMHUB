-- Product-side fulfillment telemetry only. This table deliberately has no
-- customer name, age, audience, email, address, or conversation identifier.
CREATE TABLE "FulfillmentRecord" (
    "orderReference" TEXT NOT NULL PRIMARY KEY,
    "printifyOrderId" TEXT,
    "blueprintId" INTEGER NOT NULL,
    "printProviderIdSelected" INTEGER,
    "routingOption" INTEGER NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantReference" TEXT NOT NULL,
    "decorationMethod" TEXT NOT NULL,
    "fulfillmentStatus" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "FulfillmentRecord_blueprintId_idx"
ON "FulfillmentRecord"("blueprintId");

CREATE INDEX "FulfillmentRecord_printProviderIdSelected_idx"
ON "FulfillmentRecord"("printProviderIdSelected");

CREATE INDEX "FulfillmentRecord_fulfillmentStatus_idx"
ON "FulfillmentRecord"("fulfillmentStatus");
