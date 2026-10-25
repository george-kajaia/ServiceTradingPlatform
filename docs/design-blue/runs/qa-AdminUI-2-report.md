No open reproducible bugs in the tested AdminUI scope. This is not proof that none exist. The dev and production builds both exit 0, and the browser harness passed in dev (559/559) and prod (488/488). Nothing is committed or staged, and I didn't touch app code.

The three round-1 bugs are now fixed:
- **BUG-1:** status text contrast now passes after the green was darkened to `#166534`.
- **BUG-2:** the Requests Approve button is reachable at 1440 with both long and short data.
- **BUG-3:** the confirm dialog returns focus to its opener after Escape and after a backdrop click.

The existing harness needed these updates first:
- It still expected the old green, `#15803D`.
- Focus checks now wait for transitions to settle.
- Mobile filter widths are compared to the real parent content width.
- I added checks for the dialog (Shift+Tab, scroll lock and restore, focus return) and for empty-body 500 toasts. Login and company-approve toasts show the English fallback instead of undefined.

**Browser runs**
- **Dev run:** 0 unexpected console or page errors, and no remote requests got out.
- **Prod run:** 0 remote requests got out. The 33 console entries marked unexpected were all "Service Worker registration blocked", which my harness causes on purpose.
- **Coverage:** routes, login, Companies and Requests (populated, empty, error with Retry, filters, approve, conflict) at 360, 768 and 1440 widths. Colours, focus, contrast and touch targets were checked too. I reviewed the 1440 Requests and 360 dialog screenshots.

**Coordinator findings**
- The Admin items (status contrast, Approve reachability, focus return, focus ring, empty-error toast) are verified.
- The dialog focus and scroll findings are verified for the Admin confirm dialog.
- The Investor price and token-detail status gates, and the Company/Service scanner findings, don't apply to AdminUI, so I didn't test them.

**Not verified**
- Real touch hardware: I emulated coarse pointer by rewriting the media query in the served local JS/CSS.
- The real Inter font, because Google Fonts was stubbed.
- Safari and Firefox, screen readers, reduced motion, and the service worker in prod.
- The unrouted Home component.
- The confirm dialog on the production build, because it needs a dev-only debug API.
- Pixel match to the concept, since only a direction reference exists.

My attempt to delete the build output in `docs/design-blue/qa/_dist` was denied, so it is still there and safe to delete.

Files are in `docs/design-blue/`:
- `qa-report.md`
- `QA-CHECKPOINT.md`
- `qa/harness.cjs`
- `results-dev.json`
- `results-prod.json`

The screenshots are in `docs/design-blue/screenshots/`.

BUG_COUNT: 0