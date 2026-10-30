import { getBrowser } from "./utils.ts";

export const SINGLEFILE_MAX_BYTES = 10 * 1024 * 1024;

export const isCapturableUrl = (url: string | undefined): boolean =>
  !!url && /^https?:\/\//.test(url);

async function executeScript(tabId: number, func: any, args: any[] = []) {
  if (
    typeof chrome !== "undefined" &&
    typeof chrome.scripting !== "undefined"
  ) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
    });
    return results[0]?.result;
  }

  const results = await getBrowser().tabs.executeScript(tabId, {
    code: `(${func})(${args.map((arg) => JSON.stringify(arg)).join(",")})`,
  });
  return results?.[0];
}

async function captureInTab(tabId: number): Promise<string> {
  const html = await executeScript(tabId, async () => {
    const singlefile = await import(
      // @ts-ignore dynamic runtime URL
      chrome.runtime.getURL("singlefile-core.js")
    );
    const pageData = await singlefile.getPageData({
      compressHTML: true,
      includeInfobar: false,
    });
    return pageData.content;
  });

  if (typeof html !== "string" || !html) {
    throw new Error("SingleFile capture returned an empty page.");
  }
  return html;
}

export async function captureSingleFile(
  tabId?: number
): Promise<{ html: string; blob: Blob }> {
  const tabs = await getBrowser().tabs.query({
    active: true,
    currentWindow: true,
  });
  const tab = tabs[0];
  const targetTabId = tabId ?? tab?.id;

  if (!targetTabId) {
    throw new Error("Unable to get the current tab.");
  }
  if (!isCapturableUrl(tab?.url)) {
    throw new Error("This page cannot be saved as a SingleFile snapshot.");
  }

  const html = await captureInTab(targetTabId);
  const blob = new Blob([html], { type: "text/html" });

  if (blob.size > SINGLEFILE_MAX_BYTES) {
    throw new Error(
      `Captured page is ${(blob.size / 1024 / 1024).toFixed(1)} MB, ` +
        "which exceeds the 10 MB upload limit."
    );
  }

  return { html, blob };
}
