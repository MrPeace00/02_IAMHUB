import { generateAuthUrl } from "./auth.server";
import process from "node:process";
import { getCustomerToken } from "./db.server";

// Required by the storefront's Terms of Service (Agent Terms, Section 14.4(i)):
// every request from an Agent must identify itself via this User-Agent format.
const AGENT_USER_AGENT = "Agent/LazyCustomsChatAssistant";

// Catalog tools (search_catalog, lookup_catalog, get_product) live on the UCP MCP
// endpoint, not the legacy /api/mcp endpoint, and every UCP request must carry an
// agent profile. See shopify.dev/docs/apps/build/storefront-mcp/servers/storefront.
const UCP_AGENT_PROFILE_URL = process.env.UCP_AGENT_PROFILE_URL
  || "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";
const CATALOG_TOOLS = new Set(["search_catalog", "lookup_catalog", "get_product"]);
const CART_TOOLS = new Set(["get_cart", "create_cart", "update_cart"]);

/**
 * Client for interacting with Model Context Protocol (MCP) API endpoints.
 * Manages connections to both customer and storefront MCP endpoints, and handles tool invocation.
 */
class MCPClient {
  /**
   * Creates a new MCPClient instance.
   *
   * @param {string} hostUrl - The base URL for the shop
   * @param {string} conversationId - ID for the current conversation
   * @param {string} shopId - ID of the Shopify shop
   */
  constructor(hostUrl, conversationId, shopId, customerMcpEndpoint) {
    hostUrl = new URL(hostUrl).origin;
    this.tools = [];
    this.customerTools = [];
    this.storefrontTools = [];
    // TODO: Make this dynamic, for that first we need to allow access of mcp tools on password proteted demo stores.
    // Prefer standard cart/policy tools; use UCP carts if only advertised there.
    this.storefrontMcpEndpoint = `${hostUrl}/api/mcp`;
    this.ucpMcpEndpoint = `${hostUrl}/api/ucp/mcp`;
    // Tracks which endpoint (and whether a UCP agent profile is required) each
    // storefront tool must be called on, since tools/list is merged from both.
    this.storefrontToolRouting = new Map();

    const accountHostUrl = hostUrl.replace(/(\.myshopify\.com)$/, '.account$1');
    this.customerMcpEndpoint = customerMcpEndpoint || `${accountHostUrl}/customer/api/mcp`;
    this.customerAccessToken = "";
    this.conversationId = conversationId;
    this.shopId = shopId;
  }

