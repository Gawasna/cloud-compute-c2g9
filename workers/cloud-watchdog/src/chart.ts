import type { TelemetryPoint } from "./dms.ts";

/**
 * Generates a Unicode sparkline string from a numeric array.
 * Values are scaled across 8 Unicode block heights ( ▂▃▄▅▆▇█).
 */
export function generateSparkline(values: number[]): string {
  if (!values || values.length === 0) {
    return "N/A";
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const ticks = [" ", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

  if (range === 0) {
    return ticks[3].repeat(values.length);
  }

  return values
    .map((v) => {
      const normalized = (v - min) / range;
      const index = Math.min(Math.floor(normalized * (ticks.length - 1)), ticks.length - 1);
      return ticks[index];
    })
    .join("");
}

export interface TelemetrySummary {
  cloudLatencySpark: string;
  hpLoadSpark: string;
  avgCloudLatency: number;
  maxCloudLatency: number;
  avgHpLoad: number;
  pointCount: number;
}

/**
 * Computes sparklines and summary metrics from the telemetry ring buffer.
 */
export function summarizeTelemetry(buffer: TelemetryPoint[]): TelemetrySummary {
  const cloudLatencies = buffer
    .map((p) => p.cloud_duration_ms)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  const hpLoads = buffer
    .map((p) => p.hp_load)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  const avgCloudLatency = cloudLatencies.length
    ? Math.round(cloudLatencies.reduce((a, b) => a + b, 0) / cloudLatencies.length)
    : 0;
  const maxCloudLatency = cloudLatencies.length ? Math.max(...cloudLatencies) : 0;

  const avgHpLoad = hpLoads.length
    ? Number((hpLoads.reduce((a, b) => a + b, 0) / hpLoads.length).toFixed(2))
    : 0;

  return {
    cloudLatencySpark: generateSparkline(cloudLatencies),
    hpLoadSpark: generateSparkline(hpLoads),
    avgCloudLatency,
    maxCloudLatency,
    avgHpLoad,
    pointCount: buffer.length,
  };
}

/**
 * Constructs a QuickChart.io image URL rendering a dual-axis line chart
 * for Cloud Response Latency (ms) and On-Premise Load Avg.
 */
export function generateQuickChartUrl(buffer: TelemetryPoint[]): string {
  if (!buffer || buffer.length === 0) {
    return "";
  }

  // Sample or take last 24 points to keep URL concise
  const points = buffer.slice(-24);
  const labels = points.map((p) => {
    const d = new Date(p.ts * 1000);
    const hh = String(d.getUTCHours() + 7).padStart(2, "0"); // GMT+7
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  });

  const cloudData = points.map((p) => p.cloud_duration_ms ?? null);
  const hpData = points.map((p) => p.hp_load ?? null);

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cloud Latency (ms)",
          data: cloudData,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          yAxisID: "y",
          fill: true,
          tension: 0.3,
        },
        {
          label: "HP Load Avg",
          data: hpData,
          borderColor: "#4ade80",
          backgroundColor: "transparent",
          yAxisID: "y1",
          borderDash: [5, 5],
          tension: 0.3,
        },
      ],
    },
    options: {
      title: {
        display: true,
        text: "CloudStock Infrastructure Telemetry (GMT+7)",
        fontColor: "#ffffff",
      },
      legend: {
        labels: { fontColor: "#cbd5e1" },
      },
      scales: {
        xAxes: [{ ticks: { fontColor: "#94a3b8" }, gridLines: { color: "rgba(255,255,255,0.05)" } }],
        yAxes: [
          {
            id: "y",
            position: "left",
            scaleLabel: { display: true, labelString: "Latency (ms)", fontColor: "#38bdf8" },
            ticks: { fontColor: "#38bdf8" },
            gridLines: { color: "rgba(255,255,255,0.05)" },
          },
          {
            id: "y1",
            position: "right",
            scaleLabel: { display: true, labelString: "Load Avg", fontColor: "#4ade80" },
            ticks: { fontColor: "#4ade80" },
            gridLines: { display: false },
          },
        ],
      },
    },
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?bkg=%230f172a&w=600&h=300&c=${encodedConfig}`;
}

/**
 * Generates a QuickChart URL specialized for Uptime Kuma monitors ping latency.
 */
export function generateKumaChartUrl(points: TelemetryPoint[]): string {
  if (points.length === 0) {
    return "https://quickchart.io/chart?bkg=%230f172a&w=600&h=300&c=%7B%22type%22%3A%22line%22%2C%22data%22%3A%7B%22labels%22%3A%5B%5D%2C%22datasets%22%3A%5B%5D%7D%2C%22options%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22No+Kuma+Data+Available%22%2C%22fontColor%22%3A%22%23ffffff%22%7D%7D%7D";
  }

  const labels = points.map((p) => {
    const d = new Date(p.ts * 1000);
    const hh = String(d.getUTCHours() + 7).padStart(2, "0"); // GMT+7
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  });

  const supabaseData = points.map((p) => p.kuma_supabase_ping_ms ?? null);
  const vercelData = points.map((p) => p.kuma_vercel_ping_ms ?? null);
  const uplinkData = points.map((p) => p.kuma_uplink_ping_ms ?? null);

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Supabase DB (ms)",
          data: supabaseData,
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.1)",
          fill: false,
          tension: 0.3,
        },
        {
          label: "Vercel API (ms)",
          data: vercelData,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          fill: false,
          tension: 0.3,
        },
        {
          label: "Internet Uplink (ms)",
          data: uplinkData,
          borderColor: "#4ade80",
          backgroundColor: "rgba(74, 222, 128, 0.1)",
          fill: false,
          tension: 0.3,
        },
      ],
    },
    options: {
      title: {
        display: true,
        text: "Uptime Kuma On-Premise Ping Latency (GMT+7)",
        fontColor: "#ffffff",
      },
      legend: {
        labels: { fontColor: "#cbd5e1" },
      },
      scales: {
        xAxes: [{ ticks: { fontColor: "#94a3b8" }, gridLines: { color: "rgba(255,255,255,0.05)" } }],
        yAxes: [
          {
            scaleLabel: { display: true, labelString: "Latency (ms)", fontColor: "#cbd5e1" },
            ticks: { fontColor: "#cbd5e1", beginAtZero: true },
            gridLines: { color: "rgba(255,255,255,0.05)" },
          },
        ],
      },
    },
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?bkg=%230f172a&w=600&h=300&c=${encodedConfig}`;
}
