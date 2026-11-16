export class ApiError extends Error {
  readonly statusCode: number;
  readonly expose = true;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const DEFAULT_MEDIA_WORKER_UPLOAD_URL =
  "https://cc-media-worker.hunglepy05.workers.dev/upload";
export const DEFAULT_MEDIA_WORKER_BASE_URL =
  "https://cc-media-worker.hunglepy05.workers.dev/media";

export interface MediaUploadResult {
  success: boolean;
  url: string;
  key: string;
  size: number;
}

export interface ProcessUploadOptions {
  workerUploadUrl?: string;
  workerBaseUrl?: string;
  fetcher?: typeof fetch;
}

/**
 * Validates incoming image upload request and forwards binary WebP buffer to Cloudflare Media Worker.
 * Normalizes output URL to direct worker media serving URL.
 */
export async function processMediaUpload(
  request: Request,
  options: ProcessUploadOptions = {}
): Promise<MediaUploadResult> {
  const uploadUrl =
    options.workerUploadUrl ||
    (typeof process !== "undefined" ? process.env.MEDIA_WORKER_UPLOAD_URL : undefined) ||
    DEFAULT_MEDIA_WORKER_UPLOAD_URL;

  const baseUrl =
    options.workerBaseUrl ||
    (typeof process !== "undefined" ? process.env.MEDIA_WORKER_BASE_URL : undefined) ||
    DEFAULT_MEDIA_WORKER_BASE_URL;

  const fetcher = options.fetcher || fetch;
  const contentType = request.headers.get("content-type") || "";

  let fileBuffer: Uint8Array;

  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new ApiError(400, "Invalid form data");
    }
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      throw new ApiError(400, "Missing 'file' field in form data");
    }
    const blob = file as Blob;
    if (!blob.type || !blob.type.toLowerCase().startsWith("image/webp")) {
      throw new ApiError(415, "Unsupported Media Type. Only image/webp is accepted");
    }
    fileBuffer = new Uint8Array(await blob.arrayBuffer());
  } else if (contentType.toLowerCase().startsWith("image/webp")) {
    const arrayBuffer = await request.arrayBuffer();
    fileBuffer = new Uint8Array(arrayBuffer);
  } else {
    throw new ApiError(415, "Unsupported Media Type. Only image/webp is accepted");
  }

  if (fileBuffer.byteLength === 0) {
    throw new ApiError(400, "Empty image file provided");
  }

  if (fileBuffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new ApiError(413, "Image exceeds maximum allowed size of 2MB");
  }

  // Forward raw WebP binary buffer to Cloudflare Media Worker
  const response = await fetcher(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "image/webp",
    },
    body: fileBuffer.buffer as ArrayBuffer,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Worker upload failed");
    throw new ApiError(
      response.status >= 500 ? 502 : response.status,
      `Media Worker error: ${errText}`
    );
  }

  const data = (await response.json()) as {
    key?: string;
    url?: string;
    size?: number;
    success?: boolean;
  };

  const key = data.key || "";
  let finalUrl = data.url || "";

  // Normalize URL to direct worker serving endpoint: https://cc-media-worker.hunglepy05.workers.dev/media/${key}
  if (key) {
    const cleanKey = key.replace(/^\/+/, "");
    finalUrl = `${baseUrl.replace(/\/+$/, "")}/${cleanKey}`;
  } else if (finalUrl.includes("media.cloudstock.app")) {
    finalUrl = finalUrl.replace("https://media.cloudstock.app", baseUrl.replace(/\/+$/, ""));
  }

  return {
    success: true,
    url: finalUrl,
    key,
    size: data.size || fileBuffer.byteLength,
  };
}
