import browser from "webextension-polyfill";

export const SINGLEFILE_MAX_BYTES = 10 * 1024 * 1024;

export const isCapturableUrl = (url: string | undefined): boolean =>
  !!url && /^https?:\/\//.test(url);

async function executeScript(tabId: number, func: any, args: any[] = []) {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    func,
    args,
  });
  return results[0]?.result;
}

// Injecting the bundle as a file (rather than importing it via a
// moz-extension:/chrome-extension: URL) runs it in the content-script world,
// which the page's Content Security Policy cannot block. It must reach every
// frame: the frame-tree processor in single-file-core waits for a postMessage
// handshake from each subframe, and a subframe without the bundle never
// answers, hanging the capture forever.
async function injectSingleFileCore(tabId: number) {
  await browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["singlefile-core.js"],
  });
}

export interface SingleFileProgress {
  loaded: number;
  max?: number;
}

interface SingleFileCoreGlobal {
  getPageData: (options: Record<string, unknown>) => Promise<{
    content: string;
  }>;
}

interface SingleFileProgressEvent {
  type: string;
  detail: { max?: number };
  RESOURCES_INITIALIZED: string;
  RESOURCE_LOADED: string;
}

export const SINGLEFILE_PROGRESS_MESSAGE = "singlefile-progress";

async function captureInTab(tabId: number): Promise<string> {
  await injectSingleFileCore(tabId);

  const html = await executeScript(
    tabId,
    async (messageName: string) => {
      const log = (...args: unknown[]) =>
        console.log("[singlefile-capture]", ...args);
      const singleFile = (globalThis as { singleFileCore?: SingleFileCoreGlobal })
        .singleFileCore;
      if (!singleFile) {
        throw new Error("single-file-core did not load in the page.");
      }
      log("singleFileCore available, starting capture");
      let loaded = 0;
      let max: number | undefined;
      const send = () => {
        const b = globalThis.browser ?? globalThis.chrome;
        try {
          const maybePromise = b.runtime.sendMessage({
            type: messageName,
            loaded,
            max,
          });
          if (maybePromise?.catch) maybePromise.catch(() => {});
        } catch {
          // Progress is best-effort; never fail the capture on it.
        }
      };
      log("calling getPageData");
      // removeFrames: the frame-tree processor handshakes with subframes
      // over postMessage/runtime messaging, which does not work reliably from
      // a scripting.executeScript context and hangs the capture. Karakeep's
      // extension does the same; iframes are removed from the snapshot.
      const pageData = await singleFile.getPageData({
        compressHTML: true,
        includeInfobar: false,
        removeFrames: true,
        onprogress: async (event: SingleFileProgressEvent) => {
          if (
            event.type === event.RESOURCES_INITIALIZED &&
            typeof event.detail.max === "number"
          ) {
            max = event.detail.max;
            log("resources initialized", max);
            send();
          } else if (event.type === event.RESOURCE_LOADED) {
            loaded++;
            if (loaded % 10 === 0 || loaded === max) {
              log("resources loaded", loaded, "/", max);
            }
            send();
          }
        },
      });
      log("getPageData resolved, content length", pageData.content?.length);
      return pageData.content;
    },
    [SINGLEFILE_PROGRESS_MESSAGE]
  );

  if (typeof html !== "string" || !html) {
    throw new Error("SingleFile capture returned an empty page.");
  }
  return html;
}

export async function captureSingleFile(
  tabId?: number
): Promise<{ html: string; blob: Blob }> {
  const tabs = await browser.tabs.query({
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

  const html = await Promise.race([
    captureInTab(targetTabId),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Capture timed out after 60 seconds. The page never finished loading resources."
            )
          ),
        60_000
      )
    ),
  ]);
  const blob = new Blob([html], { type: "text/html" });

  if (blob.size > SINGLEFILE_MAX_BYTES) {
    throw new Error(
      `Captured page is ${(blob.size / 1024 / 1024).toFixed(1)} MB, ` +
        "which exceeds the 10 MB upload limit."
    );
  }

  return { html, blob };
}
