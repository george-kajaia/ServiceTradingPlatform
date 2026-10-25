# CompanyUI blue redesign – QA report (2026-10-15)

Tester: qa-tester (independent of frontend-engineer). No app code, settings or dependencies touched; nothing staged/committed/pushed/deployed.

## Commands and results
| Command | Result |
|---|---|
| `node node_modules/@angular/cli/bin/ng.js build --configuration development` | PASS (main 463.6 kB) |
| `node node_modules/@angular/cli/bin/ng.js build --configuration production` | PASS (initial 529 kB) |
| `node docs/design-blue/qa/harness.cjs dev` (ng serve on 127.0.0.1:4312, owned + disposed by harness) | 268 pass / 49 fail (checks, 3 viewports) |
| `node docs/design-blue/qa/harness.cjs prod` (prod `dist` served by harness-owned static server on 127.0.0.1:4322) | 265 pass / 52 fail |
| `node docs/design-blue/qa/summarize.cjs <dev\|prod> [categories]` | prints audit/console summary from `results-<target>.json` |

Every failing check maps to a ledger bug below (the 3 extra prod failures are B6, see ledger). Harness defects found along the way (transition timing, strict-mode locators, wrong fixture expectation economicActivity=1, Tab wrap to BODY, stale toast text) were fixed in the harness before any app bug was recorded.

## Isolation
Headless Chrome, fresh context per scenario, synthetic fixtures only. All requests outside the local origin were intercepted: API hosts (`localhost:7044/api` in dev config, `service-tokens.com/api` in prod config) fulfilled from fixtures (CORS preflight handled); anything else aborted (only hit: `fonts.googleapis.com` CSS @import, aborted). Unmocked API calls: 0. Camera permission not granted, no hardware. No real credentials (synthetic strings), payments, QR.

## Coverage (what was exercised, per width 360x800 / 768x1024 / 1440x1000)
- `/` home: default, FAQ open, hero CTA, hover, navigation to `/login?mode=register`. Computed body bg/text/font.
- `/login`: default, keyboard focus, failed login (401 toast), card gutters/radius, button size/colour. `/login?mode=register`: default, filled, success (POST body asserted, toast, switch back to login).
- `/dashboard` unauthenticated → redirects to `/login` (existing behaviour); unknown route → `/`.
- `/dashboard` with synthetic login: Requests populated / row-selected / empty / loading (2 s delayed) / error toast+Retry / authorize action; Products populated (nonzero 1250, 49.9, 0.01 and zero 0 prices) / empty / error+Retry / search / load more / view (with and without pictogram) / add (validation + valid) / edit / delete confirm; Users populated / empty / error / view (very long user name) / add (validation) / edit / delete confirm; Company view / edit / save (PUT body); Request view / add (incl. submitting) / edit / delete confirm.
- Request URLs/params/bodies asserted for login, GetById, Request GetAll/Authorize/Create/Update/Delete, Product GetAll (skip/take/search)/Create/Delete, CreateUser/DeleteUser, Company update/create.
- Per-state automated audits: viewport/element overflow, clipping, touch-target size, accessible names, gradients, hue scan for non-blue brand colours, text and placeholder contrast against the real composited background.
- Token contract (computed): body #F4F7FB/#172033, primary #2563EB/white, hover #1D4ED8, panel/modal radius 16, backdrop rgba(23,32,51,.5) no blur, active tab #EAF1FF/#1D4ED8, selected row #EAF1FF, validation danger #B91C1C, confirm Delete #B91C1C, disabled opacity .55 + not-allowed, gutters 16/24, max width ≤1120, tables scroll only in `.table-wrap`.
- Screenshots: `docs/design-blue/qa/screenshots/company_<route>_<width>_<state>.png` (~180 files). Reviewed by eye: home 360, requests 360/1440, products 768, company-edit 360, confirm 360 — card/panel alignment, 16px gaps, modal and button layout look consistent with the contract; table is contained, buttons ≥44px.

