import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrate, type Migration } from "./migrations";
import { SCHEMA_VERSION, defaultState } from "./schema";

const NOW = 1_800_000_000_000;

describe("MIGRATIONS", () => {
  it("has exactly one migration per version, in order, up to the current one", () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(
      Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1),
    );
  });
});

describe("migrate", () => {
  it("sets up a fresh install", () => {
    expect(migrate({}, NOW)).toEqual({
      status: "migrated",
      from: 0,
      state: defaultState(),
    });
  });

  it("leaves current state alone apart from normalizing it", () => {
    const stored = { ...defaultState(), marks: { chatgpt: ["a", "a"] } };
    expect(migrate(stored, NOW)).toEqual({
      status: "current",
      state: {
        ...defaultState(),
        marks: { chatgpt: ["a"], claude: [], gemini: [] },
      },
    });
  });

  it("keeps a running session and marks through the upgrade", () => {
    const stored = {
      guest: {
        startedAt: 1_700_000_000_000,
        session: { claude: { chats: ["c"] } },
      },
      marks: { gemini: ["g"] },
    };
    const result = migrate(stored, NOW);
    expect(result.status).toBe("migrated");
    if (result.status !== "migrated") return;
    expect(result.state.guest?.startedAt).toBe(1_700_000_000_000);
    expect(result.state.guest?.session.claude.chats).toEqual(["c"]);
    expect(result.state.marks.gemini).toEqual(["g"]);
  });

  it("treats an unreadable version as a pre-schema install", () => {
    for (const schema of ["1", -1, 1.5, null]) {
      const result = migrate({ schema }, NOW);
      expect(result.status).toBe("migrated");
      if (result.status === "migrated") expect(result.from).toBe(0);
    }
  });

  it("doesn't touch state written by a newer version", () => {
    expect(
      migrate({ schema: SCHEMA_VERSION + 1, guest: "future" }, NOW),
    ).toEqual({
      status: "newer",
      version: SCHEMA_VERSION + 1,
    });
  });

  describe("with several migrations", () => {
    const steps: Migration[] = [
      { version: 1, migrate: (s) => s },
      { version: 2, migrate: (s) => ({ ...s, prefs: { onboarded: true } }) },
      {
        version: 3,
        migrate: (s) => ({ ...s, lockout: { failures: 1, until: 0 } }),
      },
    ];

    it("runs only the steps after the stored version, in order", () => {
      const result = migrate({ schema: 2 }, NOW, steps, 3);
      expect(result).toMatchObject({ status: "migrated", from: 2 });
      if (result.status !== "migrated") return;
      expect(result.state.prefs.onboarded).toBe(false);
      expect(result.state.lockout.failures).toBe(1);
      expect(result.state.schema).toBe(3);
    });

    it("runs every step for a fresh install", () => {
      const result = migrate({}, NOW, steps, 3);
      if (result.status !== "migrated") throw new Error("expected a migration");
      expect(result.state.prefs.onboarded).toBe(true);
      expect(result.state.lockout.failures).toBe(1);
    });
  });
});
