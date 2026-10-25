CompanyUI QA found 7 open redesign/regression bugs. Both builds pass and the real UI ran in headless Chrome at 360, 768 and 1440.

**Builds and runs**
- **Dev build:** passed.
- **Production build:** passed.
- **Dev harness:** 268 checks passed, 49 failed.
- **Production harness:** 265 passed, 52 failed. The extra 3 failures are the prod-only link-focus check in B6.
- **Harness failures:** every failing check maps to a bug below. I fixed harness defects (timing, locators, a wrong fixture expectation) before recording any app bug.
- **Isolation:** all non-local requests were intercepted. The only remote request was the Google Fonts `@import` in `src/styles.scss`, which was aborted. No unmocked API calls hit.

**What passed**
- No horizontal overflow, clipped labels, gradients or cyan/purple/pink colours. Greens appear only as semantic success colours.
- Primary buttons are solid blue and at least 44px tall, and the modal close buttons are 44×44.
- Request URLs, params and bodies were asserted for login, requests, products, users and company, and all matched.
- Console errors were only the ones my injected 401/500/404 fixtures caused.

**Bug ledger**

| ID | Severity | What fails |
|---|---|---|
| B1 | High | Dashboard dialogs: focus doesn't move in, Tab escapes to the background, the background scrolls (scrollY 111–570), focus lands on `BODY` after close, and Escape only works if focus is already inside. This confirms the coordinator finding. |
| B2 | Medium | The shared confirm dialog handles focus-in, Tab trap and Escape correctly. It has no scroll lock, and focus returns to `BODY` instead of the Delete button. |
| B3 | Medium | Escape closes the Request Add modal while the create request is still in flight. From reading the source (not browser-tested), the dashboard backdrop also has no click-to-close. |
| B4 | Low | Products table prices are raw numbers, left-aligned, without tabular numerals. A zero price renders correctly. The Investor price-on-cards finding doesn't apply to this app, so this is the Company equivalent. |
| B5 | Low | The "Active" badge and the home "✓" icon are #15803D on #E7F5EC, which is 4.46:1 and just under AA. That is the brief's own token pair. |
| B6 | Low | Links use the browser's default 1px outline instead of the blue focus ring. The home footer logo link is 27px tall. |
| B7 | Low | The Products and Users search inputs have only a placeholder and no accessible label. |

**Unverified**
- **Scanner:** the scan overlay is unreachable. `ScanTokenComponent` isn't used by any route or template, so I couldn't test launch, cancel, error or retry. Its TypeScript also lacks the `confirm()` method its template calls.
- **Fonts:** Inter isn't rendered in screenshots because the Google Fonts `@import` is blocked.
- **Screenshots:** I inspected about 6 of roughly 180 by eye. The rest were covered by the automated audits.
- **Not tested:** Safari, Firefox, `prefers-reduced-motion` and real pictogram upload.
- **Pre-existing, not counted:** the password field is `type="text"` and there is no route guard.

Nothing was staged, committed or pushed, and no app code was touched. Everything is in `docs/design-blue/`: `qa-report.md`, `QA-CHECKPOINT.md`, and a `qa/` folder with `harness.cjs`, `summarize.cjs`, `probe.cjs`, the results JSON files and screenshots.

BUG_COUNT: 7