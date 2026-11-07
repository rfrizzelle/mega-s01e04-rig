import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

type DigestJson = {
  night: string;
  rows: { job: string }[];
  badLines: number;
};

const JOBS_IN_FILE_ORDER = ['zeta/run', 'alpha/sync', 'mid/build'];
const SORTED_JOBS = ['alpha/sync', 'mid/build', 'zeta/run'];

const line = (at: string, job: string, status: string, owner: string | null = 'rig') =>
  JSON.stringify({ at, job, status, owner });

const GOOD_NIGHT = '2026-01-01';
const EMPTY_NIGHT = '2026-01-02';
const BAD_NIGHT = '2026-01-03';
const MISSING_NIGHT = '2026-01-04';

let runsDir: string;
let config: RigConfig;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(
    join(runsDir, `${GOOD_NIGHT}.jsonl`),
    [
      line('2026-01-01T02:00:00+01:00', 'zeta/run', 'ok'),
      line('2026-01-01T02:10:00+01:00', 'alpha/sync', 'retry'),
      line('2026-01-01T02:20:00+01:00', 'mid/build', 'fail', null),
      line('2026-01-01T02:30:00+01:00', 'alpha/sync', 'ok'),
      '',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, `${EMPTY_NIGHT}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD_NIGHT}.jsonl`),
    [
      line('2026-01-03T02:00:00+01:00', 'beta/job', 'ok'),
      line('2026-01-03T02:05:00+01:00', 'alpha/job', 'retry'),
      '{"at":"2026-01-03T02:1', // truncated last line
    ].join('\n'),
  );
  config = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function app() {
  return createApp({ ...config, runsDir });
}

describe('GET /digest/:night', () => {
  it('returns 200 HTML with every job name of a night that exists', async () => {
    const res = await app().request(`/digest/${GOOD_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    for (const job of JOBS_IN_FILE_ORDER) {
      expect(html).toContain(job);
    }
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request(`/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await app().request(`/digest/${EMPTY_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('still renders 200 with the good rows when a line is bad', async () => {
    const res = await app().request(`/digest/${BAD_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('beta/job');
    expect(html).toContain('alpha/job');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns 200 JSON with night, rows (each with a job) and badLines', async () => {
    const res = await app().request(`/api/digest/${GOOD_NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.night).toBe(GOOD_NIGHT);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows.map((r) => r.job)).toEqual(SORTED_JOBS);
    expect(body.badLines).toBe(0);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request(`/api/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
  });

  it('returns rows [] and badLines 0 for an empty night', async () => {
    const res = await app().request(`/api/digest/${EMPTY_NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body).toEqual({ night: EMPTY_NIGHT, rows: [], badLines: 0 });
  });

  it('returns the good rows and badLines 1 for a night with a bad line', async () => {
    const res = await app().request(`/api/digest/${BAD_NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'beta/job']);
  });
});

describe('page and JSON agree', () => {
  it('lists the job names in the page in the same order as the JSON rows', async () => {
    const page = await app().request(`/digest/${GOOD_NIGHT}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    const json = await app().request(`/api/digest/${GOOD_NIGHT}`);
    expect(json.status).toBe(200);
    const body = (await json.json()) as DigestJson;

    const positions = body.rows.map((r) => html.indexOf(r.job));
    for (const pos of positions) {
      expect(pos).toBeGreaterThanOrEqual(0);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
