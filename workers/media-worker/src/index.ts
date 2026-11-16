export interface Env {
  PRODUCT_MEDIA_BUCKET: R2Bucket;
  ALLOWED_ORIGINS: string;
  PUBLIC_CDN_URL: string;
  UPLOAD_SECRET?: string;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  let allowOrigin = "";
  if (allowed.includes("*")) {
    allowOrigin = "*";
  } else if (allowed.includes(origin)) {
    allowOrigin = origin;
  } else if (allowed.length === 0) {
    allowOrigin = "*";
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    if (allowOrigin !== "*") {
      headers["Vary"] = "Origin";
    }
  }

  return headers;
}

function jsonResponse(data: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // GET /health
    if (request.method === "GET" && pathname === "/health") {
      return jsonResponse(
        {
          status: "ok",
          service: "cc-media-worker",
          bucket_bound: Boolean(env.PRODUCT_MEDIA_BUCKET),
          timestamp: Date.now(),
        },
        200,
        corsHeaders
      );
    }

    // POST /upload
    if (request.method === "POST" && pathname === "/upload") {
      // Optional secret check
      if (env.UPLOAD_SECRET) {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== `Bearer ${env.UPLOAD_SECRET}`) {
          return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
        }
      }

      // Check Content-Type (must be image/webp)
      const contentType = request.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("image/webp")) {
        return jsonResponse(
          { error: "Unsupported media type. Only image/webp is accepted" },
          415,
          corsHeaders
        );
      }

      // Read binary payload
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return jsonResponse({ error: "Empty payload" }, 400, corsHeaders);
      }

      if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
        return jsonResponse(
          {
            error: `Payload exceeds 2MB limit (received ${arrayBuffer.byteLength} bytes)`,
          },
          413,
          corsHeaders
        );
      }

      if (!env.PRODUCT_MEDIA_BUCKET) {
        return jsonResponse({ error: "Storage bucket not bound" }, 500, corsHeaders);
      }

      // Generate unique key: products/{timestamp}_{uuid8}.webp
      const randomSuffix = crypto.randomUUID().slice(0, 8);
      const key = `products/${Date.now()}_${randomSuffix}.webp`;

      await env.PRODUCT_MEDIA_BUCKET.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: "image/webp",
        },
      });

      let cdnUrl = env.PUBLIC_CDN_URL || "";
      while (cdnUrl.endsWith("/")) {
        cdnUrl = cdnUrl.slice(0, -1);
      }
      const publicUrl = cdnUrl ? `${cdnUrl}/${key}` : `/${key}`;

      return jsonResponse(
        {
          success: true,
          key,
          url: publicUrl,
          size: arrayBuffer.byteLength,
        },
        201,
        corsHeaders
      );
    }

    // GET /media/*
    if (request.method === "GET" && pathname.startsWith("/media/")) {
      const key = decodeURIComponent(pathname.slice("/media/".length));
      if (!key || key.includes("..")) {
        return jsonResponse({ error: "Invalid media key" }, 400, corsHeaders);
      }

      if (!env.PRODUCT_MEDIA_BUCKET) {
        return jsonResponse({ error: "Storage bucket not bound" }, 500, corsHeaders);
      }

      const object = await env.PRODUCT_MEDIA_BUCKET.get(key);
      if (!object) {
        return jsonResponse({ error: "Media not found" }, 404, corsHeaders);
      }

      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", object.httpMetadata?.contentType || "image/webp");
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      if (object.httpEtag) {
        headers.set("ETag", object.httpEtag);
      }
      headers.set("Content-Length", object.size.toString());

      return new Response(object.body, {
        status: 200,
        headers,
      });
    }

    return jsonResponse({ error: "Not Found" }, 404, corsHeaders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: "Internal Server Error", message }, 500, corsHeaders);
  }
}

const worker = {
  fetch: handleRequest,
};

export default worker;
