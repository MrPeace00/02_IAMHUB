// Standalone check that OPENAI_API_KEY can generate an image, independent of the app server.
// Run with: node --env-file=.env test-image.mjs
import { writeFile } from "node:fs/promises";
import process from "node:process";

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "YOUR_OPENAI_API_KEY") {
  console.error("Set a real OPENAI_API_KEY in .env before running this check.");
  process.exit(1);
}

const response = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-image-2.5-flare",
    prompt: "A minimalist line-art fox, print-ready, transparent background",
    size: "1024x1024",
    quality: "low",
    background: "transparent",
    output_format: "png",
    n: 1,
  }),
});

const result = await response.json();

if (!response.ok) {
  console.error("OpenAI request failed:", response.status, JSON.stringify(result.error ?? result, null, 2));
  process.exit(1);
}

const base64Image = result?.data?.[0]?.b64_json;
if (!base64Image) {
  console.error("No image returned:", JSON.stringify(result, null, 2));
  process.exit(1);
}

await writeFile("test-image-output.png", Buffer.from(base64Image, "base64"));
console.log("Success: wrote test-image-output.png");
