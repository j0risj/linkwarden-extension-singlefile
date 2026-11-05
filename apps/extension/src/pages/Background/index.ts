import {
  getBrowser,
  getCurrentTabInfo,
  hasAPI,
  isSafari,
  updateBadge,
} from "../../@/lib/utils.ts";
// import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;
import { getConfig, isConfigured } from "../../@/lib/config.ts";
import {
  // deleteLinkFetch,
  // updateLinkFetch,
  postLink,
  postLinkFetch,
} from "../../@/lib/actions/links.ts";
import {
  captureSingleFile,
  SINGLEFILE_PROGRESS_MESSAGE,
} from "../../@/lib/singlefile.ts";
import {
  SAVE_SINGLEFILE_MESSAGE,
  SaveSingleFileMessage,
} from "../../@/lib/messages.ts";
import {
  getSingleFileProgress,
  setSingleFileProgress,
  setSingleFileResult,
  SingleFileResultStatus,
} from "../../@/lib/singlefileProgress.ts";
import {
  bookmarkMetadata,
  // deleteBookmarkMetadata,
  // getBookmarkMetadataByBookmarkId,
  // getBookmarkMetadataByUrl,
  getBookmarksMetadata,
  saveBookmarkMetadata,
} from "../../@/lib/cache.ts";
import OnClickData = chrome.contextMenus.OnClickData;

// @types/chrome models these as TS enums, but the runtime APIs take and hand
// back plain strings, so use the string form of each enum.
type ContextType = `${chrome.contextMenus.ContextType}`;
type OnInputEnteredDisposition = `${chrome.omnibox.OnInputEnteredDisposition}`;
// import {
//   getCsrfTokenFetch,
//   getSessionFetch,
//   performLoginOrLogoutFetch,
// } from '../../@/lib/auth/auth.ts';

const browser = getBrowser();

// This is the main functions that will be called when a bookmark is created, update or deleted
// Won't work with axios xhr or something not supported by the browser

// browser.bookmarks.onCreated.addListener(
//   async (_id: string, bookmark: BookmarkTreeNode) => {
//     try {
//       const { syncBookmarks, baseUrl, username, password } = await getConfig();
//       if (!syncBookmarks || !bookmark.url) {
//         return;
//       }
//       const session = await getSessionFetch(baseUrl);

//       // Check if the bookmark already exists in the server by checking the url so, it doesn't create duplicates
//       // I know, could use the method search from the api, but I want to avoid as much api specific calls as possible
//       // in case isn't supported, so I prefer to do it this way, if performance is an issue I will think of change to that.

//       const existingLink = await getBookmarkMetadataByUrl(bookmark.url);
//       if (existingLink) {
//         return;
//       }

//       if (!session) {
//         const csrfToken = await getCsrfTokenFetch(baseUrl);

//         await performLoginOrLogoutFetch(
//           `${baseUrl}/api/v1/auth/callback/credentials`,
//           {
//             csrfToken: csrfToken,
//             callbackUrl: `${baseUrl}/api/v1/auth/callback`,
//             json: true,
//             redirect: false,
//             username: username,
//             password: password,
//           }
//         );
//       }

//       const newLink = await postLinkFetch(baseUrl, {
//         url: bookmark.url,
//         collection: {
//           name: 'Unorganized',
//         },
//         tags: [],
//         name: bookmark.title,
//         description: bookmark.title,
//       });

//       const newLinkJson = await newLink.json();
//       const newLinkUrl: bookmarkMetadata = newLinkJson.response;
//       newLinkUrl.bookmarkId = bookmark.id;

//       await saveBookmarkMetadata(newLinkUrl);
//     } catch (error) {
//       console.error(error);
//     }
//   }
// );

// browser.bookmarks.onChanged.addListener(
//   async (id: string, changeInfo: chrome.bookmarks.BookmarkChangeInfo) => {
//     try {
//       const { syncBookmarks, baseUrl, username, password, usingSSO } =
//         await getConfig();
//       if (!syncBookmarks || !changeInfo.url) {
//         return;
//       }

