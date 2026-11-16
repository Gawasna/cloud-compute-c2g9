import fs from 'fs';
import path from 'path';

function createId() {
  return Math.random().toString(36).substring(2, 10);
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

function syncDiagram(diagMdPath, updaterFn) {
  const content = fs.readFileSync(diagMdPath, 'utf8');
  const jsonMatch = content.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  if (!jsonMatch) {
    throw new Error(`No json block found in ${diagMdPath}`);
  }

  const data = JSON.parse(jsonMatch[1]);
  updaterFn(data);

  // Rebuild Text Elements section
  const textElements = data.elements.filter(e => e.type === 'text' && !e.isDeleted);
  const textElementsSection = textElements
    .map(e => `${e.text} ^${e.id}`)
    .join('\n\n');

  const beforeJson = content.substring(0, jsonMatch.index);
  const afterJson = content.substring(jsonMatch.index + jsonMatch[0].length);

  const textElemHeader = '## Text Elements\n';
  const drawingHeader = '%%\n## Drawing';
  
  let newMdContent = '';
  const textHeaderIdx = beforeJson.indexOf(textElemHeader);
  const drawingHeaderIdx = beforeJson.indexOf(drawingHeader);

  if (textHeaderIdx !== -1 && drawingHeaderIdx !== -1) {
    const prefix = beforeJson.substring(0, textHeaderIdx + textElemHeader.length);
    const suffix = beforeJson.substring(drawingHeaderIdx);
    newMdContent = `${prefix}${textElementsSection}\n\n${suffix}\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`${afterJson}`;
  } else {
    throw new Error(`Unexpected structure in ${diagMdPath}`);
  }

  // Write .excalidraw.md
  fs.writeFileSync(diagMdPath, newMdContent, 'utf8');

  // Also write standalone .excalidraw
  const pureExcalidrawPath = diagMdPath.replace(/\.excalidraw\.md$/, '.excalidraw');
  fs.writeFileSync(pureExcalidrawPath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`Synced ${path.basename(diagMdPath)} & ${path.basename(pureExcalidrawPath)} (total elements: ${data.elements.length})`);
}

// Helper to remove existing callout elements
function removeCalloutElements(data, prefix) {
  data.elements = data.elements.filter(e => !e.id || !e.id.startsWith(prefix));
}

// -------------------------------------------------------------
// D1: Master Infrastructure Map
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D1-master-infrastructure.excalidraw.md', (data) => {
  // Update Next.js App Server text: add 'Route Handlers'
  const nextNode = data.elements.find(e => e.type === 'text' && e.text.includes('Next.js App Server'));
  if (nextNode) {
    const updated = 'Next.js App Server\nNode 22 · JWT Guard · 20 Route Handlers';
    nextNode.text = updated;
    nextNode.originalText = updated;
    nextNode.rawText = updated;
  }

  // Update Supavisor text: add 'TLS Encrypted'
  const supavisorNode = data.elements.find(e => e.type === 'text' && e.text.includes('Supavisor Pooler'));
  if (supavisorNode) {
    const updated = 'Supavisor Pooler\nPort 6543 · Transaction Mode · TLS Encrypted';
    supavisorNode.text = updated;
    supavisorNode.originalText = updated;
    supavisorNode.rawText = updated;
  }

  // Remove and replace callouts with exact spec wording and clean geometry
  removeCalloutElements(data, 'callout_d1_');

  data.elements.push(
    makeRectElem({ id: 'callout_d1_z2_box', x: 270, y: 580, width: 360, height: 42, strokeColor: '#fb923c', backgroundColor: '#1c1917' }),
    makeTextElem({ id: 'callout_d1_z2_txt', x: 280, y: 592, width: 340, height: 18, text: 'Trade-off: Ephemeral In-Memory Rate Limit (Per-Instance Scope)', strokeColor: '#fb923c', fontSize: 11 }),

    makeRectElem({ id: 'callout_d1_z3_box', x: 640, y: 580, width: 350, height: 42, strokeColor: '#f87171', backgroundColor: '#201314' }),
    makeTextElem({ id: 'callout_d1_z3_txt', x: 650, y: 592, width: 330, height: 18, text: 'Trade-off: Shared Micro-Compute · 7-Day Inactivity Auto-Pause Gate', strokeColor: '#f87171', fontSize: 11 }),

    makeRectElem({ id: 'callout_d1_z4_box', x: 1000, y: 580, width: 350, height: 42, strokeColor: '#38bdf8', backgroundColor: '#0c2233' }),
    makeTextElem({ id: 'callout_d1_z4_txt', x: 1010, y: 592, width: 330, height: 18, text: 'Trade-off: Physical SPOF (ISP/Power) · Tailscale DERP Relay Latency', strokeColor: '#38bdf8', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D2: Auth Sequence
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D2-auth-sequence.excalidraw.md', (data) => {
  removeCalloutElements(data, 'callout_d2_');

  // Extend lifelines to y=685 so they terminate cleanly above callouts
  const lifelines = ['line_browser', 'line_edge', 'line_handler', 'line_jwks', 'line_cache', 'line_db'];
  lifelines.forEach(id => {
    const l = data.elements.find(e => e.id === id);
    if (l) l.height = 520;
  });

  // Place callouts cleanly below the lifelines at y=705
  data.elements.push(
    makeRectElem({ id: 'callout_d2_jwks_box', x: 140, y: 705, width: 500, height: 42, strokeColor: '#fb923c', backgroundColor: '#1c1917' }),
    makeTextElem({ id: 'callout_d2_jwks_txt', x: 150, y: 717, width: 480, height: 18, text: '[Cold Start Trade-off: First request fetches Supabase keys via network]', strokeColor: '#fb923c', fontSize: 11 }),

    makeRectElem({ id: 'callout_d2_prof_box', x: 670, y: 705, width: 580, height: 42, strokeColor: '#38bdf8', backgroundColor: '#0c2233' }),
    makeTextElem({ id: 'callout_d2_prof_txt', x: 680, y: 717, width: 560, height: 18, text: '[Zero-Cost Limitation: 30s Max Role Invalidation Lag across ephemeral instances]', strokeColor: '#38bdf8', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D3: ERD Data Model
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D3-erd-data-model.excalidraw.md', (data) => {
  removeCalloutElements(data, 'callout_d3_');

  // Place callout below callout_c3 (y: 550..620) at y=645
  data.elements.push(
    makeRectElem({ id: 'callout_d3_box', x: 180, y: 645, width: 840, height: 42, strokeColor: '#f87171', backgroundColor: '#201314' }),
    makeTextElem({ id: 'callout_d3_txt', x: 200, y: 657, width: 800, height: 18, text: 'Zero-Cost DB Boundary: 500MB Storage Ceiling · Service-Role RBAC Bypass for Query Performance', strokeColor: '#f87171', fontSize: 12 })
  );
});

// -------------------------------------------------------------
// D4: Concurrency Timeline
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D4-concurrency-timeline.excalidraw.md', (data) => {
  removeCalloutElements(data, 'callout_d4_');

  // Expand time_arrow_bg to height 520 (bottom 640) to neatly hold callouts
  const bg = data.elements.find(e => e.id === 'time_arrow_bg');
  if (bg) bg.height = 520;

  data.elements.push(
    makeRectElem({ id: 'callout_d4_bbox', x: 720, y: 535, width: 620, height: 42, strokeColor: '#fb923c', backgroundColor: '#1c1917' }),
    makeTextElem({ id: 'callout_d4_btxt', x: 730, y: 547, width: 600, height: 18, text: 'Zero-Cost Pooler Bottleneck: Blocked transactions hold open connections in Supavisor Transaction Pool', strokeColor: '#fb923c', fontSize: 11 }),

    makeRectElem({ id: 'callout_d4_sumbox', x: 60, y: 535, width: 630, height: 42, strokeColor: '#4ade80', backgroundColor: '#092518' }),
    makeTextElem({ id: 'callout_d4_sumtxt', x: 70, y: 547, width: 610, height: 18, text: 'Architectural Trade-off: Guarantees 100% Zero-Overdraft at the expense of high-throughput concurrency scaling', strokeColor: '#4ade80', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D5: CSV Integrity Pipeline
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D5-csv-integrity-pipeline.excalidraw.md', (data) => {
  removeCalloutElements(data, 'callout_d5_');

  data.elements.push(
    makeRectElem({ id: 'callout_d5_box', x: 250, y: 570, width: 800, height: 42, strokeColor: '#06b6d4', backgroundColor: '#08252c' }),
    makeTextElem({ id: 'callout_d5_txt', x: 260, y: 582, width: 780, height: 18, text: 'Zero-Cost Memory Bounds: In-Memory synchronous streaming (10s execution limit / 10k rows ceiling)', strokeColor: '#06b6d4', fontSize: 12 })
  );
});

// -------------------------------------------------------------
// D6: Trust Boundaries
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D6-trust-boundaries.excalidraw.md', (data) => {
  removeCalloutElements(data, 'callout_d6_');

  // Expand zones height to 540 so bottom is 650
  ['zone_b1', 'zone_b2', 'zone_b3', 'zone_b4', 'zone_b5'].forEach(zid => {
    const z = data.elements.find(e => e.id === zid);
    if (z) z.height = 540;
  });

  data.elements.push(
    makeRectElem({ id: 'callout_d6_b2_box', x: 200, y: 575, width: 560, height: 42, strokeColor: '#fb923c', backgroundColor: '#1c1917' }),
    makeTextElem({ id: 'callout_d6_b2_txt', x: 210, y: 587, width: 540, height: 18, text: 'Zero-Cost Defense Limitation: In-Memory Token Bucket is instance-scoped; WAF lacks dynamic threat intelligence feeds', strokeColor: '#fb923c', fontSize: 10.5 }),

    makeRectElem({ id: 'callout_d6_b4_box', x: 790, y: 575, width: 520, height: 42, strokeColor: '#c084fc', backgroundColor: '#211033' }),
    makeTextElem({ id: 'callout_d6_b4_txt', x: 800, y: 587, width: 500, height: 18, text: 'Security Trade-off: Backend relies on monolithic service_role key to bypass RLS compute tax', strokeColor: '#c084fc', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D7: Telemetry Multiplexing
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D7-telemetry-multiplexing.excalidraw.md', (data) => {
  removeCalloutElements(data, 'callout_d7_');

  // Expand zone_d7_sentry to height 250 (bottom 360) to fit sentry callout neatly
  const zSentry = data.elements.find(e => e.id === 'zone_d7_sentry');
  if (zSentry) zSentry.height = 250;

  // Expand zone_d7_homelab to height 370 (bottom 720) to fit homelab callout
  const zHomelab = data.elements.find(e => e.id === 'zone_d7_homelab');
  if (zHomelab) zHomelab.height = 370;

  data.elements.push(
    makeRectElem({ id: 'callout_d7_sentry_box', x: 780, y: 300, width: 500, height: 42, strokeColor: '#f87171', backgroundColor: '#201314' }),
    makeTextElem({ id: 'callout_d7_sentry_txt', x: 790, y: 312, width: 480, height: 18, text: 'Quota Risk: Fatal loops can exhaust 5k Sentry SaaS quota if not throttled', strokeColor: '#f87171', fontSize: 11 }),

    makeRectElem({ id: 'callout_d7_bug_box', x: 480, y: 645, width: 820, height: 42, strokeColor: '#38bdf8', backgroundColor: '#0c2233' }),
    makeTextElem({ id: 'callout_d7_bug_txt', x: 490, y: 657, width: 800, height: 18, text: 'Zero-Cost Availability Trade-off: Residential homelab is vulnerable to ISP drops; non-fatal logs are dropped during outages', strokeColor: '#38bdf8', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D8: Delivery Pipeline
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D8-delivery-pipeline.excalidraw.md', (data) => {
  removeCalloutElements(data, 'callout_d8_');

  // Expand zone_d8_schema to height 270 (bottom 650) to hold schema callout cleanly
  const zSchema = data.elements.find(e => e.id === 'zone_d8_schema');
  if (zSchema) zSchema.height = 270;

  data.elements.push(
    // Track 1 CI callout placed cleanly in Track 1 next to CodeQL
    makeRectElem({ id: 'callout_d8_ci_box', x: 990, y: 265, width: 390, height: 65, strokeColor: '#06b6d4', backgroundColor: '#08252c' }),
    makeTextElem({ id: 'callout_d8_ci_txt', x: 1000, y: 280, width: 370, height: 35, text: 'Zero-Cost CI Ceiling: 2,000 monthly runner minutes\nbudget; enforces lean parallel test suites', strokeColor: '#06b6d4', fontSize: 11 }),

    // Track 2 Schema evolution callout placed cleanly below the 3 phases
    makeRectElem({ id: 'callout_d8_db_box', x: 350, y: 585, width: 700, height: 42, strokeColor: '#a855f7', backgroundColor: '#1f1033' }),
    makeTextElem({ id: 'callout_d8_db_txt', x: 360, y: 597, width: 680, height: 18, text: 'Database Migration Constraint: Throttled batch backfill required due to single shared CPU on Supabase Free', strokeColor: '#a855f7', fontSize: 11 })
  );
});

// -------------------------------------------------------------
// D9: Availability & Heartbeat
// -------------------------------------------------------------
syncDiagram('specs/diagrams/D9-availability-heartbeat.excalidraw.md', (data) => {
  removeCalloutElements(data, 'callout_d9_');

  // Expand zone_d9_ops, zone_d9_cloud, zone_d9_transparency to height 450 (bottom 660)
  ['zone_d9_ops', 'zone_d9_cloud', 'zone_d9_transparency'].forEach(zid => {
    const z = data.elements.find(e => e.id === zid);
    if (z) z.height = 450;
  });

  data.elements.push(
    makeRectElem({ id: 'callout_d9_hl_box', x: 65, y: 585, width: 440, height: 48, strokeColor: '#f97316', backgroundColor: '#261208' }),
    makeTextElem({ id: 'callout_d9_hl_txt', x: 75, y: 595, width: 420, height: 28, text: 'Homelab Physical Outage Risk: ISP/Power loss stops\npulse; mitigated by Monitor 2', strokeColor: '#f97316', fontSize: 11 }),

    makeRectElem({ id: 'callout_d9_cr_box', x: 965, y: 580, width: 400, height: 60, strokeColor: '#10b981', backgroundColor: '#072418' }),
    makeTextElem({ id: 'callout_d9_cr_txt', x: 975, y: 588, width: 380, height: 44, text: 'Zero-Cost Scheduler Trade-off: GitHub Cron has queue\njitter (15-60m delay), suitable for 7-day keepalive,\nnot sub-minute alerting', strokeColor: '#10b981', fontSize: 10.5 })
  );
});

console.log("\nAll D1-D9 diagrams updated and synchronized successfully!");
