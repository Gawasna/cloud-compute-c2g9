/**
 * Client-Side Media Pre-Processor for CloudStock
 * 
 * Handles client-side image validation, high-performance HTML5 Canvas
 * aspect-ratio-preserving downscaling, and conversion to WebP format
 * prior to uploading to media storage/worker endpoints.
 */

let captureLooseError: (error: unknown, context?: Record<string, unknown>) => unknown = () => {};
// Dynamically resolve telemetry to avoid ERR_MODULE_NOT_FOUND when executed by Node native test runner
import('@/lib/observability')
  .then((m) => {
    captureLooseError = m.captureLooseError;
  })
  .catch(() => {
    // Resilient fallback for non-bundled environments
  });

export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const DEFAULT_MAX_DIMENSION = 800;
export const DEFAULT_WEBP_QUALITY = 0.82;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface ProcessProductImageOptions {
  maxDimension?: number;
  quality?: number;
}

export interface ProcessedProductImage {
  blob: Blob;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  mimeType: 'image/webp';
  width: number;
  height: number;
}

export interface UploadImageResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Validates and pre-processes a product image file in the browser:
 * - Checks file size (<= 10MB)
 * - Checks MIME type (JPEG, PNG, WebP)
 * - Calculates aspect-ratio dimensions scaled to maxDimension (default 800px)
 * - Encodes downscaled image to WebP with specified quality (default 0.82)
 * - Generates an Object URL for instant live preview
 */
export async function processProductImage(
  file: File,
  options?: ProcessProductImageOptions
): Promise<ProcessedProductImage> {
  if (!file) {
    throw new Error('No file provided for image processing');
  }

  // 1. File size validation (<= 10MB)
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`File size (${sizeInMb} MB) exceeds maximum allowed limit of 10 MB`);
  }

  // 2. MIME type validation
  const mimeType = file.type?.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    throw new Error(`Unsupported image format "${file.type}". Allowed formats: JPEG, PNG, WebP`);
  }

  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = Math.min(Math.max(options?.quality ?? DEFAULT_WEBP_QUALITY, 0.1), 1.0);

  // 3. Load image into HTML5 Image element
  const objectUrl = URL.createObjectURL(file);
  let img: HTMLImageElement;

  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => {
        const error = new Error('Failed to decode image data into browser memory');
        try {
          captureLooseError(error, {
            source: 'media.client-preprocessor.decode',
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          });
        } catch {
          // resilient
        }
        reject(error);
      };
      el.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new Error('Image has invalid dimensions');
  }

  // 4. Calculate target aspect ratio maintaining boundaries
  let targetWidth = naturalWidth;
  let targetHeight = naturalHeight;

  if (naturalWidth > maxDimension || naturalHeight > maxDimension) {
    if (naturalWidth >= naturalHeight) {
      targetWidth = maxDimension;
      targetHeight = Math.round((naturalHeight * maxDimension) / naturalWidth);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((naturalWidth * maxDimension) / naturalHeight);
    }
  }

  // 5. Draw to Canvas and encode to WebP
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('HTML5 Canvas 2D context is not available');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const compressedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          const error = new Error('Failed to encode image to WebP format');
          try {
            captureLooseError(error, {
              source: 'media.client-preprocessor.encode',
              quality,
              targetWidth,
              targetHeight,
            });
          } catch {
            // resilient
          }
          reject(error);
        }
      },
      'image/webp',
      quality
    );
  });

  const previewUrl = URL.createObjectURL(compressedBlob);

  return {
    blob: compressedBlob,
    previewUrl,
    originalSize: file.size,
    compressedSize: compressedBlob.size,
    mimeType: 'image/webp',
    width: targetWidth,
    height: targetHeight,
  };
}

/**
 * Format bytes into human-readable string (e.g., "45.2 KB", "1.2 MB")
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
  const unitIndex = Math.min(exponent, units.length - 1);

  if (unitIndex === 0) {
    return `${bytes} B`;
  }

  const value = bytes / Math.pow(1024, unitIndex);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Uploads processed binary WebP to server upload endpoint (/api/upload).
 * Sends binary WebP with Content-Type: image/webp and returns upload result.
 */
export async function uploadProductImage(
  blob: Blob,
  uploadUrl = '/api/upload'
): Promise<UploadImageResult> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/webp',
      },
      body: blob,
    });

    if (!response.ok) {
      let errorMessage = `Upload failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && (errorData.message || errorData.error)) {
          errorMessage = errorData.message || errorData.error;
        }
      } catch {
        const text = await response.text().catch(() => '');
        if (text) errorMessage = text;
      }
      try {
        captureLooseError(new Error(errorMessage), {
          source: 'media.client-preprocessor.upload',
          uploadUrl,
          status: response.status,
          blobSize: blob.size,
          blobType: blob.type,
        });
      } catch {
        // resilient
      }
      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url || data.imageUrl || data.path,
      key: data.key || data.id,
    };
  } catch (err) {
    try {
      captureLooseError(err, {
        source: 'media.client-preprocessor.upload',
        uploadUrl,
        blobSize: blob.size,
        blobType: blob.type,
      });
    } catch {
      // resilient
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network failure during media upload',
    };
  }
}
