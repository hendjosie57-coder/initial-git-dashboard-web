import type { BlameChunk, ImpactMetrics, RepoFile } from "../types";
import { dependentsOf } from "./mockRepo";

/* ---------------------------------------------------------------------------
   Deterministic source-code synthesis.

   For any repo file we can produce:
     · legacy   — the "problematic" callback-era source shown read-only
     · modern   — the AI-suggested refactor shown in the editable pane
     · blame    — contiguous line chunks mapped to real commits/authors

   Each file seeds its own PRNG from its path, so output is stable per file
   regardless of render order.
--------------------------------------------------------------------------- */

function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pascalTopic(file: RepoFile): string {
  const base = file.name
    .replace(/\.(tsx|ts|js)$/, "")
    .replace(/^use/, "")
    .replace(
      /(Controller|Service|Handler|Manager|Builder|Engine|Adapter|Processor|Reconciler|Layer|Loader|Exporter|Router)$/,
      "",
    );
  const cleaned = base.length > 1 ? base : file.name.replace(/\.\w+$/, "");
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

export interface FileCode {
  legacy: string;
  modern: string;
  blame: BlameChunk[];
  legacyLines: number;
  modernLines: number;
}

const codeCache = new Map<string, FileCode>();

export function getFileCode(file: RepoFile): FileCode {
  const cached = codeCache.get(file.id);
  if (cached) return cached;

  const rng = mulberry32(seedFrom(file.path));
  const ri = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const P = pascalTopic(file); // e.g. "Payment"
  const lower = P[0].toLowerCase() + P.slice(1);
  const retryLimit = ri(2, 5);
  const flag = `ENABLE_${P.toUpperCase()}_V2`;
  const magicTimeout = pick(rng, [3000, 5000, 8000, 15000]);

  const legacy = [
    `// ${file.path}`,
    `// NOTE: do not touch without talking to #team-platform (est. 2019)`,
    `/* eslint-disable */`,
    `var db = require('../db/connectionPool');`,
    `var logger = require('../utils/logger');`,
    `var utils = require('../utils/deepMerge');`,
    ``,
    `var RETRY_LIMIT = ${retryLimit};`,
    `var _cache = {}; // FIXME: unbounded, never evicted`,
    `var _inflight = null;`,
    ``,
    `function process${P}(input, opts, callback) {`,
    `  if (typeof opts === 'function') { callback = opts; opts = {}; }`,
    `  if (!input) { return callback(null, null); // swallow bad input`,
    `  }`,
    `  var key = input.id + ':' + (opts.region || 'us-east-1');`,
    `  if (_cache[key]) {`,
    `    return callback(null, _cache[key]);`,
    `  }`,
    `  db.getConnection(function (err, conn) {`,
    `    if (err) {`,
    `      // retry forever-ish, see incident 2021-04`,
    `      return setTimeout(function () {`,
    `        process${P}(input, opts, callback);`,
    `      }, ${magicTimeout});`,
    `    }`,
    `    conn.query('SELECT * FROM ${lower}s WHERE id = ' + input.id, function (err2, rows) {`,
    `      if (err2) { logger.log('ERR', err2); return callback(null, []); }`,
    `      var result = rows[0];`,
    `      if (result && result.status == 'pending') {`,
    `        validate${P}(result, function (err3, ok) {`,
    `          if (err3 || !ok) {`,
    `            if (process.env.${flag}) {`,
    `              // v2 path, half migrated — DO NOT REMOVE`,
    `              result.status = 'needs_review';`,
    `            } else {`,
    `              result.status = 'approved'; // legacy default, yikes`,
    `            }`,
    `          }`,
    `          _cache[key] = result;`,
    `          callback(null, result);`,
    `        });`,
    `      } else {`,
    `        _cache[key] = result;`,
    `        callback(null, result);`,
    `      }`,
    `    });`,
    `  });`,
    `}`,
    ``,
    `function validate${P}(record, callback) {`,
    `  var attempts = 0;`,
    `  function tryOnce() {`,
    `    attempts++;`,
    `    if (attempts > RETRY_LIMIT) { return callback(new Error('gave up')); }`,
    `    if (!record.amount && record.amount !== 0) {`,
    `      record.amount = '0'; // string on purpose?? vendor API quirk`,
    `    }`,
    `    var total = parseFloat(record.amount) + 0.0000001; // float math`,
    `    if (isNaN(total)) { return tryOnce(); }`,
    `    callback(null, total >= 0);`,
    `  }`,
    `  tryOnce();`,
    `}`,
    ``,
    `function sync${P}Records(list, done) {`,
    `  var i = 0, out = [];`,
    `  function next() {`,
    `    if (i >= list.length) { return done(out); } // note: no error arg`,
    `    process${P}(list[i], {}, function (e, r) {`,
    `      out.push(r || {});`,
    `      i++;`,
    `      next();`,
    `    });`,
    `  }`,
    `  next();`,
    `}`,
    ``,
    `module.exports = { process${P}: process${P}, validate${P}: validate${P}, sync${P}Records: sync${P}Records };`,
    ``,
  ].join("\n");

  const modern = [
    `// ${file.path.replace(/\.js$/, ".ts")} — refactored`,
    `import { pool } from "../db/connectionPool";`,
    `import { logger } from "../utils/logger";`,
    `import { withRetry } from "../utils/retry";`,
    ``,
    `export interface ${P}Input {`,
    `  id: string;`,
    `  region?: string;`,
    `}`,
    ``,
    `export interface ${P}Record {`,
    `  id: string;`,
    `  amount: number;`,
    `  status: "pending" | "approved" | "needs_review";`,
    `}`,
    ``,
    `const cache = new Map<string, ${P}Record>();`,
    `const MAX_CACHE = 500;`,
    ``,
    `export async function process${P}(`,
    `  input: ${P}Input,`,
    `): Promise<${P}Record | null> {`,
    `  const key = \`\${input.id}:\${input.region ?? "us-east-1"}\`;`,
    `  const hit = cache.get(key);`,
    `  if (hit) return hit;`,
    ``,
    `  const record = await withRetry(() => fetch${P}(input.id), {`,
    `    attempts: ${retryLimit},`,
    `    backoff: "exponential",`,
    `  });`,
    `  if (!record) return null;`,
    ``,
    `  if (record.status === "pending" && !(await validate${P}(record))) {`,
    `    record.status = "needs_review";`,
    `  }`,
    ``,
    `  if (cache.size >= MAX_CACHE) {`,
    `    cache.delete(cache.keys().next().value!);`,
    `  }`,
    `  cache.set(key, record);`,
    `  return record;`,
    `}`,
    ``,
    `async function fetch${P}(id: string): Promise<${P}Record | null> {`,
    `  const rows = await pool.query<${P}Record>(`,
    `    "SELECT * FROM ${lower}s WHERE id = $1",`,
    `    [id], // parameterized — closes the injection hole`,
    `  );`,
    `  return rows[0] ?? null;`,
    `}`,
    ``,
    `export async function validate${P}(record: ${P}Record): Promise<boolean> {`,
    `  if (!Number.isFinite(record.amount)) {`,
    `    logger.warn("invalid amount", { id: record.id });`,
    `    return false;`,
    `  }`,
    `  return record.amount >= 0;`,
    `}`,
    ``,
    `export async function sync${P}Records(`,
    `  inputs: ${P}Input[],`,
    `): Promise<${P}Record[]> {`,
    `  const results = await Promise.allSettled(inputs.map(process${P}));`,
    `  return results`,
    `    .filter(`,
    `      (r): r is PromiseFulfilledResult<${P}Record> =>`,
    `        r.status === "fulfilled" && r.value !== null,`,
    `    )`,
    `    .map((r) => r.value);`,
    `}`,
    ``,
  ].join("\n");

  const legacyLines = legacy.split("\n").length;

  // Assign contiguous blame chunks by cycling through the file's real commits.
  const blame: BlameChunk[] = [];
  let line = 1;
  let ci = 0;
  while (line <= legacyLines) {
    const size = ri(3, 11);
    const commit = file.commits[ci % file.commits.length];
    blame.push({
      startLine: line,
      endLine: Math.min(line + size - 1, legacyLines),
      commitHash: commit.hash,
      authorId: commit.authorId,
      date: commit.date,
    });
    line += size;
    ci++;
  }

  const result: FileCode = {
    legacy,
    modern,
    blame,
    legacyLines,
    modernLines: modern.split("\n").length,
  };
  codeCache.set(file.id, result);
  return result;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function blameAt(code: FileCode, line: number): BlameChunk | undefined {
  return code.blame.find((b) => line >= b.startLine && line <= b.endLine);
}

/* --- Impact estimation ---------------------------------------------------------- */

export function computeImpact(file: RepoFile): ImpactMetrics {
  const rng = mulberry32(seedFrom(file.path + "::impact"));
  const code = getFileCode(file);
  const reduction = 0.34 + rng() * 0.28; // 34–62% complexity reduction
  const complexityAfter = Math.max(3, Math.round(file.complexity * (1 - reduction)));
  const dependents = dependentsOf(file.id).length;
  const regressionRisk =
    dependents >= 5 || file.coverage < 20
      ? "high"
      : dependents >= 2 || file.coverage < 45
        ? "medium"
        : "low";
  const coverageAfter = Math.min(96, file.coverage + Math.round(14 + rng() * 22));
  return {
    complexityBefore: file.complexity,
    complexityAfter,
    complexityDeltaPct: -Math.round(reduction * 100),
    locBefore: code.legacyLines,
    locAfter: code.modernLines,
    regressionRisk,
    coverageBefore: file.coverage,
    coverageAfter,
    affectedDependents: dependents,
  };
}
