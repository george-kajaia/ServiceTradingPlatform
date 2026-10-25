# AdminUI blue redesign - QA report (round 2, after fix-AdminUI-1)
Date: 2026-10-15 · Tester: qa-tester (independent of frontend-engineer) · App source untouched; nothing staged/committed.

## Result
**0 open reproducible redesign/regression bugs in the tested scope.** Dev and production builds pass. Dev browser run 559/559, production browser run 488/488 assertions pass. The 3 round-1 bugs (BUG-1, BUG-2, BUG-3) are verified fixed. This is not a proof that no bug exists.

## Commands and results
| Command | Result |
|---|---|
| `node node_modules/@angular/cli/bin/ng.js build --configuration development --output-path docs/design-blue/qa/_dist/dev` | exit 0 (`qa/build-dev.log`) |
| `node node_modules/@angular/cli/bin/ng.js build --configuration production --output-path docs/design-blue/qa/_dist/prod` | exit 0 (`qa/build-prod.log`) |
| `node docs/design-blue/qa/harness.cjs dev` (ng serve 127.0.0.1:4313, started and disposed by harness) | **559/559 pass**, 0 failed, 0 unexpected console/page errors, 0 remote requests escaped, 57 screenshots |
| `node docs/design-blue/qa/harness.cjs prod docs/design-blue/qa/_dist/prod` (static server) | **488/488 pass**, 0 failed, 0 remote requests escaped, 54 screenshots. 33 "unexpected" console entries are all "Service Worker registration blocked by Playwright" (my `serviceWorkers:'block'`); 0 other |

Console entries marked expected (42 dev) come from deliberately injected 400/409/500 fixtures plus the app's own `console.error(err)`. All service-tokens.com `/api` calls were fulfilled from synthetic fixtures, Google Fonts stubbed, everything else would be aborted and logged (none occurred). Artifacts: `qa/harness.cjs`, `qa/run-*.log`, `results-dev.json`, `results-prod.json`, `screenshots/<dev|prod>/AdminUI_<route>_<width>_<state>.png` (360x800, 768x1024, 1440x1000). Build output sits in `qa/_dist/` (my deletion was denied; safe to delete).

## Harness changes this round (my tooling only)
- Success token expectations updated to the brief's corrected `#166534` (rgb(22,101,52)); old `#15803D` assertions were stale.
- Focus assertion now waits 400 ms for transitions, requires a non-transparent blue ring (>=2px spread), blue border or solid outline.
- Mobile filter-width assertion compares to the parent's real content width (calibration notes), not viewport minus a constant.
- Breakpoint stays <768 mobile (768 toast top-right accepted); no whole-page Tab trap invented.
- New assertions: dialog scroll lock, Shift+Tab trap, focus return after Escape and backdrop close, body scroll restored; empty-body 500 toast fallback for login and company approve.

## States exercised (360 / 768 / 1440)
- Routes: `/`, unknown route, unauthenticated `/dashboard` all go to `/login` (no API calls, no guard - existing behaviour). Home component is not routed, so not browser-testable.
- Login: empty, input focus, loading (900 ms, button disabled), 400 toast, 500 empty-body toast (fallback text), retry success to dashboard.
- Companies: populated, filters (name/tax/status), filter no-results, clear, approve success (PATCH params), 409 and 500 empty-body error toasts, loading, empty, 500 + Retry.
- Requests: populated (Created/Authorised/Approved/None, null names), filters with refetch params, no-results, approve success/409, empty, 500 + Retry, short-data width probe.
- Confirm dialog (dev only; `deleteRequest()` has no button, opened via Angular debug API inside the zone): aria, initial focus, Tab and Shift+Tab trap, Escape, backdrop, Delete request, body scroll lock/restore, focus return to opener, 360px button stacking.
- Computed style: blue/neutral tokens, solid #2563EB primary with white text, radii 8/16, page #F4F7FB, gutters 16/24, no gradients, no purple/pink/cyan or non-semantic green, no text <12px, AA contrast, no clipped labels, no viewport horizontal overflow, controls >=44px (coarse-pointer emulation), tables scroll only within `.table-scroll`, visible keyboard focus.
- Screenshots reviewed: requests 1440 (Approve visible with long data, aligned columns, status labels), confirm dialog 360 (stacked full-width buttons, danger primary).

## Coordinator findings
- **Admin items** (status contrast, Approve reachability at 1440, focus return, button focus ring, empty-error toast): all verified fixed (see above).
- **Investor price hierarchy / token detail status gates**: not applicable to AdminUI (no market cards or token detail); not tested here.
- **Dialog focus/scroll (all apps)**: Admin's only custom dialog is the shared confirm dialog; verified focus entry, Tab/Shift+Tab containment, Escape/backdrop, focus return, scroll lock and restore.
- Company/Service scanner findings: not applicable to AdminUI.

## Bug ledger
| ID | Sev | Route / viewport / state | Expected | Actual | Owner | Status |
|---|---|---|---|---|---|---|
| BUG-1 | Low | Dashboard status badges, all | text >=4.5:1 | was 4.46:1 | frontend-engineer | **Fixed, verified** (`$ok` #166534) |
| BUG-2 | Medium | Requests 1440 | Approve reachable without scroll | was clipped | frontend-engineer | **Fixed, verified** (short and long data at 1440) |
| BUG-3 | Low | Confirm dialog | focus returns to opener | was lost | frontend-engineer | **Fixed, verified** |

No open bugs.

## Observations (outside redesign scope or advisory)
- Desktop table Approve buttons are 36px high (dense-table allowance); 44px under coarse pointer.
- Company Approve has no confirmation; Delete request has no UI trigger (both pre-existing).
- At 360/768 the Requests Actions column requires scrolling inside the table wrapper (permitted by the brief).
- Backend has no authentication and `environment.ts` points at the production URL: pre-existing, out of scope.

## Unverified
Real touch hardware (coarse pointer emulated by rewriting the media query in served local JS/CSS), real Inter font (Google Fonts stubbed), Safari/Firefox, screen readers, reduced motion, dark mode, service worker in prod, confirm dialog against the production build (needs dev-only debug API), unrouted home component, pixel match to the concept (only a direction reference exists).
