import process from "node:process";

import { consumeCodeVerifier, getCustomerAccountUrls } from "./db.server.js";

/**
 * Exchange an authorization code using the single-use PKCE request bound to state.
 * @param {string} code - The authorization code
 * @param {string} state - The OAuth state nonce
 * @param {Object} dependencies - Optional test dependencies
 * @returns {Promise<Object>} - Token response and persisted request context
 */
export async function exchangeCodeForToken(code, state, dependencies = {}) {
  const clientId = process.env.SHOPIFY_API_KEY;
  if (!clientId) {
    throw new Error("SHOPIFY_API_KEY is required");
  }

  const redirectUri = process.env.REDIRECT_URL;
  if (!redirectUri) {
    throw new Error("REDIRECT_URL is required");
  }

  const consumeVerifier = dependencies.consumeCodeVerifier ?? consumeCodeVerifier;
  const verifierRecord = await consumeVerifier(state);
  if (!verifierRecord) {
    throw new Error("OAuth state is invalid, expired, or already consumed");
  }

  const { conversationId, shopId, verifier: codeVerifier } = verifierRecord;
  if (!conversationId || !shopId || !codeVerifier) {
    throw new Error("Stored OAuth request is incomplete");
  }

  const resolveTokenUrl = dependencies.getTokenUrl ?? getTokenUrl;
  const tokenUrl = await resolveTokenUrl(conversationId);
  if (!tokenUrl) {
    throw new Error("Token URL not found");
  }

  const formData = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const sendRequest = dependencies.fetch ?? fetch;
  const response = await sendRequest(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  });

  if (!response.ok) {
    console.log("Request id", response.headers.get("x-request-id"));
    console.log("conversation_id", conversationId);
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return {
    tokenResponse: await response.json(),
    conversationId,
    shopId,
  };
}

async function getTokenUrl(conversationId) {
  const { tokenUrl } = await getCustomerAccountUrls(conversationId);
  return tokenUrl;
}
