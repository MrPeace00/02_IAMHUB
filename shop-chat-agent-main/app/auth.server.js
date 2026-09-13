/**
 * Authentication service for handling OAuth and PKCE flows
 */

import { randomBytes } from "node:crypto";

/**
 * Generate authorization URL for the customer
 * @param {string} conversationId - The conversation ID to track the auth flow
 * @returns {Promise<Object>} - Object containing the auth URL and conversation ID
 */
export async function generateAuthUrl(conversationId, shopId, dependencies = {}) {
  // Generate authorization URL for the customer
  const clientId = process.env.SHOPIFY_API_KEY;
  const scope = "customer-account-mcp-api:full";
  const responseType = "code";

  // Use the actual app URL for redirect
  const redirectUri = process.env.REDIRECT_URL;

  if (!redirectUri) {
    throw new Error("REDIRECT_URL is required");
  }

  const parsedRedirectUri = new URL(redirectUri);
  if (parsedRedirectUri.protocol !== "https:") {
    throw new Error("REDIRECT_URL must use HTTPS");
  }

  const db = dependencies.storeCodeVerifier
    ? null
    : await import("./db.server.js");
  const storeCodeVerifier = dependencies.storeCodeVerifier ?? db.storeCodeVerifier;
  const resolveBaseAuthUrl = dependencies.getBaseAuthUrl ?? getBaseAuthUrl;

  // OAuth state is an unpredictable, single-use nonce. Request context belongs
  // in the verifier record, not in the value sent through the browser.
  const state = generateState();

  // Generate code verifier and challenge
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // Set code_challenge and code_challenge_method parameters
  const codeChallengeMethod = "S256";
  const baseAuthUrl = await resolveBaseAuthUrl(conversationId);

  if (!baseAuthUrl) {
    throw new Error("Base auth URL not found");
  }

  // Do not issue an authorization URL unless its matching verifier is durable.
  await storeCodeVerifier({ state, verifier, conversationId, shopId });

  const authUrl = new URL(baseAuthUrl);
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    response_type: responseType,
    state,
    code_challenge: challenge,
    code_challenge_method: codeChallengeMethod,
  }).toString();

  return {
    url: authUrl.toString(),
    conversation_id: conversationId
  };
}

/**
 * Generate an unpredictable OAuth state nonce.
 * @returns {string} - A base64url-encoded 256-bit value
 */
export function generateState() {
  return randomBytes(32).toString("base64url");
}

/**
 * Get the base auth URL from the customer MCP API URL
 * @param {string} conversationId - The conversation ID to track the auth flow
 * @returns {Promise<string|null>} - The base auth URL or null if not found
 */
async function getBaseAuthUrl(conversationId) {
  const { getCustomerAccountUrls } = await import('./db.server');
  const { authorizationUrl } = await getCustomerAccountUrls(conversationId);

  return authorizationUrl;
}

/**
 * Generate a code verifier for PKCE
 * @returns {string} - The generated code verifier
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const randomString = convertBufferToString(array);
  return base64UrlEncode(randomString);
}

/**
 * Generate a code challenge from a verifier
 * @param {string} verifier - The code verifier
 * @returns {Promise<string>} - The generated code challenge
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digestOp = await crypto.subtle.digest('SHA-256', data);
  const hash = convertBufferToString(digestOp);
  return base64UrlEncode(hash);
}

/**
 * Convert a buffer to a string
 * @param {ArrayBuffer} buffer - The buffer to convert
 * @returns {string} - The converted string
 */
function convertBufferToString(buffer) {
  const uintArray = new Uint8Array(buffer);
  const numberArray = Array.from(uintArray);
  return String.fromCharCode.apply(null, numberArray);
}

/**
 * Encode a string in base64url format
 * @param {string} str - The string to encode
 * @returns {string} - The encoded string
 */
function base64UrlEncode(str) {
  // Convert string to base64
  let base64 = btoa(str);

  // Make base64 URL-safe by replacing characters
  base64 = base64.replace(/\+/g, "-")
                 .replace(/\//g, "_")
                 .replace(/=+$/, ""); // Remove any trailing '=' padding

  return base64;
}
