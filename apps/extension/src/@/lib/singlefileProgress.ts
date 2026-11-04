import { getStorageItem, setStorageItem } from "./utils.ts";

export type SingleFileProgressPhase = "capturing" | "uploading";

export interface SingleFileProgress {
  active: boolean;
  phase: SingleFileProgressPhase;
  loaded?: number;
  max?: number;
  updatedAt: number;
}

export const SINGLEFILE_PROGRESS_KEY = "lw_singlefile_progress";

/**
 * The SingleFile save runs in the background worker, so its progress is kept
 * in storage.local: the popup reads it on open (showing the overlay again if
 * a save is still running) and subscribes to storage.onChanged for live
 * updates. storage.local survives both popup and service-worker restarts.
 */
export async function getSingleFileProgress(): Promise<SingleFileProgress | null> {
  const raw = await getStorageItem(SINGLEFILE_PROGRESS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SingleFileProgress | null;
    return parsed && parsed.active ? parsed : null;
  } catch {
    return null;
  }
}

export async function setSingleFileProgress(
  progress: SingleFileProgress | null
): Promise<void> {
  await setStorageItem(SINGLEFILE_PROGRESS_KEY, JSON.stringify(progress));
}
