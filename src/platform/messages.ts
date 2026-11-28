import type { SessionKind, SiteId } from "@/core";
import { createMessenger } from "./messaging";

/**
 * Every message the background worker handles. Content scripts and extension
 * pages send these; only the worker changes state in response.
 */

/** Why an action was refused. */
export type Refusal =
  /** A PIN is set and none was given. */
  | { readonly ok: false; readonly reason: "pin-required" }
  | {
      readonly ok: false;
      readonly reason: "wrong-pin";
      /** Tries left before the lockout starts. */
      readonly attemptsLeft: number;
    }
  | {
      readonly ok: false;
      readonly reason: "locked-out";
      readonly retryInMs: number;
    }
  /** The action needs a PIN, and none is set. */
  | { readonly ok: false; readonly reason: "no-pin" }
  /** The action isn't allowed while Guest mode is on. */
  | { readonly ok: false; readonly reason: "guest-on" };

export type ActionResult = { readonly ok: true } | Refusal;

export interface CurtainMessages {
  /** Turns Guest mode on. The chat open in the sender's tab joins the session. */
  "guest/turn-on": {
    request: {
      readonly openChat?: { readonly site: SiteId; readonly chatId: string };
    };
    response: ActionResult;
  };
  /** Turns Guest mode off. Needs the PIN if one is set. */
  "guest/turn-off": {
    request: { readonly pin?: string };
    response: ActionResult;
  };
  /** Adds items to the session, for example a project created in it. */
  "session/add": {
    request: {
      readonly site: SiteId;
      readonly kind: SessionKind;
      readonly ids: readonly string[];
    };
    response: ActionResult;
  };
  /** A tab moved from the new-chat screen to a chat page. */
  "session/chat-created": {
    request: {
      readonly site: SiteId;
      readonly chatId: string;
      /** Creation time read from the chat's ID, if the site's IDs carry one. */
      readonly serverTime: number | null;
    };
    response: ActionResult;
  };
  /** Shows one past chat for the rest of the session. Needs the PIN. */
  "session/reveal": {
    request: {
      readonly site: SiteId;
      readonly chatId: string;
      readonly pin: string;
    };
    response: ActionResult;
  };
  /** Marks or unmarks a chat to show in Guest mode. Refused while it's on. */
  "marks/set": {
    request: {
      readonly site: SiteId;
      readonly chatId: string;
      readonly marked: boolean;
    };
    response: ActionResult;
  };
  /** Clears the marks for one site, or all of them. Refused while it's on. */
  "marks/clear": {
    request: { readonly site?: SiteId };
    response: ActionResult;
  };
  /** Sets or changes the PIN. Changing needs the current one. */
  "pin/set": {
    request: { readonly pin: string; readonly currentPin?: string };
    response: ActionResult;
  };
  /**
   * What a page found about a site's health: missing anchors and features
   * that stopped. Recorded on this device only.
   */
  "health/report": {
    request: {
      readonly site: SiteId;
      readonly missing: readonly string[];
      readonly failures: readonly string[];
    };
    response: ActionResult;
  };
  /** Removes the PIN. Needs the current one. */
  "pin/remove": {
    request: { readonly currentPin?: string };
    response: ActionResult;
  };
}

export const messages = createMessenger<CurtainMessages>();
