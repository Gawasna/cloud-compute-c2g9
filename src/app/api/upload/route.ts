import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/auth/server";
import { processMediaUpload } from "@/lib/media/upload-pipeline";

export const POST = createApiHandler(
  async (request) => {
    const result = await processMediaUpload(request);
    return NextResponse.json(result);
  },
  { roles: ["admin", "staff"] }
);
