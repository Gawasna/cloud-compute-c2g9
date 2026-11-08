"use client";

import { useEffect, useState } from "react";
import "swagger-ui-dist/swagger-ui.css";

type HttpMethod = "GET" | "POST";
type Mode = "loose" | "strict" | "api_500" | "api_4xx" | "unhandled";

interface ModeOption {
  value: Mode;
  label: string;
  destination: string;
  description: string;
}

const MODES: ModeOption[] = [
  {
    value: "loose",
    label: "Loose Error (Level: error)",
    destination: "Bugsink (HP Node) Only",
    description: "Lỗi thường/nghiệp vụ. Chỉ gửi về Bugsink để bảo toàn quota Sentry Cloud.",
  },
  {
    value: "strict",
    label: "Strict Error (Level: fatal)",
    destination: "Sentry Cloud + Bugsink HP",
    description: "Sự cố nghiêm trọng / P0. Gửi đồng thời tới Sentry Cloud (để alert) và Bugsink.",
  },
  {
    value: "api_500",
    label: "Simulated API 500 (handleApiError)",
    destination: "Sentry Cloud + Bugsink HP",
    description: "Mô phỏng Exception 500 đi qua middleware handleApiError.",
  },
  {
    value: "api_4xx",
    label: "Simulated API 400 (Validation / ApiError)",
    destination: "Bugsink (HP Node) Only",
    description: "Mô phỏng lỗi dữ liệu đầu vào 400 (Client validation) đi qua handleApiError.",
  },
  {
    value: "unhandled",
    label: "Unhandled Server Rejection (Throw)",
    destination: "Next.js onRequestError -> Sentry/Bugsink",
    description: "Ném lỗi unhandled trực tiếp trên Server để kiểm thử Next.js instrumentation.",
  },
];

