import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, handleApiError } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    return NextResponse.json({ id: user.id, role: user.role });
  } catch (error) {
    return handleApiError(error);
  }
}
