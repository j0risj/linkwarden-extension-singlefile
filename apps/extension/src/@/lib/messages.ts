import { bookmarkFormValues } from "./validators/bookmarkForm.ts";

/**
 * Sent from the popup to the background worker when the user saves with
 * "Save SingleFile" enabled. The background performs the capture, link
 * creation, and archive upload, so the save survives the popup being closed
 * (e.g. the user switching to another tab while it runs).
 */
export const SAVE_SINGLEFILE_MESSAGE = "lw:save-singlefile";

export interface SaveSingleFileMessage {
  type: typeof SAVE_SINGLEFILE_MESSAGE;
  baseUrl: string;
  apiKey: string;
  uploadImage: boolean;
  maxUploadBytes: number;
  data: bookmarkFormValues;
  tabId?: number;
}
