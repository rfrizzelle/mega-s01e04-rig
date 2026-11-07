// Run log reader contract (plan.md § 1). Section 2 builds against this file only.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after validation.
export type RunLine = {
  at: string; // ISO 8601 with the log's own offset, kept verbatim
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job in a night.
//
// Ordering: "first", "last" and "latest" are by the instant `at` denotes; lines with the same
// instant keep their file order. Times are the log's strings, unchanged: never converted to UTC.
export type DigestRow = {
  job: string;
  owner: string | null; // from the latest line; null stays null (views render "—")
  runs: number; // number of valid lines for this job
  retries: number; // number of lines with status "retry"
  lastStatus: RunStatus; // status of the latest line
  lastError: string | null; // most recent error seen for this job (any line), else null
  firstAt: string; // `at` of the earliest line
  lastAt: string; // `at` of the latest line
};

export type NightDigest = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; empty when the file is empty ("nothing ran")
  badLines: number; // non-blank lines that did not parse or failed validation
};

// Returns null when there is no runs/<night>.jsonl (or `night` is not YYYY-MM-DD): the page 404s.
// Never throws on bad lines; they are counted in `badLines`.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