//       const link = await getBookmarkMetadataByBookmarkId(id);

//       if (!link) {
//         return;
//       }

//       const session = await getSessionFetch(baseUrl);

//       if (!session && !usingSSO) {
//         const csrfToken = await getCsrfTokenFetch(baseUrl);

//         await performLoginOrLogoutFetch(
//           `${baseUrl}/api/v1/auth/callback/credentials`,
//           {
//             csrfToken: csrfToken,
//             callbackUrl: `${baseUrl}/api/v1/auth/callback`,
//             json: true,
//             redirect: false,
//             username: username,
//             password: password,
//           }
//         );
//       } else if (!session && usingSSO) {
//         return;
//       }

//       const updatedLink = await updateLinkFetch(baseUrl, link.id, {
//         url: changeInfo.url,
//         collection: {
//           name: 'Unorganized',
//         },
//         tags: [],
//         name: changeInfo.title,
//         description: changeInfo.title,
//       });

//       const updatedLinkJson = await updatedLink.json();
//       const newLinkUrl: bookmarkMetadata = updatedLinkJson.response;
//       newLinkUrl.bookmarkId = id;

//       await saveBookmarkMetadata(newLinkUrl);
//     } catch (error) {
//       console.error(error);
//     }
//   }
// );

// browser.bookmarks.onRemoved.addListener(
//   async (id: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo) => {
//     try {
//       const { syncBookmarks, baseUrl } =
//         await getConfig();
//       if (!syncBookmarks || !removeInfo.node.url) {
//         return;
//       }
//       const link = await getBookmarkMetadataByBookmarkId(id);

//       if (!link) {
//         return;
//       }

//       const session = await getSessionFetch(baseUrl);

//       if (!session) {
//         const csrfToken = await getCsrfTokenFetch(baseUrl);

//         await performLoginOrLogoutFetch(
//           `${baseUrl}/api/v1/auth/callback/credentials`,
//           {
//             csrfToken: csrfToken,
//             callbackUrl: `${baseUrl}/api/v1/auth/callback`,
//             json: true,
//             redirect: false,
//             username: username,
//             password: password,
//           }
//         );
//       } else if (!session && usingSSO) {
//         return;
//       }

//       await Promise.all([
//         deleteBookmarkMetadata(link.bookmarkId),
//         deleteLinkFetch(baseUrl, link.id),
//       ]);
//     } catch (error) {
//       console.error(error);
//     }
//   }
// );

// This is for the context menus!
// Example taken from: https://github.com/GoogleChrome/chrome-extensions-samples/blob/main/api-samples/contextMenus/basic/sample.js
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await genericOnClick(info, tab);
});

// A generic onclick callback function.
async function genericOnClick(
  info: OnClickData,
  tab: chrome.tabs.Tab | undefined
) {
  const { syncBookmarks, baseUrl } = await getConfig();
  const configured = await isConfigured();
  if (!tab?.url || !tab?.title || !configured) {
    return;
  }
  switch (info.menuItemId) {
    case "save-all-tabs": {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const config = await getConfig();

      for (const tab of tabs) {
        if (
          tab.url &&
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("about:")
        ) {
          try {
            if (new URL(tab.url))
              await postLinkFetch(
                config.baseUrl,
                {
                  url: tab.url,
                  name: tab.title || "",
                  description: tab.title || "",
                  collection: {
                    name: config.defaultCollection,
                  },
                  tags: [],
                },
                config.apiKey
              );
          } catch (error) {
            console.error(`Failed to save tab: ${tab.url}`, error);
          }
        }
      }
      break;
    }
    default:
      // Handle cases where sync is enabled or not
      if (syncBookmarks && hasAPI("bookmarks.create")) {
        browser.bookmarks.create({
          parentId: "1",
          title: tab.title,
          url: tab.url,
        });
      } else {
        const config = await getConfig();

        try {
          const newLink = await postLinkFetch(
            baseUrl,
            {
              url: tab.url,
              collection: {
                name: "Unorganized",
              },
              tags: [],
              name: tab.title,
              description: tab.title,
            },
            config.apiKey
          );

          const newLinkJson = await newLink.json();
          const newLinkUrl: bookmarkMetadata = newLinkJson.response;
          newLinkUrl.bookmarkId = tab.id?.toString();

          await saveBookmarkMetadata(newLinkUrl);
        } catch (error) {
          console.error(error);
        }
      }
  }
}
browser.runtime.onInstalled.addListener(async function () {
  // Create one test item for each context type.
  const contexts: ContextType[] = isSafari()
    ? ["page", "selection", "link"]
    : ["page", "selection", "link", "editable", "image", "video", "audio"];
  for (const context of contexts) {
    const title: string = "Add link to Linkwarden";
    browser.contextMenus.create({
      title: title,
      contexts: [context],
      id: context,
    });
  }
  browser.contextMenus.create({
    id: "save-all-tabs",
    title: "Save all tabs to Linkwarden",
    contexts: ["page"],
  });
});