export default function SwaggerPage() {
  const [swaggerReady, setSwaggerReady] = useState(false);
  const [swaggerError, setSwaggerError] = useState<string | null>(null);

  // Quick Telemetry Diagnostics drawer state
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<HttpMethod>("POST");
  const [selectedMode, setSelectedMode] = useState<Mode>("loose");
  const [customMessage, setCustomMessage] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initSwagger() {
      try {
        const swaggerModule = await import("swagger-ui-dist");
        const SwaggerUIBundle = swaggerModule.SwaggerUIBundle;
        const SwaggerUIStandalonePreset = swaggerModule.SwaggerUIStandalonePreset;

        if (!isMounted) return;

        if (SwaggerUIBundle) {
          SwaggerUIBundle({
            url: "/swagger/openapi.json",
            dom_id: "#swagger-ui-container",
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset,
            ],
            layout: "BaseLayout",
            docExpansion: "list",
            defaultModelsExpandDepth: 1,
            showExtensions: true,
            showCommonExtensions: true,
          });
          setSwaggerReady(true);
        } else {
          throw new Error("SwaggerUIBundle export is not found in swagger-ui-dist.");
        }
      } catch (err: unknown) {
        if (isMounted) {
          setSwaggerError(String(err));
        }
      }
    }

    initSwagger();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleQuickExecute = async () => {
    setLoading(true);
    setResponseStatus(null);
    setResponseBody(null);

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
    <div style={{ minHeight: "100vh", background: "#f8f9fc", color: "#1e293b", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* CloudStock Header Bar */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: "1440px",
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                background: "linear-gradient(140deg, #6366f1, #8b5cf6)",
                color: "#ffffff",
                borderRadius: "10px",
                width: "40px",
                height: "40px",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "18px",
                boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
              }}
            >
              CS
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>
                  CloudStock API Reference
                </h1>
                <span
                  style={{
                    background: "#ecfdf5",
                    color: "#059669",
                    border: "1px solid #a7f3d0",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "6px",
                  }}
                >
                  OAS 3.0.3
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                Enterprise Inventory Management REST API & Telemetry Multiplexing
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <a
              href="/swagger/openapi.json"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#4f46e5",
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                padding: "8px 14px",
                borderRadius: "8px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              /swagger/openapi.json
            </a>

            <button
              onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: showTelemetryDrawer ? "#ffffff" : "#334155",
                background: showTelemetryDrawer ? "#4f46e5" : "#f1f5f9",
                border: "1px solid #cbd5e1",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {showTelemetryDrawer ? "Close Diagnostics" : "Quick Telemetry Diagnostics"}
            </button>
          </div>
        </div>

        {/* Quick Telemetry Trigger Diagnostics Panel */}
        {showTelemetryDrawer && (
          <div
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              borderTop: "1px solid #1e293b",
              borderBottom: "1px solid #1e293b",
              padding: "20px 24px",
            }}
          >
            <div style={{ maxWidth: "1440px", margin: "0 auto", display: "grid", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
                    Telemetry Multiplexing Error Trigger (/api/debug/telemetry)
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    Direct testing panel for Sentry Cloud & Bugsink HP Node. Production requires <code>TELEMETRY_DEBUG_SECRET</code> (Rate limit: 5 req/min per IP per event).
                  </p>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => setSelectedMethod("POST")}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: selectedMethod === "POST" ? "#10b981" : "#1e293b",
                      color: "#ffffff",
                    }}
                  >
                    POST
                  </button>
                  <button
                    onClick={() => setSelectedMethod("GET")}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: selectedMethod === "GET" ? "#3b82f6" : "#1e293b",
                      color: "#ffffff",
                    }}
                  >
                    GET
                  </button>
                </div>
              </div>

              {/* Mode Selectors */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                {MODES.map((m) => {
                  const isSelected = selectedMode === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setSelectedMode(m.value)}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderRadius: "8px",
                        border: isSelected ? "1px solid #6366f1" : "1px solid #334155",
                        background: isSelected ? "#1e1b4b" : "#1e293b",
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 700 }}>{m.label}</div>
                      <div style={{ fontSize: "10px", color: "#a5b4fc", marginTop: "2px" }}>{m.destination}</div>
                      <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>{m.description}</div>
                    </button>
                  );
                })}
              </div>

              {/* Input params */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                    Production Secret Key (TELEMETRY_DEBUG_SECRET):
                  </label>
                  <input
                    type="password"
                    placeholder="Enter secret key if testing in production..."
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#020617",
                      border: "1px solid #334155",
                      color: "#ffffff",
                      fontSize: "12px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                    Custom Error Message (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Testing Swagger UI Integration Trigger..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#020617",
                      border: "1px solid #334155",
                      color: "#ffffff",
                      fontSize: "12px",
                    }}
                  />
                </div>
                <button
                  onClick={handleQuickExecute}
                  disabled={loading}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "6px",
                    background: "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    opacity: loading ? 0.6 : 1,
                    height: "35px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {loading ? "Triggering..." : "Execute Trigger"}
                </button>
              </div>

              {/* Response output */}
              {responseStatus !== null && (
                <div
                  style={{
                    background: "#020617",
                    borderRadius: "8px",
                    border: "1px solid #1e293b",
                    padding: "12px 16px",
                    marginTop: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px" }}>
                    <span style={{ fontWeight: 700, color: responseStatus >= 200 && responseStatus < 300 ? "#34d399" : "#f87171" }}>
                      HTTP Status: {responseStatus}
                    </span>
                    <span style={{ color: "#64748b" }}>Target: /api/debug/telemetry?mode={selectedMode}</span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: "8px",
                      background: "#090d16",
                      borderRadius: "4px",
                      color: "#a7f3d0",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      maxHeight: "180px",
                      overflow: "auto",
                    }}
                  >
                    {responseBody || "(Empty response)"}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Swagger UI Container */}
      <main style={{ maxWidth: "1440px", margin: "0 auto", padding: "16px 20px 60px" }}>
        {!swaggerReady && !swaggerError && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <div
              style={{
                display: "inline-block",
                width: "36px",
                height: "36px",
                border: "3px solid #cbd5e1",
                borderTopColor: "#4f46e5",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginBottom: "12px",
              }}
            />
            <div style={{ fontSize: "14px", fontWeight: 600 }}>Loading CloudStock Swagger UI & OpenAPI Specification...</div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {swaggerError && (
          <div
            style={{
              padding: "20px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              color: "#991b1b",
              margin: "20px 0",
            }}
          >
            <h4 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700 }}>Unable to render Swagger UI</h4>
            <p style={{ margin: 0, fontSize: "12px" }}>{swaggerError}</p>
          </div>
        )}

        {/* Swagger UI DOM Target */}
        <div id="swagger-ui-container" style={{ minHeight: "600px", borderRadius: "12px", background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }} />
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #e2e8f0", background: "#ffffff", padding: "16px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
        CloudStock &copy; 2026 &bull; Serverless Inventory Architecture on Vercel & Supabase
      </footer>
    </div>
  );
}
