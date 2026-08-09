import { beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_VERSION,
  createBackup,
  getLastBackupAt,
  isValidBackup,
  parseBackupFile,
  restoreBackup,
} from "@/lib/backup";

const CUSTOMERS = "debtbook.v2.customers";
const PROFILE = "debtbook.v2.profile";

beforeEach(() => {
  window.localStorage.clear();
});

describe("createBackup", () => {
  it("snapshots the stored customers and profile", () => {
    window.localStorage.setItem(CUSTOMERS, JSON.stringify([{ id: "c1", name: "Ada" }]));
    window.localStorage.setItem(PROFILE, JSON.stringify({ name: "Ada Stores" }));

    const b = createBackup();
    expect(b.app).toBe("track-debt");
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.data.customers).toEqual([{ id: "c1", name: "Ada" }]);
    expect(b.data.profile).toEqual({ name: "Ada Stores" });
  });

  it("records the last backup timestamp", () => {
    const b = createBackup();
    expect(getLastBackupAt()).toBe(b.exportedAt);
  });

  it("uses safe defaults when nothing is stored yet", () => {
    const b = createBackup();
    expect(b.data.customers).toEqual([]);
    expect(b.data.profile).toEqual({});
  });
});

describe("validation", () => {
  it("accepts a backup it created", () => {
    expect(isValidBackup(createBackup())).toBe(true);
  });

  it("rejects a foreign or malformed file", () => {
    expect(isValidBackup(null)).toBe(false);
    expect(isValidBackup({ app: "something-else", version: 1 })).toBe(false);
    expect(isValidBackup({ app: "track-debt", version: 0, exportedAt: "x", data: {} })).toBe(false);
    expect(
      isValidBackup({ app: "track-debt", version: 1, exportedAt: "not-a-date", data: {} }),
    ).toBe(false);
    expect(
      isValidBackup({
        app: "track-debt",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: { customers: "nope", profile: {} },
      }),
    ).toBe(false);
  });

  it("rejects non-JSON text", () => {
    expect(parseBackupFile("this is not json")).toBeNull();
    expect(parseBackupFile(JSON.stringify({ hello: "world" }))).toBeNull();
  });

  it("parses a valid backup file", () => {
    const raw = JSON.stringify(createBackup());
    expect(parseBackupFile(raw)?.app).toBe("track-debt");
  });
});

describe("restoreBackup", () => {
  it("replaces local data with the backup contents", () => {
    window.localStorage.setItem(CUSTOMERS, JSON.stringify([{ id: "old" }]));
    const backup = createBackup();
    backup.data.customers = [{ id: "restored" }];
    backup.data.profile = { name: "Restored Stores" };

    restoreBackup(backup);

    expect(JSON.parse(window.localStorage.getItem(CUSTOMERS)!)).toEqual([{ id: "restored" }]);
    expect(JSON.parse(window.localStorage.getItem(PROFILE)!)).toEqual({
      name: "Restored Stores",
    });
  });

  it("rolls back and rethrows if a write fails part-way", () => {
    window.localStorage.setItem(CUSTOMERS, JSON.stringify([{ id: "old" }]));
    const backup = createBackup();
    backup.data.customers = [{ id: "restored" }];

    const original = window.localStorage.setItem.bind(window.localStorage);
    let calls = 0;
    const spy = (key: string, value: string) => {
      calls += 1;
      if (calls === 2) throw new DOMException("quota", "QuotaExceededError");
      original(key, value);
    };
    Object.defineProperty(window.localStorage, "setItem", { value: spy, configurable: true });

    expect(() => restoreBackup(backup)).toThrow();

    Object.defineProperty(window.localStorage, "setItem", {
      value: original,
      configurable: true,
    });
    expect(JSON.parse(window.localStorage.getItem(CUSTOMERS)!)).toEqual([{ id: "old" }]);
  });
});
