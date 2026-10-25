The blue redesign is applied across all ServiceUI routes and modals. Both builds compile, but I haven't looked at any screen in a browser, so layout and focus behaviour are untested.

**Verification**
- Development build (`node node_modules/@angular/cli/bin/ng.js build --configuration development`) passed.
- Production build passed and wrote its full output, but the shell reported exit code 127 after it finished. I didn't look into why.
- A search of `src` for the old cyan, green, violet and `#1a56db` colours, `linear-gradient` and `z-index: 1000` found nothing.
- Nothing is staged or committed, as instructed.

**What changed**
- **Shared tokens:** `_variables.scss` now has the designer report's blue tokens under the same names. `_base.scss` adds the page and text colours, a visible focus ring, and reduced-motion handling.
- **Theme files:** `_user.scss` is rebuilt on those tokens. Buttons are flat, controls are 44px, and badges and alerts are tinted. The modal uses a 16px radius with the backdrop blur removed. I stripped the violet/pink palette from `_admin.scss`, which nothing in ServiceUI uses.
- **Toast and confirm dialog:** restyled in blue and neutral colours with 44px close buttons. Dialog actions stack on mobile, and toasts sit at the bottom on mobile and top-right on desktop.
- **Home, login and scan pages:**
  - Home has no gradients or hover lifts, and the closing call-to-action is flat blue.
  - Login is a card on the page background.
  - The scan page uses the 1120px container, a 56px full-width Scan button, and a neutral Logout button.
- **Scan modal:** colours are now `#2563EB`. It goes full-screen under 480px and stacks Confirm and Cancel. Corner brackets and the scan line are blue with an outline so they show over video. Detail rows highlight the uses count, and the error state is a red alert box.
- **Small template and script edits:** the scan modal now has `role="dialog"`, `aria-modal` and a label. The error state has `role="alert"`, and the login inputs have `autocomplete` attributes. I added an Escape handler to `scan-token.component.ts` that calls the existing `cancel()`. Camera cleanup, the QR payload, the confirm call and the API are untouched.
- **Your uncommitted edits:** the test-banner removals in `home.component.html` and `styles.scss` are preserved.

**Routes affected:** `/`, `/login`, `/scan`, the scan modal in all its states, and the global toast and confirm dialog.

**Not done**
- No browser check at 360, 768 or 1440 wide.
- Focus is not moved into the scan modal when it opens. I left that out to avoid touching the camera flow.
- Escape closes the scan modal even while a confirm request is in flight, the same as the backdrop click already did.
- The Google Fonts `@import` lines already in the app are unchanged.

`docs/design-blue/CHECKPOINT.md` records all of this.