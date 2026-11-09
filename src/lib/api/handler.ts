import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles } from "@/lib/auth/guard";
import type { AuthUser, Role } from "@/lib/auth/types";
import { handleApiError } from "./errors";

export interface ApiHandlerContext<TParams = Record<string, string>> {
  user?: AuthUser;
  params: TParams;
  searchParams: URLSearchParams;
  requestId: string;
  req: Request;
}

export interface ApiHandlerOptions {
  auth?: boolean;
  roles?: Role[];
}

export type ApiRouteFn<TParams = Record<string, string>> = (
  request: Request,
  context: ApiHandlerContext<TParams>
) => Promise<NextResponse | Response>;

/**
 * Higher-Order Route Handler (HOF) for Next.js App Router.
 * Guarantees 100% error coverage through handleApiError,
 * declarative authentication & role checking,
 * automatic x-request-id tracing and Server-Timing performance header injection.
 */
export function createApiHandler<TParams = Record<string, string>>(
  fn: ApiRouteFn<TParams>,
  options: ApiHandlerOptions = {}
) {
  return async (
    request: Request,
    routeContext: { params: Promise<TParams> }
  ): Promise<Response> => {
    const start = performance.now();
    const incomingReqId = request.headers.get("x-request-id");
    const requestId =
      incomingReqId ||
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15));

    try {
      let user: AuthUser | undefined;
      const requiresAuth = options.auth ?? Boolean(options.roles && options.roles.length > 0);

      if (requiresAuth) {
        user = await authenticateUser(request);
        if (options.roles && options.roles.length > 0) {
          requireRoles(user, options.roles);
        }
      }

      const rawParams = routeContext?.params;
      const resolvedParams =
        rawParams instanceof Promise
          ? await rawParams
          : ((rawParams || {}) as TParams);

      const url = new URL(request.url);

      const response = await fn(request, {
        user,
        params: resolvedParams,
        searchParams: url.searchParams,
        requestId,
        req: request,
      });

      const elapsed = Math.round(performance.now() - start);
      response.headers.set("x-request-id", requestId);
      response.headers.set("x-response-time", `${elapsed}ms`);
      response.headers.set("Server-Timing", `total;dur=${elapsed}`);

      return response;
    } catch (error) {
      const errorResponse = handleApiError(error);
      const elapsed = Math.round(performance.now() - start);
      errorResponse.headers.set("x-request-id", requestId);
      errorResponse.headers.set("x-response-time", `${elapsed}ms`);
      return errorResponse;
    }
  };
}
