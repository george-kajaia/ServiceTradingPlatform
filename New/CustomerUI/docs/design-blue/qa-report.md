# CustomerUI blue redesign — QA report

Date: 2026-10-14 · Tester: qa-tester (independent of frontend-engineer) · App code untouched, nothing staged/committed.

## Result
**7 open bugs** (2 High, 2 Medium, 3 Low). Both builds pass. Browser run: 439 checks, 432 pass, 7 fail. The 7 failures come from BUG-001/002/003. BUG-004 to BUG-007 were found by the audit data and review.

## Commands and results
| Command | Result |
|---|---|
| `node node_modules/@angular/cli/bin/ng.js build --configuration development --output-path <tmp>` | PASS (4.19 MB initial) |
| `node node_modules/@angular/cli/bin/ng.js build --configuration production --output-path <tmp>` | PASS (668.97 kB initial, 162 kB transfer) |
| `node docs/design-blue/qa/investor-qa.cjs` (dev server 127.0.0.1:4311, started and stopped by the harness) | 439 checks, 432 pass, 7 fail, 149 screenshots, 107 scenario runs. Log: `qa/run-final.log`. Data: `qa/results.json` |
| `node docs/design-blue/qa/prod-smoke.cjs` (prod build served on 4315) | 15 route×width loads: 13 pass, 2 fail (same overflow as BUG-001/002). 0 console errors, 0 page errors, 0 failed or unmocked requests |
| `node docs/design-blue/qa/summarize.cjs [small\|colors\|contrast\|...]` | Deduped audit summaries |

Builds were written to a temp dir, so `dist/` was not touched. Harness files: `qa/lib.cjs`, `qa/investor-qa.cjs`, `qa/prod-smoke.cjs`, `qa/summarize.cjs`. Optional filter: `node qa/investor-qa.cjs "regex,regex"`. A filtered run overwrites `results.json`, so rerun unfiltered afterwards.

## Isolation
- Each scenario gets a fresh browser context with no persisted profile. Service workers are blocked and camera/mic permissions are not granted. Investor has no camera feature, so the scanner-unavailable-hardware state is not applicable here.
- Every non-localhost request is intercepted:
  - `service-tokens.com` APIs get synthetic fixtures (login, cart add/remove, payment initiate/status, SignalR negotiate).
  - The SignalR WebSocket is fully mocked with `routeWebSocket` and never connects.
  - `pay.flitt.com` JS is a stub widget, and Google Fonts CSS is stubbed.
  - Any other host is aborted and recorded. Only the local `ng-cli-ws` live-reload socket was blocked.
- There were 0 unmocked API calls across 107 runs. No real credentials, QR or payment data were used.

## States exercised (360/768/1440 each unless noted)
- **Home**: populated featured (7), empty featured, featured API error. FAQ open. Featured-card click goes to /login.
- **Login/Register**:
  - Login: default, empty submit (`:invalid` flagged), wrong credentials, loading/disabled (delayed response), and success to /marketplace with the exact POST body.
  - Register: form, error toast, success toast.
- **Guards**: /marketplace, /cart and /checkout without a session go to /login. An unknown route goes to /. /token/xyz leaves the token page.
- **Marketplace**:
  - My Tokens, Primary and Secondary tabs: populated, empty, error (500 shows a toast and Retry works) and loading (bar plus disabled refresh).
  - Filters: company, product and request enable in order, Apply sends `companyId`, Reset restores.
  - Detail modal on all 3 tabs: fits the viewport, close and action buttons ≥44px, actions stacked at 360, Escape and backdrop close.
  - Add to cart from the card and from the modal, with exact `MarkServiceTokenInCart` params and badge count.
  - Logout confirm dialog: Escape cancels, confirm clears the session.
  - Toasts.
- **QR modal**:
  - States: connecting, QR, hub result success and failure, negotiate failure then Try Again then Cancel.
  - QR colours: white tile and dark `#172033` modules, verified from decoded pixels.
  - Layout: fits at 360 with no internal scroll, and the QR is ≤240px.
- **Cart**: populated (primary and secondary), remove (`CancelInCart` params), empty, Checkout goes to /checkout.
- **Checkout**:
  - Summary, with the secondary note, masked card and total 1,370.50. Remove saved card.
  - Pay shows the widget (stub), and Processing is never shown as success.
  - Outcomes: Succeeded, mixed Succeeded/Failed, Cancelled, initiate error toast.
  - Other states: empty, loading, pending (fake clock past the 10-minute timeout).
- **Payment return** (seeded session): verifying, success, failed, pending (clock), no-session redirect. Status always comes from `GetStatus`.
- **Token detail** `/token/:id` (primary, mine, secondary): see Obs-1 and BUG-003 for the caveat.
- **Keyboard focus**: Tab through login, marketplace, cart and home at 1440. Every stop has an outline or ring.

## Style and token checks (computed style, all audited states)
- **Brand colours**: scanned every visible element (color, background, border, shadow, gradients). There are no green, purple, pink or cyan leftovers and no gradients. The only hue hits are semantic success `#15803D` on `#E7F5EC` (Available badge, success toast icon, Purchased badge, success icon).
- **Controls**: primary controls are solid blue with white text. The focus ring sample on login is a `rgb(23,32,51)` outline.
- **Contrast** (AA, text on solid backgrounds): the only failure is BUG-005. Text over gradients or images is not evaluated, and none was found in the audited states.
- **Labels and sizes**: 0 unlabeled form controls and 0 clipped text. The only text under 12px is the 11px mobile cart badge, which the designer specified.
- **Touch targets**: all ≥44px at 360 and 768 except BUG-004.
- **Layout**: grid columns are 1/2/3/4 at 360/768/1440 as specified. Gap is 16px on mobile and 20px on desktop. Cards in a row have equal height.
- **Screenshots reviewed by eye**: marketplace primary at 360 and 1440, detail modal at 360, QR modal on the token page, and checkout at 360. The other ~140 were produced and measured but not individually viewed.

