-- Persist combined session and IP generation limits across Railway restarts.
CREATE TABLE "GenerationRateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "GenerationRateLimit_updatedAt_idx"
ON "GenerationRateLimit"("updatedAt");
