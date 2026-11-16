import { NextResponse, type NextRequest } from "next/server";
import { captureLooseError } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return new NextResponse(null, { status: 204 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    if (!payload || typeof payload !== "object") {
      return new NextResponse(null, { status: 204 });
    }

    if (Array.isArray(payload)) {
      for (const item of payload) {
        if (!item || typeof item !== "object") continue;
        const report = item as Record<string, unknown>;
        const body = (report.body && typeof report.body === "object" ? report.body : {}) as Record<string, unknown>;
        const effectiveDirective = (body.effectiveDirective || body["effective-directive"] || report.type || "csp-violation") as string;
        const blockedUrl = (body.blockedURL || body["blocked-uri"] || "unknown") as string;

        captureLooseError(
          new Error(`CSP Violation: ${effectiveDirective} blocked ${blockedUrl}`),
          {
            source: "csp.report-to",
            type: report.type,
            url: report.url,
            user_agent: report.user_agent,
            body,
          }
        );
      }
    } else {
      const record = payload as Record<string, unknown>;
      const cspReport = (record["csp-report"] && typeof record["csp-report"] === "object"
        ? record["csp-report"]
        : record) as Record<string, unknown>;

      const directive = (cspReport["effective-directive"] ||
        cspReport["violated-directive"] ||
        cspReport.effectiveDirective ||
        "csp-violation") as string;
      const blocked = (cspReport["blocked-uri"] || cspReport.blockedURL || "unknown") as string;

      captureLooseError(
        new Error(`CSP Violation: ${directive} blocked ${blocked}`),
        {
          source: "csp.report-to",
          report: cspReport,
        }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
