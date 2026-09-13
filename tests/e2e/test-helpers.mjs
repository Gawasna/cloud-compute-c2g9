import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from tests/e2e/
export const ROOT_DIR = path.resolve(__dirname, "../..");

/**
 * Resolve absolute path from project root
 * @param {string} relPath
 * @returns {string}
 */
export function resolvePath(relPath) {
  return path.resolve(ROOT_DIR, relPath);
}

/**
 * Check if path exists
 * @param {string} relPath
 * @returns {boolean}
 */
export function exists(relPath) {
  return fs.existsSync(resolvePath(relPath));
}

/**
 * Check if path is a directory
 * @param {string} relPath
 * @returns {boolean}
 */
export function isDir(relPath) {
  const p = resolvePath(relPath);
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

/**
 * Check if path is a file
 * @param {string} relPath
 * @returns {boolean}
 */
export function isFile(relPath) {
  const p = resolvePath(relPath);
  return fs.existsSync(p) && fs.statSync(p).isFile();
}

/**
 * Read text content of a file
 * @param {string} relPath
 * @returns {string|null}
 */
export function readFile(relPath) {
  const p = resolvePath(relPath);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

/**
 * Read and parse JSON file
 * @param {string} relPath
 * @returns {object|null}
 */
export function readJson(relPath) {
  const content = readFile(relPath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * List files in directory
 * @param {string} relPath
 * @returns {string[]}
 */
export function listDir(relPath) {
  const p = resolvePath(relPath);
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return [];
  return fs.readdirSync(p);
}

/**
 * Get first non-empty, non-comment code line
 * @param {string} content
 * @returns {string|null}
 */
export function getFirstCodeLine(content) {
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (inBlockComment) {
      if (line.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    if (line.startsWith("/*")) {
      if (!line.includes("*/")) {
        inBlockComment = true;
      }
      continue;
    }

    if (line.startsWith("//") || line.startsWith("#")) {
      continue;
    }

    return line;
  }

  return null;
}

export const MILESTONE_ORDER = {
  M1: 1,
  M2: 2,
  M3: 3,
  M4: 4,
  M5: 5,
};

/**
 * Check if the test should be skipped based on TARGET_MILESTONE env
 * @param {object} t - Node.js test context
 * @param {'M1'|'M2'|'M3'|'M4'|'M5'} featureMilestone
 * @returns {boolean} true if skipped
 */
export function checkMilestone(t, featureMilestone) {
  const target = process.env.TARGET_MILESTONE;
  if (!target || target === "all" || target === "M5") {
    return false;
  }

  const targetLevel = MILESTONE_ORDER[target] || 5;
  const featureLevel = MILESTONE_ORDER[featureMilestone] || 1;

  if (featureLevel > targetLevel) {
    if (t && typeof t.skip === "function") {
      t.skip(`Feature scheduled for Milestone ${featureMilestone} (current target: ${target})`);
    }
    return true;
  }

  return false;
}