## Bug ledger (open)
| ID | Sev | Repro | Expected | Actual | Owner |
|---|---|---|---|---|---|
| BUG-001 | High | `/` at 360×800, any state. Also in the prod build. Shot `investor_home_360_populated.png` | No horizontal overflow | Page is 472px wide. `.navbar__auth` (Login + "Register as Investor", `flex-shrink:0`) is 294px, the brand is 146px, and with gaps they exceed 360 | frontend-engineer (`home.component.scss` navbar: stack, shrink or hide the secondary button below 480) |
| BUG-002 | High | Cart with a long product name ("Premium Deep-Tissue Massage Therapy Package (90 min)"), then `/checkout` at 360×800 summary. Also in prod. Shot `investor_checkout_360_summary.png` | No overflow, and Remove-saved-card is tappable | Page is 633px wide. The header stays 360 but the summary card is 617px. The saved-card **Remove** button sits at x=444–517, outside the viewport. Cause: grid item `.summary` has `min-width:auto` and `.summary__product` is nowrap | frontend-engineer (`.checkout-body{grid-template-columns:minmax(0,1fr)}` or `.summary{min-width:0}`) |
| BUG-003 | Medium | `/token/:id` at 360×800, scrolled to the bottom (primary, mine, secondary). Shots `investor_token-detail_360_*.png` | Last section (Row Version) fully visible above the fixed action bar | The fixed `.action-bar` (2–3 stacked buttons, up to ~190px) overlaps the last section by 33–89px. Bottom padding is smaller than the bar. The route has no UI entry point (see Obs-1) | frontend-engineer (`token-detail.component.scss`) |
| BUG-004 | Low | Any marketplace tab at 360 | Refresh ≥44×44 and not crowding the title. Links ≥44px or documented | `.app-bar__refresh` is 27×44 (squeezed by flex) and the "Marketplace" title touches it. Home `a.navbar__brand` is 146×31 and `a.footer__logo` is 140×25 | frontend-engineer |
| BUG-005 | Low | Primary tab ("Available" `badge--green`), and the "Purchased" badge in checkout and payment-return, all widths | Text ≥4.5:1 | 4.46:1 (`#15803D` on `#E7F5EC`, 12px). The token pair comes from the designer spec, so lighten the background | designer, then frontend-engineer |
| BUG-006 | Medium | Marketplace Primary and Secondary cards and the detail modal, all widths | Brief: "cards with company/product/price/uses/validity" and price hierarchy | No price anywhere on cards or detail modal (`price-on-card=false`). `ServiceTokenDto.price` is returned and used by cart and checkout. The implementer's "API price not rendered today" is a UI omission, not a missing field | frontend-engineer (George to confirm intent) |
| BUG-007 | Low | Open the Primary detail modal at any width. Open the QR modal and press Escape | Designer rule: focus moves into the modal and returns, and Escape closes unless an action is in flight | Focus stays outside the detail modal. Escape does not close the QR modal (backdrop does). Body scroll is not locked (`overflow:visible`). The implementer disclosed QR Escape and focus as unchanged | frontend-engineer |

## Observations — pre-existing or outside the redesign (not counted)
1. `/token/:id` is not linked from any UI. Driven with `router.navigate(..., {state})`, it renders an empty component (token is null and the stale marketplace host stays in the DOM). I could only audit the redesigned page by injecting inputs through the dev `ng` API. Harness limit: the QR modal opened from that page stays on "Connecting…". Existing behavior; needs a product decision.
2. Token-detail template: the label "Product ID" shows the product name. Its status mapping (`status===1` allows both Mark-for-Resell and Get-Service, Cancel-Reselling uses 0) differs from the marketplace (`2` = Sold). This is business logic and I did not touch it.
3. Login and register forms: Angular adds `novalidate`, so an empty submit still POSTs and the server error is shown. There is no client-side validation.
4. The investor session is stored in `sessionStorage`. CLAUDE.md bans sensitive data in web storage, so flag this for security review. The API has no auth (known).
5. `styles.scss` `@import`s Google Fonts, which is a remote asset. It is stubbed in tests, and Inter falls back to the system font offline.
6. The mobile bottom nav uses colour emoji icons (🏪🔄🛒) outside the blue/neutral palette. This is cosmetic and the designer's call. The detail-modal "Add to Cart" is an outlined button, not solid blue (brief: primary = solid blue). Confirm intent.
7. Console noise came only from intentional failure scenarios: 401/500 from mocked errors, and the SignalR negotiate failure in the retry test.

## Honestly unverified
- Real Flitt widget (stubbed) and real SignalR transport (mock WebSocket).
- Real camera: not applicable to this app.
- Hover, active and disabled visuals beyond measured contrast.
- Firefox and Safari.
- Installed-PWA and service-worker behavior (blocked).
- Focus return after a modal closes.
- Pixel parity with the reference concept (only a directional reference exists).
- About 140 screenshots were not individually viewed.
- Contrast over gradient or image backgrounds (none seen).

This is not an exhaustive proof that no other bugs exist.

## Re-run
`node docs/design-blue/qa/investor-qa.cjs`, then `node docs/design-blue/qa/prod-smoke.cjs`. Rebuild prod to `C:/Users/georg/AppData/Local/Temp/inv-qa/prod` first. After the fixes, the BUG-001/002/003 checks should flip to PASS. BUG-004 to BUG-007 need new assertions, which I will add on re-test. Their raw data is in the `audits` and `notes` in `results.json`.
