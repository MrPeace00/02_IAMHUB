(function () {
  "use strict";

  const initialSuggestions = [
    { label: "Find a thoughtful gift", prompt: "I need a thoughtful gift" },
    { label: "Something cozy", prompt: "Show me something cozy" },
    { label: "Create custom art", action: "art" },
  ];

  function makeSessionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function normalizeBackend(value) {
    const url = new URL((value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("The AI backend must be a public HTTPS origin");
    }
    return url.origin;
  }

  function sameStoreUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.origin);
      if (url.hostname.endsWith(".myshopify.com") || url.hostname === window.location.hostname) {
        return `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
      }
      return "";
    } catch {
      return "";
    }
  }

  function suggestionsFor(text, artMode) {
    const value = text.toLowerCase();
    if (artMode || /art|graphic|illustration|logo|image/.test(value)) {
      return [
        { label: "Minimal line art", prompt: "Minimal line art, clean and modern", action: "fill" },
        { label: "Bold retro graphic", prompt: "Bold retro graphic with strong shapes", action: "fill" },
        { label: "Soft watercolor", prompt: "Soft watercolor illustration", action: "fill" },
        { label: "Back to shopping", action: "shop" },
      ];
    }
    if (/gift|present/.test(value)) {
      return [
        { label: "For a child", prompt: "It is for a child" },
        { label: "For her", prompt: "It is for a woman" },
        { label: "Cozy and useful", prompt: "Make it cozy and useful" },
      ];
    }
    if (/winter|cozy|shirt|hoodie/.test(value)) {
      return [
        { label: "Women’s fit", prompt: "Show me a women’s fit" },
        { label: "Unisex fit", prompt: "Show me a unisex fit" },
        { label: "Add custom artwork", action: "art" },
      ];
    }
    return [
      { label: "Refine by color", prompt: "Help me narrow it down by color" },
      { label: "Make it a gift", prompt: "Make this suitable as a gift" },
      { label: "Create custom art", action: "art" },
    ];
  }

  function initialize(root) {
    const form = root.querySelector("[data-lazy-form]");
    const input = root.querySelector("[data-lazy-input]");
    const send = root.querySelector("[data-lazy-send]");
    const status = root.querySelector("[data-lazy-status]");
    const chips = root.querySelector("[data-lazy-chips]");
    const results = root.querySelector("[data-lazy-results]");
    const messages = root.querySelector("[data-lazy-messages]");
    const products = root.querySelector("[data-lazy-products]");
    const sessionKey = "lazyCustomsGenerationSession";
    const conversationKey = "shopAiConversationId";
    let backend;
    let artMode = false;
    let busy = false;
    const objectUrls = [];

    try {
      backend = normalizeBackend(root.dataset.backendUrl);
    } catch (error) {
      status.textContent = "AI search is temporarily unavailable.";
      input.disabled = true;
      send.disabled = true;
      console.error(error);
      return;
    }

    let generationSession = sessionStorage.getItem(sessionKey);
    if (!generationSession) {
      generationSession = makeSessionId();
      sessionStorage.setItem(sessionKey, generationSession);
    }

    function setBusy(value, message) {
      busy = value;
      input.disabled = value;
      send.disabled = value;
      status.textContent = message || "";
    }

    function showResults() {
      root.classList.add("has-results");
      results.hidden = false;
    }

    function addMessage(text, role, pending) {
      showResults();
      const element = document.createElement("div");
      element.className = `lazy-home__message lazy-home__message--${role}`;
      if (pending) element.classList.add("lazy-home__message--pending");
      element.textContent = text;
      messages.appendChild(element);
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return element;
    }

    function renderChips(items) {
      chips.replaceChildren();
      items.slice(0, 4).forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lazy-home__chip";
        button.textContent = item.label;
        button.addEventListener("click", () => {
          if (busy) return;
          if (item.action === "art") {
            artMode = true;
            input.value = "";
            input.placeholder = "Describe the artwork you want…";
            status.textContent = "Artwork mode — your PNG will be ready to download.";
            renderChips(suggestionsFor("art", true));
            input.focus();
            return;
          }
          if (item.action === "shop") {
            artMode = false;
            input.value = "";
            input.placeholder = "A cozy winter shirt for her…";
            status.textContent = "";
            renderChips(initialSuggestions);
            input.focus();
            return;
          }
          input.value = item.prompt || "";
          if (item.action === "fill") {
            input.focus();
          } else {
            form.requestSubmit();
          }
        });
        chips.appendChild(button);
      });
    }

    function renderProducts(items) {
      products.replaceChildren();
      if (!Array.isArray(items)) return;
      items.slice(0, 3).forEach((product) => {
        const destination = sameStoreUrl(product.url);
        const card = document.createElement(destination ? "a" : "article");
        card.className = "lazy-home__product";
        if (destination) card.href = destination;

        const media = document.createElement("div");
        media.className = "lazy-home__product-media";
        if (product.image_url) {
          const image = document.createElement("img");
          image.src = product.image_url;
          image.alt = product.title || "Product";
          image.loading = "lazy";
          media.appendChild(image);
        }

        const copy = document.createElement("div");
        copy.className = "lazy-home__product-copy";
        const title = document.createElement("p");
        title.className = "lazy-home__product-title";
        title.textContent = product.title || "Product";
        const price = document.createElement("p");
        price.className = "lazy-home__product-price";
        price.textContent = product.price || "View product";
        copy.append(title, price);
        card.append(media, copy);
        products.appendChild(card);
      });
    }

    function renderArtwork(blob, prompt) {
      showResults();
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.push(objectUrl);

      const card = document.createElement("div");
      card.className = "lazy-home__art-card";
      const image = document.createElement("img");
      image.src = objectUrl;
      image.alt = `Generated artwork: ${prompt}`;

      const actions = document.createElement("div");
      actions.className = "lazy-home__art-actions";
      const download = document.createElement("a");
      download.className = "lazy-home__download";
      download.href = objectUrl;
      download.download = "lazy-custom-art.png";
      download.textContent = "Download PNG";
      const note = document.createElement("p");
      note.className = "lazy-home__art-note";
      note.textContent = "Next: upload this file in the product’s personalization field.";
      actions.append(download, note);
      card.append(image, actions);
      messages.appendChild(card);
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    async function generateArtwork(prompt) {
      addMessage(prompt, "user");
      const pending = addMessage("Creating your artwork", "assistant", true);
      setBusy(true, "Generating one print-ready PNG…");

      try {
        const response = await fetch(`${backend}/generate-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Lazy-Session": generationSession,
          },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Artwork generation failed");
        }

        const blob = await response.blob();
        pending.remove();
        renderArtwork(blob, prompt);
        artMode = false;
        input.placeholder = "Find a product for this artwork…";
        renderChips([
          { label: "Find a shirt", prompt: "Find a shirt for my custom artwork" },
          { label: "Find a hoodie", prompt: "Find a hoodie for my custom artwork" },
          { label: "Create another", action: "art" },
        ]);
        setBusy(false, "Artwork ready.");
      } catch (error) {
        pending.classList.remove("lazy-home__message--pending");
        pending.textContent = error.message || "Artwork generation failed. Please try again.";
        setBusy(false, "");
      }
    }

    async function streamChat(prompt) {
      addMessage(prompt, "user");
      const assistant = addMessage("Thinking", "assistant", true);
      setBusy(true, "Looking through Lazy Customs…");

      try {
        const response = await fetch(`${backend}/chat`, {
          method: "POST",
          headers: {
            "Accept": "text/event-stream",
            "Content-Type": "application/json",
            "X-Shopify-Shop-Id": root.dataset.shopId || "",
          },
          body: JSON.stringify({
            message: prompt,
            conversation_id: sessionStorage.getItem(conversationKey),
            prompt_type: "systemShopping",
          }),
        });

        if (!response.ok || !response.body) throw new Error("Search is temporarily unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          events.forEach((event) => {
            const line = event.split("\n").find((item) => item.startsWith("data: "));
            if (!line) return;
            let data;
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              return;
            }

            if (data.type === "id" && data.conversation_id) {
              sessionStorage.setItem(conversationKey, data.conversation_id);
            } else if (data.type === "chunk") {
              answer += data.chunk || "";
              assistant.classList.remove("lazy-home__message--pending");
              assistant.textContent = answer;
            } else if (data.type === "product_results") {
              renderProducts(data.products);
            } else if (data.type === "error" || data.type === "rate_limit_exceeded") {
              throw new Error(data.details || data.error || "Search is temporarily unavailable");
            }
          });
        }

        assistant.classList.remove("lazy-home__message--pending");
        if (!answer) assistant.textContent = "Tell me one more detail and I’ll narrow it down.";
        renderChips(suggestionsFor(prompt, false));
        setBusy(false, "");
      } catch (error) {
        assistant.classList.remove("lazy-home__message--pending");
        assistant.textContent = error.message || "Search is temporarily unavailable. Please try again.";
        setBusy(false, "");
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (busy) return;
      const prompt = input.value.trim();
      if (!prompt) {
        input.focus();
        return;
      }
      input.value = "";

      const explicitArtwork = /(?:generate|create|make|draw).{0,30}(?:art|artwork|image|graphic|illustration|logo|design)|custom art|artwork/i.test(prompt);
      if (artMode || explicitArtwork) {
        generateArtwork(prompt);
      } else {
        streamChat(prompt);
      }
    });

    window.addEventListener("beforeunload", () => objectUrls.forEach((url) => URL.revokeObjectURL(url)));
    renderChips(initialSuggestions);

    fetch(`${backend}/chat?health=true`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Backend unavailable");
      })
      .catch(() => {
        status.textContent = "AI search is temporarily unavailable.";
      });
  }

  function start() {
    document.querySelectorAll("[data-lazy-home]").forEach(initialize);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
