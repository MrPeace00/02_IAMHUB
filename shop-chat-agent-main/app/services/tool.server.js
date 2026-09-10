/**
 * Normalizes Shopify tool results for storefront product cards.
 */
import AppConfig from "./config.server";

export function createToolService() {
  const formatProductData = (product) => {
    const money = product.price_range?.min?.amount !== undefined
      ? product.price_range.min
      : product.variants?.[0]?.price;
    const price = money && typeof money === "object" && money.currency
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: money.currency }).format(
        money.amount / 10 ** new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: money.currency,
        }).resolvedOptions().maximumFractionDigits,
      )
      : product.price_range
        ? `${product.price_range.currency} ${product.price_range.min}`
        : (product.variants && product.variants.length > 0
          ? `${product.variants[0].currency} ${product.variants[0].price}`
          : "Price not available");

    return {
      id: product.id || product.product_id || `product-${Math.random().toString(36).substring(7)}`,
      title: product.title || "Product",
      price,
      image_url: product.image_url || product.media?.find((item) => item.type === "image")?.url || "",
      description: typeof product.description === "string"
        ? product.description
        : product.description?.plain || "",
      url: product.url || "",
    };
  };

  const processProductSearchResult = (toolUseResponse) => {
    try {
      if (Array.isArray(toolUseResponse.structuredContent?.products)) {
        return toolUseResponse.structuredContent.products
          .slice(0, AppConfig.tools.maxProductsToDisplay)
          .map(formatProductData);
      }

      const firstContent = toolUseResponse.content?.[0]?.text;
      const responseData = typeof firstContent === "string"
        ? JSON.parse(firstContent)
        : firstContent;

      if (!Array.isArray(responseData?.products)) return [];
      return responseData.products
        .slice(0, AppConfig.tools.maxProductsToDisplay)
        .map(formatProductData);
    } catch (error) {
      console.error("Error processing product search results:", error);
      return [];
    }
  };

  return { processProductSearchResult };
}

export default { createToolService };
