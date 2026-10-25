The blue redesign is applied across the CompanyUI routes, the scan modal, and the shared toast and confirm dialog. Both builds pass (development and production, run via `node node_modules/@angular/cli/bin/ng.js`). I did not run it in a browser, so nothing has been checked at 360, 768 or 1440 widths. I did not commit, stage or push anything.

**What changed**
- **Shared tokens and theme:** `src/styles/_variables.scss`, `_mixins.scss`, `_base.scss` and `themes/_user.scss` now carry the brief's blue tokens.
  - Gradients and hover lifts are gone.
  - Buttons and inputs are 44px tall with a visible focus ring.
  - Modals use the shared z-index, a dvh max-height and stack their buttons below 480px.
  - Badges, tables and tabs use the blue and neutral pairings.
  - Page gutters are 16px on mobile.
  - Reduced-motion is honoured.
  - `themes/_admin.scss` is now an empty stub; nothing in this app used it.
- **Toast and confirm dialog:** restyled to the same tokens. Toasts sit at the bottom on mobile.
- **`/` (home):** SCSS only. The legacy `#1a56db` blue and the gradients are replaced with tokens, the container is 1120px, and the nav fits at 360px. Your edits to `home.component.html` are untouched.
- **`/login`:** SCSS only, with the blue form, button and error styling.
- **`/dashboard`:**
  - New SCSS.
  - The three tables are now wrapped in a contained scroll wrapper.
  - Add, Create and Save buttons are primary blue.
  - The modal has dialog attributes, a Close label on its × button, and closes on Escape.
  - Forms and details go single-column on small screens.
- **Scan modal:** blue scanner styling, with the confirm button changed from green to blue. It is also marked as a dialog, and the error state is announced to screen readers. The camera, QR payload and redemption logic are untouched.
- **`index.html`:** `theme-color` is now `#2563EB`.

I left `styles.scss` alone, since you edited it. The new tokens reach it through its existing imports. A search of `src` for the old cyan, green and violet hexes, `linear-gradient` and `z-index: 1000` finds nothing.

**Not done**
- Focus does not move into the dashboard or scan dialogs on open, and background scroll is not locked. Both need TypeScript changes, which I avoided.
- `.scan-token-btn` is styled, but no template uses it. That was already the case before this work.
- The company user password input is `type="text"`. That was also already the case before this work.

I did not run the product-verifier or security-reviewer agents. My notes are in `docs/design-blue/CHECKPOINT.md`. All other changes are in `src/` (the files listed above).