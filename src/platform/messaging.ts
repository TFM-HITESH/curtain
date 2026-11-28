import { browser, type Browser } from "wxt/browser";

/**
 * Typed messages between content scripts, extension pages and the background
 * worker.
 *
 * A message map lists each message type with its request and response. Every
 * message is wrapped in an envelope, so messages that aren't Curtain's are
 * ignored, and errors thrown by a handler come back to the sender as errors.
 */

/** Any interface whose properties each have a `request` and a `response`. */
export type MessageMap<M> = {
  readonly [K in keyof M]: {
    readonly request: unknown;
    readonly response: unknown;
  };
};

export type MessageSender = Browser.runtime.MessageSender;

export type Handlers<M extends MessageMap<M>> = {
  readonly [K in keyof M]?: (
    request: M[K]["request"],
    sender: MessageSender,
  ) => M[K]["response"] | Promise<M[K]["response"]>;
};

type Handler = (request: unknown, sender: MessageSender) => unknown;

interface Envelope {
  readonly curtain: true;
  readonly type: string;
  readonly request: unknown;
}

type Reply =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string };

function isEnvelope(message: unknown): message is Envelope {
  return (
    typeof message === "object" &&
    message !== null &&
    "curtain" in message &&
    message.curtain === true &&
    "type" in message &&
    typeof message.type === "string"
  );
}

function isReply(value: unknown): value is Reply {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof value.ok === "boolean"
  );
}

export interface Messenger<M extends MessageMap<M>> {
  /** Sends a message and resolves with the handler's response. */
  send<K extends keyof M & string>(
    type: K,
    request: M[K]["request"],
  ): Promise<M[K]["response"]>;
  /** Handles the given message types. Returns a function that stops handling. */
  handle(handlers: Handlers<M>): () => void;
}

export function createMessenger<M extends MessageMap<M>>(): Messenger<M> {
  return {
    async send(type, request) {
      const envelope: Envelope = { curtain: true, type, request };
      const reply: unknown = await browser.runtime.sendMessage(envelope);
      if (!isReply(reply)) throw new Error(`Nothing handled "${type}".`);
      if (!reply.ok) throw new Error(reply.error);
      return reply.value;
    },

    handle(handlers) {
      const listener = (
        message: unknown,
        sender: MessageSender,
        sendResponse: (reply: Reply) => void,
      ): boolean => {
        if (!isEnvelope(message)) return false;
        const handler = (handlers as Record<string, Handler | undefined>)[
          message.type
        ];
        if (!handler) return false;
        Promise.resolve()
          .then(() => handler(message.request, sender))
          .then(
            (value: unknown) => {
              sendResponse({ ok: true, value });
            },
            (error: unknown) => {
              sendResponse({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              });
            },
          );
        // Keep the channel open for the asynchronous response.
        return true;
      };
      browser.runtime.onMessage.addListener(listener);
      return () => {
        browser.runtime.onMessage.removeListener(listener);
      };
    },
  };
}
