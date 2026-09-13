#!/usr/bin/env node

import { run } from "node:test";
import { spec } from "node:test/reporters";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments
const args = process.argv.slice(2);
let selectedTier = null;
let selectedMilestone = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--tier" && args[i + 1]) {
    selectedTier = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--milestone" && args[i + 1]) {
    selectedMilestone = args[i + 1].toUpperCase();
    i++;
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
Usage: node tests/e2e/run-all.mjs [options]

Options:
  --tier <1|2|3|4>            Run only specified test tier
  --milestone <M1|M2|...|M5>  Filter progressive test validation up to milestone
  --help, -h                  Display this help message
`);
    process.exit(0);
  }
}

if (selectedMilestone) {
  process.env.TARGET_MILESTONE = selectedMilestone;
}

// Determine files to run
const allTierFiles = {
  1: path.resolve(__dirname, "tier1-features.test.mjs"),
  2: path.resolve(__dirname, "tier2-boundary.test.mjs"),
  3: path.resolve(__dirname, "tier3-interactions.test.mjs"),
  4: path.resolve(__dirname, "tier4-scenarios.test.mjs"),
};

let filesToRun = [];

if (selectedTier) {
  if (!allTierFiles[selectedTier]) {
    console.error(`Error: Unknown tier ${selectedTier}. Supported tiers: 1, 2, 3, 4.`);
    process.exit(1);
  }
  filesToRun = [allTierFiles[selectedTier]];
} else {
  filesToRun = Object.values(allTierFiles);
}

console.log("===============================================================");
console.log("          E2E OPAQUE-BOX ARCHITECTURAL TEST RUNNER             ");
console.log("===============================================================");
console.log(`Workspace Root:    ${path.resolve(__dirname, "../..")}`);
console.log(`Active Milestone:  ${process.env.TARGET_MILESTONE || "ALL (M5 Target)"}`);
console.log(`Selected Tier:     ${selectedTier ? `Tier ${selectedTier}` : "All Tiers (1 - 4)"}`);
console.log(`Test Files Count:  ${filesToRun.length}`);
console.log("---------------------------------------------------------------\n");

const startTime = Date.now();

const testStream = run({
  files: filesToRun,
  concurrency: false,
});

testStream.compose(spec).pipe(process.stdout);

let hasFailures = false;

testStream.on("test:fail", () => {
  hasFailures = true;
});

testStream.on("end", () => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n---------------------------------------------------------------");
  console.log(`Test Execution Completed in ${elapsed}s`);
  console.log(`Overall Status: ${hasFailures ? "FAILED (Non-zero exit)" : "PASSED (Clean exit)"}`);
  console.log("===============================================================");

  process.exit(hasFailures ? 1 : 0);
});
