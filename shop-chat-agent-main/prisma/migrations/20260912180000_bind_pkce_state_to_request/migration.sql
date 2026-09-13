-- PKCE verifier rows are deliberately not copied. They are short-lived and the
-- old rows do not contain an unambiguous conversation/shop binding.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CodeVerifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

DROP TABLE "CodeVerifier";
ALTER TABLE "new_CodeVerifier" RENAME TO "CodeVerifier";

CREATE UNIQUE INDEX "CodeVerifier_state_key" ON "CodeVerifier"("state");
CREATE INDEX "CodeVerifier_state_idx" ON "CodeVerifier"("state");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
