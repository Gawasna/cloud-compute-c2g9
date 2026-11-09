import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/auth/server";

export const GET = createApiHandler(
  async (_request, { user }) => {
    return NextResponse.json(
      { id: user!.id, role: user!.role, email: user!.email ?? "" },
      { headers: { "Cache-Control": "no-store" } }
    );
  },
  { auth: true }
);
