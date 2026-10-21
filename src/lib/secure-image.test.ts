import { describe, expect, it } from "vitest";
import { MAX_LOGO_BYTES, validateLogoFile } from "./secure-image";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("secure business logo upload validation", () => {
  it("accepts a PNG whose claimed MIME matches its signature", async () => {
    const file = new File([pngHeader], "logo.png", { type: "image/png" });
    await expect(validateLogoFile(file)).resolves.toBe("image/png");
  });

  it("rejects SVG and other unsupported active-content formats", async () => {
    const file = new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "logo.svg", { type: "image/svg+xml" });
    await expect(validateLogoFile(file)).rejects.toThrow(/JPG, PNG, or WebP/);
  });

  it("rejects a spoofed MIME type when the bytes are not an image", async () => {
    const file = new File(["not an image"], "logo.png", { type: "image/png" });
    await expect(validateLogoFile(file)).rejects.toThrow(/does not match/);
  });

  it("rejects a valid signature paired with a mismatched MIME type", async () => {
    const file = new File([pngHeader], "logo.jpg", { type: "image/jpeg" });
    await expect(validateLogoFile(file)).rejects.toThrow(/does not match/);
  });

  it("rejects files above the 2 MB limit", async () => {
    const file = new File([new Uint8Array(MAX_LOGO_BYTES + 1)], "large.png", { type: "image/png" });
    await expect(validateLogoFile(file)).rejects.toThrow(/smaller than 2 MB/);
  });
});
