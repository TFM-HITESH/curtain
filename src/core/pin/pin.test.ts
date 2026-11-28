import { describe, expect, it } from "vitest";
import { PIN_ITERATIONS, hashPin, isValidPin, verifyPin } from "./pin";

// Full-strength hashing is slow by design, so most tests use fewer rounds.
const FAST = { iterations: 1000 };

describe("isValidPin", () => {
  it("accepts exactly four digits", () => {
    expect(isValidPin("0000")).toBe(true);
    expect(isValidPin("4821")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const pin of [
      "",
      "123",
      "12345",
      "12a4",
      " 1234",
      "１２３４",
      "12.4",
    ]) {
      expect(isValidPin(pin)).toBe(false);
    }
  });
});

describe("hashPin", () => {
  it("never stores the PIN itself", async () => {
    const record = await hashPin("4821", FAST);
    expect(JSON.stringify(record)).not.toContain("4821");
  });

  it("records the algorithm and rounds", async () => {
    const record = await hashPin("4821", FAST);
    expect(record.algo).toBe("PBKDF2-SHA256");
    expect(record.iterations).toBe(1000);
  });

  it("uses 600,000 rounds and a 16-byte salt by default", async () => {
    const record = await hashPin("4821");
    expect(record.iterations).toBe(PIN_ITERATIONS);
    expect(PIN_ITERATIONS).toBe(600_000);
    expect(atob(record.salt)).toHaveLength(16);
    expect(atob(record.hash)).toHaveLength(32);
  });

  it("uses a fresh salt each time", async () => {
    const a = await hashPin("4821", FAST);
    const b = await hashPin("4821", FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("matches known PBKDF2-SHA256 results", async () => {
    // Computed independently with Python's hashlib.pbkdf2_hmac.
    const salt = new TextEncoder().encode("curtain-test-salt");
    expect((await hashPin("1234", { iterations: 1, salt })).hash).toBe(
      "P6sDHkLXBe5UQNJ3vQIavreCdrAsVLURV3hbgZcud2E=",
    );
    expect((await hashPin("1234", { iterations: 1000, salt })).hash).toBe(
      "qUYWMca3Ibw3qzktbsjyLi2LGuvszjUINvgPpMnusPE=",
    );
  });

  it("refuses an invalid PIN", async () => {
    await expect(hashPin("12345", FAST)).rejects.toThrow(RangeError);
  });
});

describe("verifyPin", () => {
  it("accepts the right PIN", async () => {
    const record = await hashPin("4821", FAST);
    expect(await verifyPin("4821", record)).toBe(true);
  });

  it("rejects a wrong PIN", async () => {
    const record = await hashPin("4821", FAST);
    expect(await verifyPin("4820", record)).toBe(false);
    expect(await verifyPin("1284", record)).toBe(false);
  });

  it("rejects input that isn't a PIN without hashing it", async () => {
    const record = await hashPin("4821", FAST);
    expect(await verifyPin("48211", record)).toBe(false);
    expect(await verifyPin("", record)).toBe(false);
  });

  it("uses the rounds stored in the record", async () => {
    const record = await hashPin("4821", { iterations: 2000 });
    expect(await verifyPin("4821", record)).toBe(true);
    expect(await verifyPin("4821", { ...record, iterations: 1000 })).toBe(
      false,
    );
  });

  it("never matches a damaged record", async () => {
    const record = await hashPin("4821", FAST);
    expect(await verifyPin("4821", { ...record, hash: "!!not base64!!" })).toBe(
      false,
    );
    expect(await verifyPin("4821", { ...record, salt: "!!not base64!!" })).toBe(
      false,
    );
    expect(await verifyPin("4821", { ...record, hash: btoa("short") })).toBe(
      false,
    );
  });
});