  /**
   * Connects to the customer MCP server and retrieves available tools.
   * Attempts to use an existing token or will proceed without authentication.
   *
   * @returns {Promise<Array>} Array of available customer tools
   * @throws {Error} If connection to MCP server fails
   */
  async connectToCustomerServer() {
    try {
      console.log(`Connecting to MCP server at ${this.customerMcpEndpoint}`);

      if (this.conversationId) {
        const dbToken = await getCustomerToken(this.conversationId);

        if (dbToken && dbToken.accessToken) {
          this.customerAccessToken = dbToken.accessToken;
        } else {
          console.log("No token in database for conversation:", this.conversationId);
        }
      }

      // If we still don't have a token, we'll connect without one
      // and tools that require auth will prompt for it later
      const headers = {
        "Content-Type": "application/json",
        "Authorization": this.customerAccessToken || "",
        "User-Agent": AGENT_USER_AGENT
      };

      const response = await this._makeJsonRpcRequest(
        this.customerMcpEndpoint,
        "tools/list",
        {},
        headers
      );

      // Extract tools from the JSON-RPC response format
      const toolsData = response.result && response.result.tools ? response.result.tools : [];
      const customerTools = this._formatToolsData(toolsData);

      this.customerTools = customerTools;
      this.tools = [...this.storefrontTools, ...customerTools];

      return customerTools;
    } catch (e) {
      console.error("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  /**
   * Connects to the storefront MCP server and retrieves available tools.
   * Queries both the legacy endpoint (cart, policies) and the UCP endpoint
   * (catalog tools), merging the results.
   *
   * @returns {Promise<Array>} Array of available storefront tools
   * @throws {Error} If connection to MCP server fails
   */
  async connectToStorefrontServer() {
    try {
      this.storefrontToolRouting.clear();
      let legacyTools = [];
      try {
        legacyTools = await this._listStorefrontTools(this.storefrontMcpEndpoint, false);
      } catch (e) {
        console.error("Failed to connect to cart/policy MCP server: ", e);
      }
      let ucpTools = [];
      try {
        ucpTools = await this._listStorefrontTools(this.ucpMcpEndpoint, true);
      } catch (e) {
        // UCP catalog endpoint may be unavailable (e.g. store not catalog-eligible yet).
        // Cart/policy tools on the legacy endpoint should still work, so don't fail the whole connection.
        console.error("Failed to connect to UCP MCP server: ", e);
      }

      const storefrontTools = [...legacyTools, ...ucpTools];
      this.storefrontTools = storefrontTools;
      this.tools = [...storefrontTools, ...this.customerTools];

      return storefrontTools;
    } catch (e) {
      console.error("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  /**
   * Fetches and formats the tools/list result from a storefront MCP endpoint,
   * recording which endpoint (and agent-profile requirement) each tool routes to.
   *
   * @private
   * @param {string} endpoint - The MCP endpoint URL
   * @param {boolean} requiresAgentProfile - Whether calls to this endpoint need a UCP agent profile
   * @returns {Promise<Array>} Formatted tools data
   */
  async _listStorefrontTools(endpoint, requiresAgentProfile) {
    console.log(`Connecting to MCP server at ${endpoint}`);

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": AGENT_USER_AGENT
    };

    const params = requiresAgentProfile
      ? { arguments: { meta: { "ucp-agent": { profile: UCP_AGENT_PROFILE_URL } } } }
      : {};

    const response = await this._makeJsonRpcRequest(endpoint, "tools/list", params, headers);

    const toolsData = response.result && response.result.tools ? response.result.tools : [];
    const tools = this._formatToolsData(toolsData).filter(tool =>
      requiresAgentProfile
        ? CATALOG_TOOLS.has(tool.name) || (CART_TOOLS.has(tool.name) && !this.storefrontToolRouting.has(tool.name))
        : !CATALOG_TOOLS.has(tool.name)
    );

    for (const tool of tools) {
      this.storefrontToolRouting.set(tool.name, { endpoint, requiresAgentProfile });
    }

    return tools;
  }

  /**
   * Dispatches a tool call to the appropriate MCP server based on the tool name.
   *
   * @param {string} toolName - Name of the tool to call
   * @param {Object} toolArgs - Arguments to pass to the tool
   * @returns {Promise<Object>} Result from the tool call
   * @throws {Error} If tool is not found or call fails
   */
  async callTool(toolName, toolArgs) {
    if (this.customerTools.some(tool => tool.name === toolName)) {
      return this.callCustomerTool(toolName, toolArgs);
    } else if (this.storefrontTools.some(tool => tool.name === toolName)) {
      return this.callStorefrontTool(toolName, toolArgs);
    } else {
      throw new Error(`Tool ${toolName} not found`);
    }
  }

  /**
   * Calls a tool on the storefront MCP server.
   *
   * @param {string} toolName - Name of the storefront tool to call
   * @param {Object} toolArgs - Arguments to pass to the tool
   * @returns {Promise<Object>} Result from the tool call
   * @throws {Error} If the tool call fails
   */
  async callStorefrontTool(toolName, toolArgs) {
    try {
      console.log("Calling storefront tool", toolName, toolArgs);

      const routing = this.storefrontToolRouting.get(toolName);
      if (!routing) throw new Error(`Storefront tool ${toolName} has not been discovered`);

      const headers = {
        "Content-Type": "application/json",
        "User-Agent": AGENT_USER_AGENT
      };

      const params = {
        name: toolName,
        arguments: toolArgs,
      };

      if (routing.requiresAgentProfile) {
        params.arguments = {
          ...toolArgs,
          meta: { ...toolArgs?.meta, "ucp-agent": { profile: UCP_AGENT_PROFILE_URL } }
        };
      }

      const response = await this._makeJsonRpcRequest(
        routing.endpoint,
        "tools/call",
        params,
        headers
      );

      return response.result || response;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Calls a tool on the customer MCP server.
   * Handles authentication if needed.
   *
   * @param {string} toolName - Name of the customer tool to call
   * @param {Object} toolArgs - Arguments to pass to the tool
   * @returns {Promise<Object>} Result from the tool call or auth error
   * @throws {Error} If the tool call fails
   */
  async callCustomerTool(toolName, toolArgs) {
    try {
      console.log("Calling customer tool", toolName, toolArgs);
      // First try to get a token from the database for this conversation
      let accessToken = this.customerAccessToken;

      if (!accessToken || accessToken === "") {
        const dbToken = await getCustomerToken(this.conversationId);

        if (dbToken && dbToken.accessToken) {
          accessToken = dbToken.accessToken;
          this.customerAccessToken = accessToken; // Store it for later use
        } else {
          console.log("No token in database for conversation:", this.conversationId);
        }
      }

      const headers = {
        "Content-Type": "application/json",
        "Authorization": accessToken,
        "User-Agent": AGENT_USER_AGENT
      };

      try {
        const response = await this._makeJsonRpcRequest(
          this.customerMcpEndpoint,
          "tools/call",
          {
            name: toolName,
            arguments: toolArgs,
          },
          headers
        );

        return response.result || response;
      } catch (error) {
        // Handle 401 specifically to trigger authentication
        if (error.status === 401) {
          console.log("Unauthorized, generating authorization URL for customer");

          // Generate auth URL
          const authResponse = await generateAuthUrl(this.conversationId, this.shopId);

          // Instead of retrying, return the auth URL for the front-end
          return {
            error: {
              type: "auth_required",
              data: `You need to authorize the app to access your customer data. [Click here to authorize](${authResponse.url})`
            }
          };
        }

        // Re-throw other errors
        throw error;
      }
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      return {
        error: {
          type: "internal_error",
          data: `Error calling tool ${toolName}: ${error.message}`
        }
      };
    }
  }

  /**
   * Makes a JSON-RPC request to the specified endpoint.
   *
   * @private
   * @param {string} endpoint - The endpoint URL
   * @param {string} method - The JSON-RPC method to call
   * @param {Object} params - Parameters for the method
   * @param {Object} headers - HTTP headers for the request
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {Error} If the request fails
   */
  async _makeJsonRpcRequest(endpoint, method, params, headers) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: method,
        id: 1,
        params: params
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      const errorObj = new Error(`Request failed: ${response.status} ${error}`);
      errorObj.status = response.status;
      throw errorObj;
    }

    const payload = await response.json();
    if (payload.error) {
      const error = new Error(payload.error.message || "MCP request failed");
      error.code = payload.error.code;
      throw error;
    }
    return payload;
  }

  /**
   * Formats raw tool data into a consistent format.
   *
   * @private
   * @param {Array} toolsData - Raw tools data from the API
   * @returns {Array} Formatted tools data
   */
  _formatToolsData(toolsData) {
    return toolsData.map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema || tool.input_schema,
      };
    });
  }
}

export default MCPClient;
