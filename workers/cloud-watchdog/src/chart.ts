import type { TelemetryPoint, KumaSeriesPoint } from "./dms.ts";

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
 * Constructs a QuickChart.io image URL rendering Cloud Performance:
 * Total API Latency (ms) vs Supabase DB Query Latency (ms).
 */
export function generateCloudChartUrl(buffer: TelemetryPoint[]): string {
  if (!buffer || buffer.length === 0) {
    return "";
  }

  // Filter points that contain cloud telemetry
  const cloudPoints = buffer.filter((p) => p.cloud_duration_ms !== undefined).slice(-24);
  if (cloudPoints.length === 0) {
    return "";
  }

  const labels = cloudPoints.map((p) => {
    const d = new Date(p.ts * 1000);
    const hh = String(d.getUTCHours() + 7).padStart(2, "0"); // GMT+7
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  });

  const totalLatency = cloudPoints.map((p) => p.cloud_duration_ms ?? null);
  const dbLatency = cloudPoints.map((p) => p.db_latency_ms ?? null);

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total Edge Latency (ms)",
          data: totalLatency,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.08)",
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
        {
          label: "Supabase DB Query (ms)",
          data: dbLatency,
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.08)",
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      title: {
        display: true,
        text: "Cloud Latency Breakdown: Vercel Edge vs Supabase DB (GMT+7)",
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
  return `https://quickchart.io/chart?bkg=%230f172a&w=650&h=320&c=${encodedConfig}`;
}

/**
 * Constructs a QuickChart.io image URL rendering On-Premise Node Hardware:
 * CPU Load Average vs RAM Usage (MB).
 */
export function generateNodeChartUrl(buffer: TelemetryPoint[], totalRamMb = 7712): string {
  if (!buffer || buffer.length === 0) {
    return "";
  }

  // Filter points that contain on-premise hardware telemetry
  const hpPoints = buffer.filter((p) => p.hp_load !== undefined || p.hp_mem_mb !== undefined).slice(-24);
  if (hpPoints.length === 0) {
    return "";
  }

  const labels = hpPoints.map((p) => {
    const d = new Date(p.ts * 1000);
    const hh = String(d.getUTCHours() + 7).padStart(2, "0"); // GMT+7
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  });

  const loadData = hpPoints.map((p) => p.hp_load ?? null);
  const memData = hpPoints.map((p) => p.hp_mem_mb ?? null);

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "CPU Load Avg",
          data: loadData,
          borderColor: "#4ade80",
          backgroundColor: "rgba(74, 222, 128, 0.08)",
          yAxisID: "y",
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
        {
          label: "RAM Used (MB)",
          data: memData,
          borderColor: "#a855f7",
          backgroundColor: "transparent",
          yAxisID: "y1",
          borderDash: [4, 4],
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      title: {
        display: true,
        text: `HP EliteDesk Node Hardware Resources (Total RAM: ${totalRamMb}MB)`,
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
            scaleLabel: { display: true, labelString: "CPU Load Avg", fontColor: "#4ade80" },
            ticks: { fontColor: "#4ade80", beginAtZero: true },
            gridLines: { color: "rgba(255,255,255,0.05)" },
          },
          {
            id: "y1",
            position: "right",
            scaleLabel: { display: true, labelString: "RAM (MB)", fontColor: "#a855f7" },
            ticks: { fontColor: "#a855f7", beginAtZero: true, suggestedMax: totalRamMb },
            gridLines: { display: false },
          },
        ],
      },
    },
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?bkg=%230f172a&w=650&h=320&c=${encodedConfig}`;
}

/**
 * Backward compatibility alias for generateCloudChartUrl.
 */
export function generateQuickChartUrl(buffer: TelemetryPoint[]): string {
  return generateCloudChartUrl(buffer);
}

/**
 * Generates a QuickChart URL specialized for Uptime Kuma monitors ping latency.
 * Accepts either an explicit Kuma 8-hour time series or fallback points from ring buffer.
 */
export function generateKumaChartUrl(
  series?: KumaSeriesPoint[],
  fallbackPoints?: TelemetryPoint[]
): string {
  // 1. If explicit Kuma 8-hour series is available (>= 2 points)
  if (series && series.length >= 2) {
    const labels = series.map((s) => s.time);
    const supabaseData = series.map((s) => s.supabase_ping ?? null);
    const vercelHealthData = series.map((s) => s.vercel_health_ping ?? null);
    const vercelFrontData = series.map((s) => s.vercel_front_ping ?? null);
    const uplinkData = series.map((s) => s.uplink_ping ?? null);

    const chartConfig = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Supabase DB (ms)",
            data: supabaseData,
            borderColor: "#f97316",
            backgroundColor: "transparent",
            fill: false,
            tension: 0.25,
            pointRadius: 2,
            spanGaps: true,
          },
          {
            label: "Vercel Health (ms)",
            data: vercelHealthData,
            borderColor: "#38bdf8",
            backgroundColor: "transparent",
            fill: false,
            tension: 0.25,
            pointRadius: 2,
            spanGaps: true,
          },
          {
            label: "Vercel Front (ms)",
            data: vercelFrontData,
            borderColor: "#a855f7",
            backgroundColor: "transparent",
            fill: false,
            tension: 0.25,
            pointRadius: 2,
            spanGaps: true,
          },
          {
            label: "Uplink 1.1.1.1 (ms)",
            data: uplinkData,
            borderColor: "#4ade80",
            backgroundColor: "transparent",
            fill: false,
            tension: 0.25,
            pointRadius: 2,
            spanGaps: true,
          },
        ],
      },
      options: {
        title: {
          display: true,
          text: "Uptime Kuma 8-Hour Monitor Latency (On-Premise HP)",
          fontColor: "#ffffff",
        },
        legend: {
          labels: { fontColor: "#cbd5e1", boxWidth: 12 },
        },
        scales: {
          xAxes: [{ ticks: { fontColor: "#94a3b8", autoSkip: true, maxTicksLimit: 10 }, gridLines: { color: "rgba(255,255,255,0.05)" } }],
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
    return `https://quickchart.io/chart?bkg=%230f172a&w=650&h=320&c=${encodedConfig}`;
  }

  // 2. Fallback to ring buffer telemetry points
  const points = fallbackPoints || [];
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

  const fallbackConfig = {
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

  const encodedFallback = encodeURIComponent(JSON.stringify(fallbackConfig));
  return `https://quickchart.io/chart?bkg=%230f172a&w=600&h=300&c=${encodedFallback}`;
}
