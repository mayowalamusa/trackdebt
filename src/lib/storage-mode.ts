const CLOUD_USER_KEY = "trackdebt.v4.cloudStorageUser";

export function isCloudStorageActive(): boolean {
  try {
    return Boolean(window.localStorage.getItem(CLOUD_USER_KEY));
  } catch {
    return false;
  }
}

export function activateCloudStorage(userId: string): void {
  try {
    window.localStorage.setItem(CLOUD_USER_KEY, userId);
  } catch {
    /* Storage is best-effort; the authenticated session remains authoritative. */
  }
}

export function deactivateCloudStorage(): void {
  try {
    window.localStorage.removeItem(CLOUD_USER_KEY);
  } catch {
    /* non-fatal */
  }
}