// Record the outcome in storage; an open (or reopened) popup turns it into
// a toast. No desktop notifications.
async function reportOutcome(
  status: SingleFileResultStatus,
  message: string,
  tabId?: number
) {
  await setSingleFileResult({ status, message, tabId, updatedAt: Date.now() });
}

// A pending runtime.onMessage promise does NOT keep an MV3 service worker
// alive; the worker can be killed mid-save, which would abort the save. A
// repeating alarm wakes the worker every 30s and resets its idle timer for
// the duration of the save.
const SAVE_KEEPALIVE_ALARM = "lw-singlefile-save";

// Guarded so a missing alarms API (e.g. the extension was not reloaded
// after the permission was added) cannot take down the whole worker script.
if (browser.alarms?.onAlarm) {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SAVE_KEEPALIVE_ALARM) return;
    // The alarm firing is enough to reset the idle timer; nothing else to do.
  });
}

async function startSaveKeepalive() {
  if (!browser.alarms?.create) return;
  try {
    await browser.alarms.create(SAVE_KEEPALIVE_ALARM, {
      periodInMinutes: 0.5,
    });
  } catch {
    // Older Chrome builds enforce a 1 minute minimum period.
    await browser.alarms.create(SAVE_KEEPALIVE_ALARM, { periodInMinutes: 1 });
  }
}

async function stopSaveKeepalive() {
  try {
    await browser.alarms?.clear(SAVE_KEEPALIVE_ALARM);
  } catch {
    // Best effort.
  }
}

