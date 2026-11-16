import fs from 'fs';
import path from 'path';

function createId() {
  return Math.random().toString(36).substring(2, 10);
}

function updateExcalidrawFile(filePath, addElementsCallback) {
  const content = fs.readFileSync(filePath, 'utf8');
  const jsonMatch = content.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  if (!jsonMatch) {
    throw new Error(`No json block found in ${filePath}`);
  }

  const data = JSON.parse(jsonMatch[1]);
  addElementsCallback(data);

  // Rebuild Text Elements section
  const textElements = data.elements.filter(e => e.type === 'text' && !e.isDeleted);
  const textElementsSection = textElements
    .map(e => `${e.text} ^${e.id}`)
    .join('\n\n');

  const beforeJson = content.substring(0, jsonMatch.index);
  const afterJson = content.substring(jsonMatch.index + jsonMatch[0].length);

  // Replace Text Elements block before Drawing
  const textElemHeader = '## Text Elements\n';
  const drawingHeader = '%%\n## Drawing';
  
  let newContent = '';
  const textHeaderIdx = beforeJson.indexOf(textElemHeader);
  const drawingHeaderIdx = beforeJson.indexOf(drawingHeader);

  if (textHeaderIdx !== -1 && drawingHeaderIdx !== -1) {
    const prefix = beforeJson.substring(0, textHeaderIdx + textElemHeader.length);
    const suffix = beforeJson.substring(drawingHeaderIdx);
    newContent = `${prefix}${textElementsSection}\n\n${suffix}\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`${afterJson}`;
  } else {
    throw new Error(`Unexpected structure in ${filePath}`);
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Updated ${path.basename(filePath)} with ${data.elements.length} elements.`);
}

function makeTextElem({ id, x, y, width, height, text, strokeColor = '#fb923c', fontSize = 12 }) {
  return {
    id: id || createId(),
    type: 'text',
    x,
    y,
    width,
    height,
    angle: 0,
    autoResize: true,
    backgroundColor: 'transparent',
    boundElements: null,
    containerId: null,
    fillStyle: 'solid',
    fontFamily: 1,
    fontSize,
    frameId: null,
    groupIds: [],
    index: 'b' + createId(),
    isDeleted: false,
    lineHeight: 1.25,
    link: null,
    locked: false,
    opacity: 100,
    originalText: text,
    rawText: text,
    roughness: 0,
    roundness: null,
    seed: Math.floor(Math.random() * 2000000000),
    strokeColor,
    strokeStyle: 'solid',
    strokeWidth: 1,
    text,
    textAlign: 'center',
    updated: Date.now(),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2000000000),
    verticalAlign: 'middle'
  };
}

function makeRectElem({ id, x, y, width, height, strokeColor = '#fb923c', backgroundColor = '#161b22', strokeStyle = 'dashed' }) {
  return {
    id: id || createId(),
    type: 'rectangle',
    x,
    y,
    width,
    height,
    angle: 0,
    backgroundColor,
    boundElements: null,
    fillStyle: 'solid',
    frameId: null,
    groupIds: [],
    index: 'a' + createId(),
    isDeleted: false,
    link: null,
    locked: false,
    opacity: 100,
    roughness: 0,
    roundness: { type: 3 },
    seed: Math.floor(Math.random() * 2000000000),
    strokeColor,
    strokeStyle,
    strokeWidth: 1,
    updated: Date.now(),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2000000000)
  };
}

