/**
 * Shared file-download seam.
 *
 * Every place that needs to hand the user a file (PDF receipts, JSON
 * backups) goes through this one function instead of touching the DOM
 * directly. That keeps the "how do we get a file onto the user's device"
 * question in exactly one place, so a native Capacitor Filesystem/Share
 * implementation can replace the browser-download internals later without
 * any caller having to change.
 */

export type DownloadResult = { ok: true } | { ok: false; error: string };

export async function downloadFile(
  filename: string,
  content: Blob | string,
  mimeType = "application/octet-stream",
): Promise<DownloadResult> {
  try {
    if (typeof document === "undefined") {
      return { ok: false, error: "Downloads aren't available in this environment." };
    }
    const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not start the download. Please try again." };
  }
}
