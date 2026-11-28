import { defineBackground } from "wxt/utils/define-background";
import { startWorker } from "./worker";

export default defineBackground(() => {
  // Message listeners must be registered as soon as the worker starts, so
  // this runs synchronously; stored state is migrated in the background.
  startWorker();
});
