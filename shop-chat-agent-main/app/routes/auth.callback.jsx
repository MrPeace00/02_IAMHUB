import { exchangeCodeForToken } from "../auth-callback.server.js";
import { storeCustomerToken } from "../db.server";

/**
 * Handle OAuth callback from Shopify Customer API
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response(JSON.stringify({ error: "Authorization code is missing" }), { status: 400 });
  }

  if (!state) {
    return new Response(JSON.stringify({ error: "OAuth state is missing" }), { status: 400 });
  }

  try {
    // Exchange code for access token
    const { tokenResponse, conversationId } = await exchangeCodeForToken(code, state);

    // Store token in database
    try {
      // Calculate expiration date based on expires_in (seconds)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

      // Store in database with conversation ID
      await storeCustomerToken(
        conversationId,
        tokenResponse.access_token,
        expiresAt
      );

      console.log('Stored customer token in database for conversation:', conversationId);
    } catch (error) {
      console.error('Failed to store token in database:', error);
      // Continue anyway to not disrupt user flow
    }

    // Instead of redirecting, return HTML that auto-closes the tab
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          window.onload = function() {
            // Show success message briefly before closing
            document.getElementById('message').style.display = 'block';
            // Close the tab after a short delay
            setTimeout(function() {
              window.close();
              // In case window.close() doesn't work (common in some browsers)
              document.getElementById('fallback').style.display = 'block';
            }, 1500);
          }
        </script>
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding-top: 100px; }
          #message { display: none; }
          #fallback { display: none; margin-top: 20px; }
          .success { color: green; font-size: 18px; }
        </style>
      </head>
      <body>
        <div id="message">
          <h2>Authentication Successful!</h2>
          <p class="success">You've been authenticated successfully</p>
          <p>This window will close automatically.</p>
        </div>
        <div id="fallback">
          <p>If this window didn't close automatically, you can close it and return to your conversation.</p>
        </div>
      </body>
      </html>
    `, {
      headers: {
        "Content-Type": "text/html"
      }
    });
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return new Response(JSON.stringify({ error: "Failed to obtain access token" }), { status: 500 });
  }
}
