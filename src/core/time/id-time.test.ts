import { describe, expect, it } from "vitest";
import {
  EARLIEST_ID_TIME,
  MAX_FUTURE_MS,
  decodeChatGptIdTime,
  decodeUuidV7Time,
  plausibleIdTime,
} from "./id-time";

const CREATED = Date.UTC(2026, 10, 28, 9, 30, 15);
const NOW = CREATED + 60_000;

/** A ChatGPT-style chat ID created at `ms` (second precision). */
function chatGptChatId(ms: number): string {
  const hex = Math.floor(ms / 1000)
    .toString(16)
    .padStart(8, "0");
  return `${hex}-1a2b-8c3d-9e4f-0123456789ab`;
}

/** A UUID v7 created at `ms`. */
function uuidV7(ms: number): string {
  const hex = ms.toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7abc-8def-0123456789ab`;
}

describe("decodeChatGptIdTime", () => {
  it("reads the creation time from a chat ID", () => {
    expect(decodeChatGptIdTime(chatGptChatId(CREATED))).toBe(CREATED);
  });

  it("reads the creation time from a project ID", () => {
    const hex = (CREATED / 1000).toString(16);
    expect(decodeChatGptIdTime(`g-p-${hex}${"0".repeat(24)}`)).toBe(CREATED);
  });

  it("accepts upper-case hex", () => {
    expect(decodeChatGptIdTime(chatGptChatId(CREATED).toUpperCase())).toBe(
      CREATED,
    );
  });

  it("rejects anything that isn't a ChatGPT ID", () => {
    for (const id of [
      "",
      "not-an-id",
      "6750a1b2",
      "zzzzzzzz-1a2b-8c3d-9e4f-0123456789ab",
      "6750a1b2-1a2b-8c3d-9e4f-0123456789ab-extra",
      "g-p-6750a1b2",
      "g-p-6750a1b2000000000000000000000000x",
    ]) {
      expect(decodeChatGptIdTime(id)).toBeNull();
    }
  });
});

describe("decodeUuidV7Time", () => {
  it("reads the millisecond creation time", () => {
    expect(decodeUuidV7Time(uuidV7(CREATED + 123))).toBe(CREATED + 123);
  });

  it("ignores other UUID versions", () => {
    expect(decodeUuidV7Time("6f1c2a3b-4d5e-4f60-8a7b-0123456789ab")).toBeNull();
  });

  it("rejects anything that isn't a UUID", () => {
    expect(decodeUuidV7Time("chat-123")).toBeNull();
    expect(decodeUuidV7Time("")).toBeNull();
  });
});

describe("plausibleIdTime", () => {
  it("keeps a believable time", () => {
    expect(
      plausibleIdTime(decodeChatGptIdTime, chatGptChatId(CREATED), NOW),
    ).toBe(CREATED);
  });

  it("rejects IDs the decoder can't read", () => {
    expect(plausibleIdTime(decodeChatGptIdTime, "nope", NOW)).toBeNull();
  });

  it("rejects times before any supported site existed", () => {
    const early = chatGptChatId(EARLIEST_ID_TIME - 1000);
    expect(plausibleIdTime(decodeChatGptIdTime, early, NOW)).toBeNull();
    const zero = "00000000-1a2b-8c3d-9e4f-0123456789ab";
    expect(plausibleIdTime(decodeChatGptIdTime, zero, NOW)).toBeNull();
  });

  it("rejects times too far in the future", () => {
    const future = uuidV7(NOW + MAX_FUTURE_MS + 1);
    expect(plausibleIdTime(decodeUuidV7Time, future, NOW)).toBeNull();
    const edge = uuidV7(NOW + MAX_FUTURE_MS);
    expect(plausibleIdTime(decodeUuidV7Time, edge, NOW)).toBe(
      NOW + MAX_FUTURE_MS,
    );
  });

  it("rejects a random ID that only looks like it has a time", () => {
    // Random hex usually decodes to a date decades away.
    const random = "f3a91c07-1a2b-4c3d-9e4f-0123456789ab";
    expect(plausibleIdTime(decodeChatGptIdTime, random, NOW)).toBeNull();
  });
});