## Results highlights (passing)
No page/element horizontal overflow, no clipped labels, no gradients, no cyan/purple/pink; greens are only semantic success (#15803D / #E7F5EC). Primary buttons solid blue, ≥44px; modal close 44x44; confirm buttons ≥44px; modals/toasts fit viewports at 360; company form grid 1→2 columns at 640; zero price renders "0"; business rules (Edit/Delete only for Created requests, Authorize/Deauthorize) and all asserted API calls unchanged; focus rings visible on login and dashboard Tab stops; blue token ring on buttons/inputs; no console errors/pageerrors except expected ones from deliberately injected 401/500/404 fixtures (and the aborted font request); dev and prod behave identically.

## Bug ledger (open = reproducible)
| ID | Sev | Repro (route / viewport / state) | Expected | Actual | Owner |
|---|---|---|---|---|---|
| B1 | High (coordinator finding, confirmed) | `/dashboard`, all widths. Click any of Add / company Edit / View; then press Tab / Escape / wheel. Harness: `request-add dialog`, `company-edit dialog` | Focus enters dialog, Tab/Shift+Tab contained, Escape closes, focus returns to trigger, background scroll locked and restored | Focus stays on trigger (Tab runs through background controls: `000011111100`, company-edit `000000000111`); Escape ignored unless focus already inside (handler is on backdrop `keydown.escape`); body/html overflow not hidden and wheel over backdrop scrolls page (scrollY 111–570); after close focus is `BODY` | frontend-engineer (`company-dashboard.component.ts/html`; shared helper preferred) |
| B2 | Medium (coordinator finding, partly confirmed) | `/dashboard` → select request 4 → Delete (confirm dialog), all widths | Same dialog contract | Focus-in, Tab trap and Escape PASS. FAIL: background scroll not locked (scrollY changes on wheel), focus returns to `BODY` not the Delete button | frontend-engineer (`confirm-dialog.component.ts`, `dialog.service.ts`) |
| B3 | Medium | Request Add, fill, press Enter in count field (POST delayed 1.5 s), press Escape; all widths | Escape/backdrop ignored while submitting | Escape closes the modal during the in-flight request. Also source-read (not browser-tested): the dashboard backdrop has no click handler, so backdrop close from the designer rules is absent | frontend-engineer |
| B4 | Low | `/dashboard` Products tab + product view, all widths | Price numerals aligned (right-aligned/tabular-nums) per brief; current app currency convention | Price shown as raw number, left-aligned, `font-variant-numeric: normal` (1250, 49.9, 0.01, 0). Zero renders correctly. (The Investor-specific price-on-cards finding does not apply to this app; this is the Company analogue.) | frontend-engineer |
| B5 | Low | Dashboard company-info "Active" badge (all widths); home hero "✓" icon at 360 | ≥4.5:1 text contrast | #15803D on #E7F5EC = 4.46:1. Brief token pair itself is marginally below AA | frontend-engineer with coordinator (token choice, e.g. darker green text) |
| B6 | Low | `/login` Tab to "Back to main page" link (prod build; also footer logo link on `/` is 27px high) | Token focus ring on links; links ≥44px effective target on touch | Link uses browser default 1px dark `auto` outline (visible but not token ring); `.footer__logo` 140x27 | frontend-engineer |
| B7 | Low | Products/Users tabs search input, all widths | Readable accessible name | Input has placeholder only: no label/aria-label (placeholder contrast itself passes) | frontend-engineer |

Observations (not counted): Products tab "Delete" button has no danger class, unlike Requests/Users (visual inconsistency, pre-existing markup). Action/dialog buttons look like Arial vs the heading font in screenshots; not asserted, possibly the fallback stack since Inter is blocked (see below).

## Out of redesign scope / pre-existing (recorded, not counted)
- `ScanTokenComponent` is not used by any template or route (grep), so the scanner launch/cancel/error/retry and its restyle cannot be reached in the UI; TS has no `confirm()` that its template calls and the `getService` call passes 3 args while CLAUDE.md documents 4. Latent, would break if wired in.
- `src/styles.scss` (human-edited) `@import`s Google Fonts; remote third-party asset, aborted in tests, so Inter is not rendered in screenshots (fallback stack).
- Company user password input is `type="text"`; no route auth guard (dashboard redirects only via component check); API unauthenticated.

## Unverified (honest)
- Scan overlay states (no entry point; camera denied / error / detail / confirm not rendered). Its CSS was not visually reviewed.
- Backdrop-click closing of dashboard modal (source-read only). Wheel-scroll check only meaningful when the page scrolls (all three widths scrolled in the Requests view, so it ran).
- Real Inter font rendering; real camera; production API behaviour; Safari/Firefox; `prefers-reduced-motion`; pictogram upload with a real file; screenshot comparison to the concept is by eye against the written contract, not pixel equality.
- Only ~6 of ~180 screenshots were individually inspected; remaining states were covered by automated audits.

## Re-run
Start nothing manually: `node docs/design-blue/qa/harness.cjs dev` (and `prod` after `ng build --configuration production`). Evidence: `qa/results-dev.json`, `qa/results-prod.json`, `qa/screenshots/`.
