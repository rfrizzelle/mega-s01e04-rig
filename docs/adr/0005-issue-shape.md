# 0005 · What every issue carries

- Status: accepted · 2026-11-07 · decided by the lane owner (Rod) during plan morning-digest
- Refines: 0002 (work is issues)

## Context

0002 says an issue has its source section, scope, a checkable done condition and what it's blocked
by, but not the exact shape. The `plan-to-issues` skill asks the human for the shape each time
unless it is written down. For morning-digest it lived only in chat and in the issues themselves.

## Decision

Every issue split from a plan has this shape, and nothing more:

- **Title:** the unit of work, short (`Digest page: GET /digest/:night`).
- **Label:** `plan:<plan>`, the `plan:` value in the plan's frontmatter (`plan:morning-digest`).
  The reviewer sorts by it.
- **Body**, in this order:

  ```md
  Source: plan.md § <n>

  ## Scope
  <what the plan section asks, in its own words; the rules that bind it (ADRs, styleguide)>

  ## Done when
  <the plan's "Done when", checkable>

  ## Blocked by
  <#n, #m, or —>
  ```

- **`<n>`** is the plan's own section number. Subsections keep their letter: `§ 2a`, not `§ 2`.
- **Blocked by** cites real issue numbers, so issues are created in dependency order.
- **Waiting issues:** when "Done when" depends on someone else (a reviewer, another team), the issue
  stays open until they have answered. "Sent" is not "reviewed". Leave a comment saying what it waits
  on.
- **Closing:** the closing comment from AGENTS.md (`done` / `worker` / `commit`). Close the issue
  before pushing a commit that says `closes #n`, or GitHub closes it with no comment.

## Consequences

- `plan-to-issues` step 4 doesn't need to ask: this ADR is the written answer. Ask only when a plan
  needs something extra, and record the extra here.
- Issues as files (0004) use the same body.
