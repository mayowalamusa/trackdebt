import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL } from "./app-config";
import { defaultNotificationSettings } from "./notifications";

describe("product configuration", () => {
  it("uses the official support email", () => {
    expect(SUPPORT_EMAIL).toBe("mytrackdebt@gmail.com");
  });

  it("enables notification sound by default", () => {
    expect(defaultNotificationSettings.soundEnabled).toBe(true);
  });
});
