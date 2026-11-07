import type { NightDigest } from '../digest/types.js';

const dash = '—';

export function Digest({ digest }: { digest: NightDigest }) {
  const { night, rows, badLines } = digest;
  return (
    <>
      <h1>digest {night}</h1>
      {badLines > 0 && (
        <p class="warn">
          ⚠ {badLines} {badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      )}
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const manyRetries = r.retries >= 3;
              const failed = r.lastStatus === 'fail';
              return (
                <tr class={manyRetries || failed ? 'warn' : undefined}>
                  <td>{r.job}</td>
                  <td>{r.owner ?? dash}</td>
                  <td>{r.runs}</td>
                  <td>{manyRetries ? `⚠ ${r.retries} (retries ≥3)` : r.retries}</td>
                  <td>{failed ? `⚠ ${r.lastStatus}` : r.lastStatus}</td>
                  <td>{r.lastError ?? dash}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