browser.runtime.onMessage.addListener(async (message: unknown) => {
  // Progress events from the injected single-file-core capture script. They
  // arrive while a save is running in this worker; keep them in storage so a
  // reopened popup can show the progress again.
  const progressMsg = message as {
    type?: string;
    loaded?: number;
    max?: number;
  };
  if (progressMsg?.type === SINGLEFILE_PROGRESS_MESSAGE) {
    const current = await getSingleFileProgress();
    if (current) {
      await setSingleFileProgress({
        ...current,
        loaded: progressMsg.loaded,
        max: progressMsg.max,
        updatedAt: Date.now(),
      });
    }
    return;
  }

  const msg = message as SaveSingleFileMessage;
  if (!msg || msg.type !== SAVE_SINGLEFILE_MESSAGE) return;

  // Resolve the tab title once so the result message can say which tab
  // finished; the tab may already be gone, so never fail on this.
  let tabTitle: string | undefined;
  if (msg.tabId !== undefined) {
    try {
      tabTitle = (await browser.tabs.get(msg.tabId)).title;
    } catch {
      tabTitle = undefined;
    }
  }
  const subject = tabTitle ? `"${tabTitle}"` : "the page";
  const savedMessage = `Saved ${subject} as a SingleFile snapshot.`;
  const failedMessage = (reason: string) =>
    `Failed to save ${subject}: ${reason}`;
  const partialFailedMessage = (reason: string) =>
    `Saved ${subject}, but the upload failed: ${reason}`;

  const setState = async (phase: "capturing" | "uploading" | null) => {
    if (phase === null) {
      await setSingleFileProgress(null);
      return;
    }
    const current = await getSingleFileProgress();
    await setSingleFileProgress({
      active: true,
      phase,
      loaded: current?.loaded,
      max: current?.max,
      updatedAt: Date.now(),
    });
  };

  try {
    await startSaveKeepalive();
    await setSingleFileProgress({
      active: true,
      phase: "capturing",
      updatedAt: Date.now(),
    });
    // postLink resolves as soon as the upload (and metadata) are done — an
    // HTTP error there means the snapshot was not stored and no link exists.
    await postLink(
      msg.baseUrl,
      msg.uploadImage,
      msg.data,
      setState,
      msg.apiKey,
      {
        enabled: true,
        maxUploadBytes: msg.maxUploadBytes,
        capturePromise: null,
        startCapture: () => captureSingleFile(msg.tabId, msg.maxUploadBytes),
      }
    );
    await setSingleFileProgress(null);

    if (msg.tabId !== undefined) await updateBadge(msg.tabId, true);
    await reportOutcome("success", savedMessage, msg.tabId);
  } catch (error) {
    await setSingleFileProgress(null);
    console.error(error);
    const reason = error instanceof Error ? error.message : "unknown error";
    const linkSaved = (error as { linkSaved?: boolean } | null)?.linkSaved;
    const message = linkSaved
      ? partialFailedMessage(reason)
      : failedMessage(reason);
    await reportOutcome(linkSaved ? "partial" : "failed", message, msg.tabId);
  } finally {
    await stopSaveKeepalive();
  }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  try {
    await updateBadge(tabId, false);
  } catch (error) {
    console.error(`Error clearing the badge of tab ${tabId}:`, error);
  }
});

// Omnibox implementation (not available in Safari)

if (hasAPI("omnibox.onInputStarted")) {
  browser.omnibox.onInputStarted.addListener(async () => {
    const configured = await isConfigured();
    const description = configured
      ? "Search links in linkwarden"
      : "Please configure the extension first";

    browser.omnibox.setDefaultSuggestion({
      description: description,
    });
  });

  browser.omnibox.onInputChanged.addListener(
    async (
      text: string,
      suggest: (arg0: { content: string; description: string }[]) => void
    ) => {
      const configured = await isConfigured();

      if (!configured) {
        return;
      }

      const currentBookmarks = await getBookmarksMetadata();

      const searchedBookmarks = currentBookmarks.filter((bookmark) => {
        return bookmark.name?.includes(text) || bookmark.url.includes(text);
      });

      const bookmarkSuggestions = searchedBookmarks.map((bookmark) => {
        return {
          content: bookmark.url,
          description: bookmark.name || bookmark.url,
        };
      });
      suggest(bookmarkSuggestions);
    }
  );

  // This part was taken https://github.com/sissbruecker/linkding-extension/blob/master/src/background.js Thanks to @sissbruecker

  browser.omnibox.onInputEntered.addListener(
    async (content: string, disposition: OnInputEnteredDisposition) => {
      if (!(await isConfigured()) || !content) {
        return;
      }

      const isUrl = /^http(s)?:\/\//.test(content);
      const url = isUrl ? content : `lk`;

      // Edge doesn't allow updating the New Tab Page (tested with version 117).
      // Trying to do so will throw: "Error: Cannot update NTP tab."
      // As a workaround, open a new tab instead.
      if (disposition === "currentTab") {
        const tabInfo = await getCurrentTabInfo();
        if (tabInfo.url === "edge://newtab/") {
          disposition = "newForegroundTab";
        }
      }

      switch (disposition) {
        case "currentTab":
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await browser.tabs.update({ url });
          break;
        case "newForegroundTab":
          await browser.tabs.create({ url });
          break;
        case "newBackgroundTab":
          await browser.tabs.create({ url, active: false });
          break;
      }
    }
  );
}
