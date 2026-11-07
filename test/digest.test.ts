import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs, sorted, and counts 1 bad line', () => {
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, keeps the latest status and error', () => {
    const row = (job: string) => night?.rows.find((r) => r.job === job);
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('keeps the log offset on times', () => {
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('an empty file is a night where nothing ran', () => {
    writeFileSync(join(dir, '2026-11-01.jsonl'), '');
    expect(readNight(dir, '2026-11-01')).toEqual({ night: '2026-11-01', rows: [], badLines: 0 });
  });

  it('a missing file, or a night that is not a date, is null', () => {
    expect(readNight(dir, '2026-11-02')).toBeNull();
    expect(readNight(dir, '../runs/2026-10-28')).toBeNull();
  });

  it('counts lines that parse but fail validation, never throws', () => {
    writeFileSync(
      join(dir, '2026-11-03.jsonl'),
      [
        '{"at":"2026-11-03T01:00:00-05:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-11-03T01:00:00-05:00","job":"a","status":"maybe","owner":"x"}',
        '[1,2]',
        'null',
        '{"at":"yesterday","job":"a","status":"ok","owner":"x"}',
      ].join('\n'),
    );
    const n = readNight(dir, '2026-11-03');
    expect(n?.badLines).toBe(4);
    expect(n?.rows).toEqual([
      { job: 'a', owner: 'x', runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-11-03T01:00:00-05:00', lastAt: '2026-11-03T01:00:00-05:00' },
    ]);
  });
});
