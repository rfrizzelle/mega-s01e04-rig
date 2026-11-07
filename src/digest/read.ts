import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
// ISO 8601 date-time with an explicit offset (or Z); the string itself is what we keep.
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

// Parse one line at the edge. null = bad line. A missing `owner` reads as null;
// `error` must be a string when present (null is treated as absent).
export function parseLine(raw: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner = null, error = null } = o;
  if (typeof at !== 'string' || !AT.test(at) || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== null && typeof error !== 'string') return null;
  return error === null ? { at, job, status, owner } : { at, job, status, owner, error };
}

export function digest(night: string, text: string): NightDigest {
  const lines: { line: RunLine; t: number; i: number }[] = [];
  let badLines = 0;
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === '') return; // blank lines (e.g. the trailing newline) are not lines
    const line = parseLine(raw);
    if (line) lines.push({ line, t: Date.parse(line.at), i });
    else badLines++;
  });
  // By instant, then file order: offsets may differ between lines.
  lines.sort((a, b) => a.t - b.t || a.i - b.i);

  const byJob = new Map<string, DigestRow>();
  for (const { line } of lines) {
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.owner = line.owner;
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    if (line.error !== undefined) row.lastError = line.error;
    row.lastAt = line.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return null;
    throw e;
  }
  return digest(night, text);
};
