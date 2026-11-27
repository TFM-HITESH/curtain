import { defineConfig } from "wxt";

const supportedSites = [
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
];

export default defineConfig({
  srcDir: "src",
  imports: false,
  manifest: {
    name: "Guest Mode for ChatGPT, Claude & Gemini",
    short_name: "Curtain",
    description:
      "Hide your chat history while sharing your screen or your device. New chats still work and save.",
    permissions: ["storage"],
    host_permissions: supportedSites,
  },
});
