import { MATCH_PATTERNS } from "@/sites";
import { defineContentScript } from "wxt/utils/define-content-script";
import { startContent } from "./content";

export default defineContentScript({
  matches: [...MATCH_PATTERNS],
  // Before the site renders anything, so past content never paints.
  runAt: "document_start",
  main() {
    startContent();
  },
});
