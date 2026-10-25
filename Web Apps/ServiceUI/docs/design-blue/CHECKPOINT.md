# ServiceUI blue redesign checkpoint (2026-10-14)

## Completed (uncommitted, unstaged)
- `src/styles/_variables.scss`: shared blue tokens added (identical names to the designer report).
- `src/styles/_base.scss`: page/ink body colours, `:focus-visible` ring, reduced-motion.
- `src/styles/themes/_user.scss`: rewritten on blue tokens (flat buttons, 44px controls, badges, alerts, modal, tabs, table).
- `src/styles/themes/_admin.scss`: violet/pink palette removed (unused in ServiceUI); aliases blue tokens.
- `shared/components/toast` and `confirm-dialog` SCSS: restyled (blue/neutral, 44px targets, mobile stacking, bottom toasts on mobile).
- `features/auth/service-login` SCSS (+ autocomplete attributes in html).
- `features/home/home.component.scss`: tokens, no gradients/lifts, flat blue CTA.
- `features/service/scan` SCSS: 1120px container, 56px full-width Scan button, secondary logout.
- `features/service/scan-token` SCSS: #2563EB, full-screen <480px, blue corner brackets/scan line, stacked footer.
- `scan-token` html/ts: `role="dialog" aria-modal aria-label`, `role="alert"` on the error state, Escape closes via `cancel()` (same as backdrop/close).
- Human edits to `home.component.html` and `styles.scss` preserved untouched (test banner removal).

## Builds
- development: pass. production: pass (output complete; shell reported exit 127 after the build, likely a post-build hook).
- `rg` for legacy hexes, `linear-gradient`, `z-index: 1000` over `src`: no matches.

## Remaining / known issues
- Not browser-verified (QA to do). Focus is not moved into the scan modal on open (not implemented; avoids camera flow changes).
- Escape during `submitting` cancels like the existing backdrop click; behaviour unchanged in kind.
- Remote Google Fonts `@import` (pre-existing in `styles.scss` and home scss) left as is.
