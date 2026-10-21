/** Strict client-side preflight and raster re-encoding for business logos.
 * This is defense in depth, not a replacement for server-side validation if
 * logos are later moved to a server upload endpoint.
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_LOGO_DIMENSION = 4096;
export const OUTPUT_LOGO_DIMENSION = 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
      bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
      bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/** Validate size, claimed MIME, and file signature before decoding. */
export async function validateLogoFile(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image. SVG and other file types are not allowed.");
  }
  if (file.size <= 0 || file.size > MAX_LOGO_BYTES) {
    throw new Error("Your logo must be smaller than 2 MB.");
  }
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = sniffImageType(bytes);
  if (!detected || detected !== file.type) {
    throw new Error("This file does not match a supported image format.");
  }
  return detected;
}

/** Decode then re-encode pixels to PNG, dropping original metadata and payloads. */
export async function sanitizeLogoFile(file: File): Promise<string> {
  await validateLogoFile(file);
  if (typeof createImageBitmap !== "function") {
    throw new Error("Secure image processing is unavailable in this browser. Try an updated browser.");
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width < 1 || bitmap.height < 1 ||
        bitmap.width > MAX_LOGO_DIMENSION || bitmap.height > MAX_LOGO_DIMENSION) {
      throw new Error("Image dimensions are too large. Use an image no larger than 4096 × 4096 pixels.");
    }

    const scale = Math.min(1, OUTPUT_LOGO_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Could not process this image. Please try another file.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const output = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not process this image.")), "image/png");
    });
    if (output.size > MAX_LOGO_BYTES) throw new Error("The processed logo is too large. Please use a simpler image.");
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the processed logo."));
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the processed logo."));
      reader.readAsDataURL(output);
    });
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("This image could not be safely processed. Please choose another image.");
  } finally {
    bitmap?.close();
  }
}