// -------------------------------------------------------------
// D1: Master Infrastructure
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D1-master-infrastructure.excalidraw.md', (data) => {
  // Callout Zone 2 (Vercel)
  const z2BoxId = 'callout_d1_z2_box';
  const z2TextId = 'callout_d1_z2_txt';
  data.elements.push(
    makeRectElem({ id: z2BoxId, x: 280, y: 580, width: 340, height: 42, strokeColor: '#fb923c', backgroundColor: '#1c1917' }),
    makeTextElem({ id: z2TextId, x: 290, y: 592, width: 320, height: 18, text: '0$ Trade-off: Ephemeral In-Memory Rate Limit · Per-Instance Quota', strokeColor: '#fb923c', fontSize: 11 })
  );

  // Callout Zone 3 (Supabase)
  const z3BoxId = 'callout_d1_z3_box';
  const z3TextId = 'callout_d1_z3_txt';
  data.elements.push(
    makeRectElem({ id: z3BoxId, x: 640, y: 580, width: 340, height: 42, strokeColor: '#f87171', backgroundColor: '#201314' }),
    makeTextElem({ id: z3TextId, x: 650, y: 592, width: 320, height: 18, text: '0$ Boundary: Shared Micro-Compute · 7-Day Inactivity Auto-Pause Gate', strokeColor: '#f87171', fontSize: 11 })
  );

  // Callout Zone 4 (Homelab)
  const z4BoxId = 'callout_d1_z4_box';
  const z4TextId = 'callout_d1_z4_txt';
  data.elements.push(
    makeRectElem({ id: z4BoxId, x: 1000, y: 580, width: 350, height: 42, strokeColor: '#38bdf8', backgroundColor: '#0c2233' }),
    makeTextElem({ id: z4TextId, x: 1010, y: 592, width: 330, height: 18, text: '0$ Trade-off: Physical Homelab SPOF · Relay Latency via Tailscale Funnel', strokeColor: '#38bdf8', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D2: Auth Sequence
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D2-auth-sequence.excalidraw.md', (data) => {
  const d2JwksBox = 'callout_d2_jwks_box';
  const d2JwksTxt = 'callout_d2_jwks_txt';
  data.elements.push(
    makeRectElem({ id: d2JwksBox, x: 200, y: 590, width: 440, height: 38, strokeColor: '#fb923c', backgroundColor: '#1c1917' }),
    makeTextElem({ id: d2JwksTxt, x: 210, y: 600, width: 420, height: 18, text: 'Cold Start Trade-off: First request fetches Supabase keys via network', strokeColor: '#fb923c', fontSize: 11 })
  );

  const d2ProfBox = 'callout_d2_prof_box';
  const d2ProfTxt = 'callout_d2_prof_txt';
  data.elements.push(
    makeRectElem({ id: d2ProfBox, x: 680, y: 590, width: 440, height: 38, strokeColor: '#38bdf8', backgroundColor: '#0c2233' }),
    makeTextElem({ id: d2ProfTxt, x: 690, y: 600, width: 420, height: 18, text: 'Zero-Cost Gap: 30s Max Role Invalidation Lag across instances', strokeColor: '#38bdf8', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D3: ERD Data Model
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D3-erd-data-model.excalidraw.md', (data) => {
  const d3Box = 'callout_d3_box';
  const d3Txt = 'callout_d3_txt';
  data.elements.push(
    makeRectElem({ id: d3Box, x: 180, y: 560, width: 840, height: 42, strokeColor: '#f87171', backgroundColor: '#201314' }),
    makeTextElem({ id: d3Txt, x: 200, y: 572, width: 800, height: 18, text: 'Zero-Cost DB Boundary: 500MB Storage Ceiling · Service-Role RBAC Bypass for Query Performance', strokeColor: '#f87171', fontSize: 12 })
  );
});

// -------------------------------------------------------------
// D4: Concurrency Timeline
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D4-concurrency-timeline.excalidraw.md', (data) => {
  const d4BBox = 'callout_d4_bbox';
  const d4BTxt = 'callout_d4_btxt';
  data.elements.push(
    makeRectElem({ id: d4BBox, x: 740, y: 520, width: 550, height: 38, strokeColor: '#fb923c', backgroundColor: '#1c1917' }),
    makeTextElem({ id: d4BTxt, x: 750, y: 530, width: 530, height: 18, text: 'Zero-Cost Pooler Bottleneck: Blocked transactions hold open connections in Supavisor', strokeColor: '#fb923c', fontSize: 11 })
  );

  const d4SumBox = 'callout_d4_sumbox';
  const d4SumTxt = 'callout_d4_sumtxt';
  data.elements.push(
    makeRectElem({ id: d4SumBox, x: 100, y: 520, width: 600, height: 38, strokeColor: '#4ade80', backgroundColor: '#092518' }),
    makeTextElem({ id: d4SumTxt, x: 110, y: 530, width: 580, height: 18, text: 'Architectural Trade-off: Guarantees 100% Zero-Overdraft at expense of concurrency scaling', strokeColor: '#4ade80', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D5: CSV Integrity Pipeline
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D5-csv-integrity-pipeline.excalidraw.md', (data) => {
  const d5Box = 'callout_d5_box';
  const d5Txt = 'callout_d5_txt';
  data.elements.push(
    makeRectElem({ id: d5Box, x: 250, y: 570, width: 800, height: 42, strokeColor: '#06b6d4', backgroundColor: '#08252c' }),
    makeTextElem({ id: d5Txt, x: 260, y: 582, width: 780, height: 18, text: 'Zero-Cost Memory Bounds: In-Memory synchronous streaming (10s execution limit / 10k rows ceiling)', strokeColor: '#06b6d4', fontSize: 12 })
  );
});

// -------------------------------------------------------------
// D6: Trust Boundaries
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D6-trust-boundaries.excalidraw.md', (data) => {
  const d6B2Box = 'callout_d6_b2_box';
  const d6B2Txt = 'callout_d6_b2_txt';
  data.elements.push(
    makeRectElem({ id: d6B2Box, x: 260, y: 570, width: 480, height: 42, strokeColor: '#fb923c', backgroundColor: '#1c1917' }),
    makeTextElem({ id: d6B2Txt, x: 270, y: 582, width: 460, height: 18, text: 'Zero-Cost Defense Limitation: Token Bucket is instance-scoped; WAF lacks dynamic threat feeds', strokeColor: '#fb923c', fontSize: 11 })
  );

  const d6B4Box = 'callout_d6_b4_box';
  const d6B4Txt = 'callout_d6_b4_txt';
  data.elements.push(
    makeRectElem({ id: d6B4Box, x: 780, y: 570, width: 500, height: 42, strokeColor: '#c084fc', backgroundColor: '#211033' }),
    makeTextElem({ id: d6B4Txt, x: 790, y: 582, width: 480, height: 18, text: 'Security Trade-off: Backend relies on monolithic service_role key to bypass RLS compute tax', strokeColor: '#c084fc', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D7: Telemetry Multiplexing
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D7-telemetry-multiplexing.excalidraw.md', (data) => {
  const d7SentryBox = 'callout_d7_sentry_box';
  const d7SentryTxt = 'callout_d7_sentry_txt';
  data.elements.push(
    makeRectElem({ id: d7SentryBox, x: 800, y: 150, width: 480, height: 38, strokeColor: '#f87171', backgroundColor: '#201314' }),
    makeTextElem({ id: d7SentryTxt, x: 810, y: 160, width: 460, height: 18, text: 'Quota Risk: Fatal loop can exhaust 5k Sentry SaaS monthly quota if not throttled', strokeColor: '#f87171', fontSize: 11 })
  );

  const d7BugBox = 'callout_d7_bug_box';
  const d7BugTxt = 'callout_d7_bug_txt';
  data.elements.push(
    makeRectElem({ id: d7BugBox, x: 260, y: 570, width: 800, height: 42, strokeColor: '#38bdf8', backgroundColor: '#0c2233' }),
    makeTextElem({ id: d7BugTxt, x: 270, y: 582, width: 780, height: 18, text: 'Zero-Cost Availability Trade-off: Residential homelab vulnerable to ISP drops; non-fatal logs dropped during outages', strokeColor: '#38bdf8', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D8: Delivery Pipeline
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D8-delivery-pipeline.excalidraw.md', (data) => {
  const d8CiBox = 'callout_d8_ci_box';
  const d8CiTxt = 'callout_d8_ci_txt';
  data.elements.push(
    makeRectElem({ id: d8CiBox, x: 100, y: 560, width: 550, height: 42, strokeColor: '#06b6d4', backgroundColor: '#08252c' }),
    makeTextElem({ id: d8CiTxt, x: 110, y: 572, width: 530, height: 18, text: 'Zero-Cost CI Ceiling: 2,000 monthly runner minutes budget; enforces lean parallel test suites', strokeColor: '#06b6d4', fontSize: 11 })
  );

  const d8DbBox = 'callout_d8_db_box';
  const d8DbTxt = 'callout_d8_db_txt';
  data.elements.push(
    makeRectElem({ id: d8DbBox, x: 700, y: 560, width: 580, height: 42, strokeColor: '#a855f7', backgroundColor: '#1f1033' }),
    makeTextElem({ id: d8DbTxt, x: 710, y: 572, width: 560, height: 18, text: 'Database Migration Constraint: Throttled batch backfill required due to single shared CPU on Supabase Free', strokeColor: '#a855f7', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D9: Availability & Heartbeat
// -------------------------------------------------------------
updateExcalidrawFile('specs/diagrams/D9-availability-heartbeat.excalidraw.md', (data) => {
  const d9HlBox = 'callout_d9_hl_box';
  const d9HlTxt = 'callout_d9_hl_txt';
  data.elements.push(
    makeRectElem({ id: d9HlBox, x: 60, y: 520, width: 580, height: 42, strokeColor: '#f97316', backgroundColor: '#261208' }),
    makeTextElem({ id: d9HlTxt, x: 70, y: 532, width: 560, height: 18, text: 'Homelab Physical Outage Risk: ISP/Power loss stops pulse; mitigated by Cloud Cron', strokeColor: '#f97316', fontSize: 11 })
  );

  const d9CrBox = 'callout_d9_cr_box';
  const d9CrTxt = 'callout_d9_cr_txt';
  data.elements.push(
    makeRectElem({ id: d9CrBox, x: 680, y: 520, width: 620, height: 42, strokeColor: '#10b981', backgroundColor: '#072418' }),
    makeTextElem({ id: d9CrTxt, x: 690, y: 532, width: 600, height: 18, text: 'Zero-Cost Scheduler Trade-off: GitHub Cron has queue jitter (15-60m delay), suitable for 7-day keepalive, not sub-minute alerting', strokeColor: '#10b981', fontSize: 11 })
  );
});
