The InvestorUI blue redesign has 7 open bugs. Both builds pass, but the home page and checkout overflow horizontally at 360px.

**Test run**
- **Browser tests:** 439 checks ran against the real dev server in headless Chrome. 432 pass and 7 fail, and the 7 failures come from BUG-001/002/003.
- **Builds:** the development and production builds both pass.
- **Production smoke:** 13 of 15 route and width loads pass. The 2 failures are the same overflows as BUG-001/002.
- **Evidence:** 149 screenshots in `docs/design-blue/screenshots/`. I looked at about five of them. The rest were measured by the script but not viewed.
- **Isolation:** all traffic to the production site, payments, SignalR and Google Fonts was intercepted, so nothing reached production. Only the local live-reload socket was blocked.
- **Camera:** Investor has no camera feature, so the scanner-unavailable state does not apply here.
- **Colours and layout:**
  - No green, purple, pink or cyan leftovers and no gradients. The only green is the semantic success colour.
  - Card grid columns and gaps match the brief.
  - The QR code is a white tile with dark modules.

**Open bugs** (full repro steps and owners are in `qa-report.md`):
- **BUG-001 (High):** the home page overflows at 360px (472px wide) because the Login and Register buttons in the navbar don't shrink.
- **BUG-002 (High):** checkout overflows at 360px (633px wide) when a product name is long. The saved-card **Remove** button ends up off-screen.
- **BUG-003 (Medium):** on `/token/:id` at 360px, the fixed action bar covers the last section. No link in the app leads to that page, so I could only audit it by injecting its data.
- **BUG-004 (Low):** the refresh button is 27px wide and crowds the title at 360px. The home brand link (31px tall) and footer logo (25px tall) are below 44px.
- **BUG-005 (Low):** the success badge text has 4.46:1 contrast against its background, just under the 4.5:1 minimum.
- **BUG-006 (Medium):** marketplace cards and the detail modal show no price, although the API returns one and the cart and checkout display it.
- **BUG-007 (Low):** focus does not move into the detail modal, Escape does not close the QR modal, and the page behind the modal still scrolls.

The report also lists existing problems that are not counted as redesign bugs. Examples are the `/token/:id` page rendering blank when navigated to with state, and no client-side validation on the login form.

**Not verified:**
- The real Flitt widget and the real SignalR connection, both mocked.
- Hover and active states.
- Firefox and Safari.
- Service-worker behavior.
- Focus return after a modal closes.
- Pixel match to the reference concept.

Everything is in `docs/design-blue/` in InvestorUI:
- `qa-report.md`
- `QA-CHECKPOINT.md`
- `qa/` with the test scripts, `results.json` and `run-final.log`

I changed no app code and did not stage or commit anything. The first bug-fix pass should start with BUG-001 and BUG-002, then I will re-run the same scripts.

BUG_COUNT: 7