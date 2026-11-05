import captureScreenshot from "../screenshot.ts";
import { bookmarkFormValues } from "../validators/bookmarkForm.ts";
import axios, { AxiosError } from "axios";
// import { bookmarkMetadata } from '../cache.ts';

export interface SaveSingleFileOptions {
  enabled: boolean;
  maxUploadBytes: number;
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
    try {
      singleFileResult = singlefile.capturePromise
        ? await singlefile.capturePromise
        : await singlefile.startCapture();
    } catch (error) {
      throw new Error(
        `Saving aborted while capturing the page: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    setState("uploading");

    // Upload-first flow: POST /api/v1/archives?format=4 creates the link and
    // stores the snapshot in one atomic request (this is the endpoint the
    // SingleFile browser extension targets). The server pins lastPreserved to
    // the epoch until the file is on disk, so the worker can never process the
    // link mid-upload; afterwards lastPreserved is null and the worker derives
    // the other formats from the uploaded snapshot. The link starts in the
    // default collection with a title extracted from the snapshot, and the
    // dialog's metadata is applied with a PUT right after.
    let link;
    try {
      const formData = new FormData();
      formData.append(
        "file",
        singleFileResult.blob,
        "page.html"
      );
      formData.append("url", data.url);
      link = await withRetry(() =>
        axios.post(`${baseUrl}/api/v1/archives?format=4`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${apiKey}`,
          },
        })
      );
    } catch (error) {
      throw new Error(
        `Saving aborted while uploading the SingleFile snapshot: ${
          error instanceof AxiosError
            ? `${error.response?.status ?? ""} ${
                error.response?.statusText ?? ""
              } ${JSON.stringify(
                error.response?.data?.response ?? ""
              )}`.trim()
            : error instanceof Error
              ? error.message
              : String(error)
        }. If the status is 413, the snapshot exceeds the upload size your ` +
          "Linkwarden server or its reverse proxy accepts."
      );
    }

    const created = link.data.response;

    // Apply the dialog's metadata (collection, tags, name, description) to the
    // freshly created link. The PUT needs the link's current collection owner,
    // so fetch the link first.
    try {
      const current = await withRetry(() =>
        axios.get(`${baseUrl}/api/v1/links/${created.id}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
      );
      const currentLink = current.data.response;
      const targetCollection = data.collection?.id
        ? data.collection
        : undefined;

      await withRetry(() =>
        axios.put(
          `${baseUrl}/api/v1/links/${created.id}`,
          {
            id: created.id,
            name: data.name || currentLink.name || "",
            url: data.url,
            description: data.description ?? "",
            collection: {
              id: targetCollection?.id ?? currentLink.collection.id,
              ownerId: currentLink.collection.ownerId,
            },
            tags: data.tags ?? [],
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        )
      );
    } catch (error) {
      // The snapshot and formats are already safe at this point; only the
      // metadata (collection/tags/name) is missing. Tell the user instead of
      // failing the whole save. `linkSaved` lets the caller report a partial
      // failure instead of a plain one.
      const err = new Error(
        `The snapshot was saved, but updating its metadata (collection/tags) failed: ${
          error instanceof AxiosError
            ? `${error.response?.status ?? ""} ${JSON.stringify(
                error.response?.data?.response ?? ""
              )}`.trim()
            : error instanceof Error
              ? error.message
              : String(error)
        }. The link is in your default collection; edit it in Linkwarden.`
      );
      (err as Error & { linkSaved?: boolean }).linkSaved = true;
      throw err;
    }

    if (uploadImage) {
      try {
        const screenshot = await captureScreenshot();
        await uploadArchive(
          baseUrl,
          apiKey,
          created.id,
          0,
          screenshot,
          "screenshot.png"
        );
      } catch (error) {
        const err = new Error(
          `The snapshot was saved, but uploading the screenshot failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        (err as Error & { linkSaved?: boolean }).linkSaved = true;
        throw err;
      }
    }

    setState(null);
    // Awaited (not `void`) so the caller can send a single notification that
    // already accounts for formats falling back to server-side generation.
    await verifyDerivedFormats(
      baseUrl,
      apiKey,
      created.id,
      singlefile.onFallbackNeeded
    );

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
