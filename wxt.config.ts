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
    icons: {
      16: "icons/app-16.png",
      32: "icons/app-32.png",
      48: "icons/app-48.png",
      128: "icons/app-128.png",
    },
    action: {
      default_title: "Curtain",
      default_icon: {
        16: "icons/toolbar-off-light-16.png",
        32: "icons/toolbar-off-light-32.png",
      },
    },
  },
});
