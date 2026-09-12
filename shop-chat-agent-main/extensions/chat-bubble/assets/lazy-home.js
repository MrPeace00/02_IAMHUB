(function () {
  "use strict";

  const initialSuggestions = [
    { label: "Find a thoughtful gift", prompt: "I need a thoughtful gift" },
    { label: "Something cozy", prompt: "Show me something cozy" },
    { label: "Create custom art", action: "art" },
  ];

  const customizationLabels = {
    "text-only": "text-only customization",
    "image-only": "image-only customization",
    "text-on-image": "text on top of an image",
  };

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
    const quizForm = root.querySelector("[data-lazy-quiz-form]");
    const quizName = root.querySelector("[data-quiz-name]");
    const quizAge = root.querySelector("[data-quiz-age]");
    const quizAudience = root.querySelector("[data-quiz-audience]");
    const quizSeason = root.querySelector("[data-quiz-season]");
    const quizCategory = root.querySelector("[data-quiz-category]");
    const quizCustomization = root.querySelector("[data-quiz-customization]");
    const form = root.querySelector("[data-lazy-form]");
    const input = root.querySelector("[data-lazy-input]");
    const send = root.querySelector("[data-lazy-send]");
    const status = root.querySelector("[data-lazy-status]");
    const chips = root.querySelector("[data-lazy-chips]");
    const results = root.querySelector("[data-lazy-results]");
    const messages = root.querySelector("[data-lazy-messages]");
    const products = root.querySelector("[data-lazy-products]");
    const artStart = root.querySelector("[data-lazy-art-start]");
    const imageUpload = root.querySelector("[data-lazy-image-upload]");
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
      artStart.disabled = value;
      imageUpload.disabled = value;
      root.querySelectorAll("[data-lazy-vision-action]").forEach((button) => {
        button.disabled = value;
      });
      status.textContent = message || "";
    }

    function startArtworkMode() {
      if (busy) return;
      artMode = true;
      input.value = "";
      input.placeholder = "Describe the artwork you want…";
      status.textContent = "Artwork mode — your PNG will be ready to download.";
      renderChips(suggestionsFor("art", true));
      input.focus();
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
            startArtworkMode();
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
      items.slice(0, 8).forEach((product) => {
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

    function renderVisionCopy(copy) {
      const result = document.createElement("section");
      result.className = "lazy-home__copy-result";
      const title = document.createElement("h2");
      title.textContent = "Claude image copy";
      const fields = [
        ["Description", copy.description],
        ["Tags", Array.isArray(copy.tags) ? copy.tags.join(", ") : ""],
        ["Alt text", copy.altText],
        ["Caption", copy.caption],
      ];
      const list = document.createElement("dl");
      fields.forEach(([label, value]) => {
        const term = document.createElement("dt");
        const detail = document.createElement("dd");
        term.textContent = label;
        detail.textContent = value || "";
        list.append(term, detail);
      });
      result.append(title, list);
      messages.appendChild(result);
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    async function readVisionStream(response, assistant) {
      if (!response.body) throw new Error("Image advice is temporarily unavailable");
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
          if (data.type === "chunk") {
            answer += data.chunk || "";
            assistant.classList.remove("lazy-home__message--pending");
            assistant.textContent = answer;
          }
          if (data.type === "error" || data.type === "rate_limit_exceeded") {
            throw new Error(data.details || data.error || "Image advice is temporarily unavailable");
          }
        });
      }

      assistant.classList.remove("lazy-home__message--pending");
      if (!answer) assistant.textContent = "I couldn't produce image advice this time.";
    }

    async function requestVision(source, task) {
      if (busy) return;
      const label = task === "copy" ? "Writing product copy" : "Reviewing product options";
      const pending = addMessage(label, "assistant", true);
      setBusy(true, task === "copy" ? "Claude is writing from your image…" : "Claude is reviewing your image…");

      try {
        const headers = { "X-Lazy-Session": generationSession };
        let body;
        if (source.kind === "generated") {
          if (!source.reference) throw new Error("Generate the artwork again before sending it to Claude");
          headers["Content-Type"] = "application/json";
          body = JSON.stringify({ image_reference: source.reference, task });
        } else {
          body = new FormData();
          body.append("image", source.file);
          body.append("task", task);
        }

        const response = await fetch(`${backend}/vision-copy`, {
          method: "POST",
          headers,
          body,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Image analysis failed");
        }

        if (task === "copy") {
          const payload = await response.json();
          pending.remove();
          renderVisionCopy(payload.copy || {});
        } else {
          await readVisionStream(response, pending);
        }
        setBusy(false, "Claude returned text for your image. Your artwork was not changed.");
      } catch (error) {
        pending.classList.remove("lazy-home__message--pending");
        pending.textContent = error.message || "Image analysis failed. Please try again.";
        setBusy(false, "");
      }
    }

    function renderArtwork(blob, prompt, source, generated) {
      showResults();
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.push(objectUrl);

      const card = document.createElement("div");
      card.className = "lazy-home__art-card";
      const image = document.createElement("img");
      image.src = objectUrl;
      image.alt = generated ? `Generated artwork: ${prompt}` : "Uploaded artwork preview";

      const actions = document.createElement("div");
      actions.className = "lazy-home__art-actions";
      const commands = document.createElement("div");
      commands.className = "lazy-home__art-commands";
      if (generated) {
        const download = document.createElement("a");
        download.className = "lazy-home__download";
        download.href = objectUrl;
        download.download = "lazy-custom-art.png";
        download.textContent = "Download PNG";
        commands.appendChild(download);
      }
      const copyButton = document.createElement("button");
      copyButton.className = "lazy-home__vision-action";
      copyButton.dataset.lazyVisionAction = "copy";
      copyButton.type = "button";
      copyButton.textContent = "Write product copy";
      copyButton.addEventListener("click", () => requestVision(source, "copy"));
      const guidanceButton = document.createElement("button");
      guidanceButton.className = "lazy-home__vision-action lazy-home__vision-action--secondary";
      guidanceButton.dataset.lazyVisionAction = "guidance";
      guidanceButton.type = "button";
      guidanceButton.textContent = "Get product advice";
      guidanceButton.addEventListener("click", () => requestVision(source, "guidance"));
      commands.append(copyButton, guidanceButton);
      const note = document.createElement("p");
      note.className = "lazy-home__art-note";
      note.textContent = "Claude returns text about the image. It does not alter the artwork or update the catalog.";
      actions.append(commands, note);
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

        const imageReference = response.headers.get("X-Lazy-Image-Reference");
        const blob = await response.blob();
        pending.remove();
        renderArtwork(blob, prompt, { kind: "generated", reference: imageReference }, true);
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

    function handleImageUpload(file) {
      const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
      if (!allowedTypes.has(file.type)) {
        status.textContent = "Choose a PNG, JPEG, or WebP image.";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        status.textContent = "Choose an image that is 5 MB or smaller.";
        return;
      }

      addMessage(`Uploaded ${file.name || "an image"} for Claude`, "user");
      renderArtwork(file, file.name || "Customer-uploaded artwork", { kind: "upload", file }, false);
      status.textContent = "Image ready. Choose the text you want Claude to create.";
    }

    async function streamChat(prompt, quiz) {
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
            ...(quiz ? { quiz } : {}),
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

    artStart.addEventListener("click", startArtworkMode);
    imageUpload.addEventListener("change", () => {
      const file = imageUpload.files?.[0];
      imageUpload.value = "";
      if (file) handleImageUpload(file);
    });

    if (quizForm) {
      quizForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (busy) return;

        const quiz = {
          name: quizName.value.trim().slice(0, 60),
          age: quizAge.value ? Math.min(Math.max(Number.parseInt(quizAge.value, 10) || 0, 0), 120) : null,
          audience: quizAudience.value,
          season: quizSeason.value,
          category: quizCategory.value,
          customization: quizCustomization.value,
          tags: [
            quizAudience.value,
            quizSeason.value,
            quizCategory.value,
            quizCustomization.value,
          ].filter(Boolean),
        };

        const descriptor = [quiz.category && quiz.category !== "other" ? quiz.category : "custom product"];
        if (customizationLabels[quiz.customization]) descriptor.push(`with ${customizationLabels[quiz.customization]}`);
        if (quiz.audience === "child") descriptor.push(quiz.age ? `for a ${quiz.age}-year-old child` : "for a child");
        else if (quiz.audience) descriptor.push(`for a ${quiz.audience}`);
        if (quiz.season) descriptor.push(`for ${quiz.season}`);
        const message = `Find ${descriptor.join(" ")}.`;

        quizForm.hidden = true;
        streamChat(message, quiz);
      });
    }

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
