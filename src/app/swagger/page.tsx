"use client";

import { useState } from "react";

type HttpMethod = "GET" | "POST";
type Mode = "loose" | "strict" | "api_500" | "api_4xx" | "unhandled";

interface ModeOption {
  value: Mode;
  label: string;
  destination: string;
  badgeClass: string;
  description: string;
}

const MODES: ModeOption[] = [
  {
    value: "loose",
    label: "Loose Error (Level: error)",
    destination: "Bugsink (HP Node) Only",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
    description: "Lỗi thường/nghiệp vụ. Chỉ gửi về Bugsink để bảo toàn quota Sentry Cloud.",
  },
  {
    value: "strict",
    label: "Strict Error (Level: fatal)",
    destination: "Sentry Cloud + Bugsink HP",
    badgeClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300",
    description: "Sự cố nghiêm trọng / P0. Gửi đồng thời tới Sentry Cloud (để alert) và Bugsink.",
  },
  {
    value: "api_500",
    label: "Simulated API 500 (handleApiError)",
    destination: "Sentry Cloud + Bugsink HP",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
    description: "Mô phỏng Exception 500 đi qua middleware handleApiError.",
  },
  {
    value: "api_4xx",
    label: "Simulated API 400 (Validation / ApiError)",
    destination: "Bugsink (HP Node) Only",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
    description: "Mô phỏng lỗi dữ liệu đầu vào 400 (Client validation) đi qua handleApiError.",
  },
  {
    value: "unhandled",
    label: "Unhandled Server Rejection (Throw)",
    destination: "Next.js onRequestError -> Sentry/Bugsink",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300",
    description: "Ném lỗi unhandled trực tiếp trên Server để kiểm thử Next.js instrumentation.",
  },
];

export default function SwaggerPage() {
  const [selectedMethod, setSelectedMethod] = useState<HttpMethod>("POST");
  const [selectedMode, setSelectedMode] = useState<Mode>("loose");
  const [customMessage, setCustomMessage] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseBody, setResponseBody] = useState<string | null>(null);

  const currentModeInfo = MODES.find((m) => m.value === selectedMode) || MODES[0];

  const handleExecute = async () => {
    setLoading(true);
    setResponseStatus(null);
    setResponseBody(null);
    setResponseHeaders({});

    try {
      const url = new URL("/api/debug/telemetry", window.location.origin);
      url.searchParams.set("mode", selectedMode);
      if (customMessage.trim()) {
        url.searchParams.set("message", customMessage.trim());
      }
      if (secretKey.trim()) {
        url.searchParams.set("secret", secretKey.trim());
      }

      const headers: Record<string, string> = {};
      if (secretKey.trim()) {
        headers["x-telemetry-debug-secret"] = secretKey.trim();
      }

      const res = await fetch(url.toString(), {
        method: selectedMethod,
        headers,
      });

      setResponseStatus(res.status);

      const hdrs: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        hdrs[k] = v;
      });
      setResponseHeaders(hdrs);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponseBody(JSON.stringify(json, null, 2));
      } catch {
        setResponseBody(text);
      }
    } catch (err: unknown) {
      setResponseStatus(0);
      setResponseBody(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                OAS 3.0.3
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                CloudStock Telemetry Trigger API
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Interactive Swagger interface to trigger & verify telemetry multiplexing between Sentry Cloud and Bugsink HP Node.
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
              <span>Rate Limit: <strong className="text-emerald-400">5 req/min per IP per event</strong> (Production)</span>
              <span>•</span>
              <a
                href="/swagger/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline"
              >
                /swagger/openapi.json
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSecretModal(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${
                secretKey
                  ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              {secretKey ? "✓ Authorized (Secret Set)" : "Authorize (Secret Key)"}
            </button>
          </div>
        </header>

        {/* Secret Key Modal */}
        {showSecretModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-white">Authorize (Production Secret Key)</h3>
              <p className="text-xs text-slate-400">
                On Production, telemetry trigger is protected by <code>TELEMETRY_DEBUG_SECRET</code>. Leave empty for local development.
              </p>
              <input
                type="password"
                placeholder="Enter TELEMETRY_DEBUG_SECRET..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setSecretKey("");
                    setShowSecretModal(false);
                  }}
                  className="px-3 py-1.5 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowSecretModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Endpoint Section */}
        <section className="bg-slate-800/80 border border-slate-700/80 rounded-lg overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex rounded border border-slate-700 overflow-hidden text-xs font-bold">
                <button
                  onClick={() => setSelectedMethod("POST")}
                  className={`px-3 py-1 ${
                    selectedMethod === "POST" ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400"
                  }`}
                >
                  POST
                </button>
                <button
                  onClick={() => setSelectedMethod("GET")}
                  className={`px-3 py-1 ${
                    selectedMethod === "GET" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"
                  }`}
                >
                  GET
                </button>
              </div>
              <span className="font-mono text-sm font-semibold text-slate-200">
                /api/debug/telemetry
              </span>
            </div>

            <span className={`text-xs px-2.5 py-1 rounded border font-medium ${currentModeInfo.badgeClass}`}>
              {currentModeInfo.destination}
            </span>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                1. Select Error Event Mode (Loại sự kiện lỗi)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMode(m.value)}
                    className={`text-left p-3 rounded border transition-all ${
                      selectedMode === m.value
                        ? "bg-slate-700 border-indigo-500 ring-1 ring-indigo-500 text-white"
                        : "bg-slate-900/50 border-slate-700/60 text-slate-300 hover:bg-slate-700/40"
                    }`}
                  >
                    <div className="font-bold text-xs">{m.label}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{m.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                2. Custom Message (Optional)
              </label>
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter custom error message or leave blank for default timestamp..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-700">
              <div className="text-xs text-slate-400">
                Request Target: <code className="text-indigo-300 font-mono">/api/debug/telemetry?mode={selectedMode}</code>
              </div>
              <button
                onClick={handleExecute}
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-bold text-sm transition-colors flex items-center gap-2"
              >
                {loading ? "Dispatching..." : "Execute Request"}
              </button>
            </div>
          </div>
        </section>

        {/* Response Section */}
        {responseStatus !== null && (
          <section className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Server Response
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    responseStatus >= 200 && responseStatus < 300
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : responseStatus === 429
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "bg-red-500/20 text-red-400 border border-red-500/40"
                  }`}
                >
                  HTTP {responseStatus}
                </span>
                {responseHeaders["x-ratelimit-remaining"] !== undefined && (
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                    Remaining: {responseHeaders["x-ratelimit-remaining"]} / 5
                  </span>
                )}
              </div>
            </div>

            {responseHeaders["retry-after"] && (
              <div className="p-3 bg-amber-950/40 border border-amber-700/50 rounded text-xs text-amber-300">
                Rate Limit Exceeded! Retry after: {responseHeaders["retry-after"]} seconds.
              </div>
            )}

            <div>
              <div className="text-xs text-slate-400 mb-1 font-semibold">Response Body:</div>
              <pre className="p-4 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-96">
                {responseBody || "(Empty response)"}
              </pre>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
