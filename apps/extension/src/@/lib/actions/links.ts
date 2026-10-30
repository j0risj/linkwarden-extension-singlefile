import captureScreenshot from "../screenshot.ts";
import { bookmarkFormValues } from "../validators/bookmarkForm.ts";
import axios, { AxiosError } from "axios";
// import { bookmarkMetadata } from '../cache.ts';
import { getTags } from "./tags.ts";

export interface SaveSingleFileOptions {
  enabled: boolean;
  archivalTagName: string;
  capturePromise: Promise<{ html: string; blob: Blob }> | null;
  startCapture: () => Promise<{ html: string; blob: Blob }>;
  onFallbackNeeded?: () => void;
}

const withRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof AxiosError && error.response) throw error;
      if (attempt < attempts - 1)
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
};

const uploadArchive = async (
  baseUrl: string,
  apiKey: string,
  linkId: number,
  format: number,
  file: Blob,
  filename: string
) => {
  const formData = new FormData();
  formData.append("file", file, filename);
  return withRetry(() =>
    axios.post(
      `${baseUrl}/api/v1/archives/${linkId}?format=${format}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )
  );
};

const findArchivalTagId = async (
  baseUrl: string,
  apiKey: string,
  name: string
): Promise<number | undefined> => {
  let cursor: number | undefined = 0;
  while (cursor !== undefined && cursor !== null) {
    const page = await getTags(baseUrl, apiKey, cursor, name);
    const found = page.tags.find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase()
    );
    if (found) return found.id;
    cursor = page.nextCursor ?? undefined;
  }
  return undefined;
};

const verifyDerivedFormats = async (
  baseUrl: string,
  apiKey: string,
  linkId: number,
  onFallbackNeeded?: () => void
) => {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const deadline = Date.now() + 10 * 60 * 1000;
  let link: any;
  while (Date.now() < deadline) {
    const response = await withRetry(() =>
      axios.get(`${baseUrl}/api/v1/links/${linkId}`, { headers })
    );
    link = response.data.response;
    if (link?.lastPreserved) break;
    await new Promise((r) => setTimeout(r, 10000));
  }
  if (!link?.lastPreserved) return;
  const unavailable = [link.readable, link.image, link.pdf].some(
    (format) => format === "unavailable"
  );
  if (unavailable) onFallbackNeeded?.();
};

export async function postLink(
  baseUrl: string,
  uploadImage: boolean,
  data: bookmarkFormValues,
  setState: (state: "capturing" | "uploading" | null) => void,
  apiKey: string,
  singlefile?: SaveSingleFileOptions
) {
  const url = `${baseUrl}/api/v1/links`;

  let singleFileResult: { html: string; blob: Blob } | null = null;

  if (singlefile?.enabled) {
    setState("capturing");
    singleFileResult = singlefile.capturePromise
      ? await singlefile.capturePromise
      : await singlefile.startCapture();
    setState("uploading");

    const archivalTagId = await findArchivalTagId(
      baseUrl,
      apiKey,
      singlefile.archivalTagName
    );
    if (!archivalTagId) {
      throw new Error(
        `Archival tag "${singlefile.archivalTagName}" not found. Create it in Linkwarden with archiveAsMonolith disabled, then try again.`
      );
    }

    const tags = [...(data.tags ?? [])];
    if (
      !tags.some(
        (tag) =>
          tag.name.toLowerCase() === singlefile.archivalTagName.toLowerCase()
      )
    ) {
      tags.push({ id: archivalTagId, name: singlefile.archivalTagName });
    }

    const link = await axios.post(
      url,
      { ...data, tags },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const { id } = link.data.response;
    await uploadArchive(
      baseUrl,
      apiKey,
      id,
      4,
      singleFileResult?.blob as Blob,
      "page.html"
    );

    if (uploadImage) {
      const screenshot = await captureScreenshot();
      await uploadArchive(baseUrl, apiKey, id, 0, screenshot, "screenshot.png");
    }

    setState(null);
    void verifyDerivedFormats(baseUrl, apiKey, id, singlefile.onFallbackNeeded);

    return link;
  }

  if (uploadImage) {
    setState("capturing");
    const screenshot = await captureScreenshot();
    setState("uploading");

    const link = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const { id } = link.data.response;
    await uploadArchive(baseUrl, apiKey, id, 0, screenshot, "screenshot.png");

    setState(null);

    return link;
  } else {
    return await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }
}

export async function postLinkFetch(
  baseUrl: string,
  data: bookmarkFormValues,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links`;

  return await fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function updateLinkFetch(
  baseUrl: string,
  id: number,
  data: bookmarkFormValues,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links/${id}`;

  return await fetch(url, {
    method: "PUT",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function deleteLinkFetch(
  baseUrl: string,
  id: number,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links/${id}`;

  return await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function checkLinkExists(
  baseUrl: string,
  apiKey: string,
  linkUrl: string | undefined
): Promise<boolean> {
  if (!baseUrl || !apiKey || !linkUrl) {
    return false;
  }

  const url =
    `${baseUrl}/api/v1/search?sort=0&searchQueryString=` +
    encodeURIComponent(`url:${linkUrl}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const { data } = await response.json();

    return !!data && data.links?.length > 0;
  } catch (error) {
    console.error(error);
    return false;
  }
}
