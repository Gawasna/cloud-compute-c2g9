import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, handleApiError } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    return NextResponse.json(
      { id: user.id, role: user.role, email: user.email ?? "" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
