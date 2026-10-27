# CustomerUI blue redesign — CHECKPOINT

Status: implementation complete; dev + production builds pass. Nothing staged/committed.

## Done
- Tokens added to `src/styles/_variables.scss` (blue-600/700/50, ink, ink-2, page, surface, line, ok/danger/warn, ctl-h, focus-ring, shadows). `themes/_user.scss` token block remapped to flat blue (file is not imported by Investor).
- `src/styles.scss`: ink on page, global focus ring, reduced motion. Human edit (test-mode notice removal) preserved.
- Restyled with shared tokens (local palettes deleted): marketplace, get-service (QR modal), cart, checkout, payment-return, token-detail, investor-login, home, toast, confirm-dialog.
- Template/TS a11y: marketplace detail modal `role=dialog`/aria-label/close label/Escape; QR modal `role=dialog`, labelled title, status/alert roles; cart remove aria-label. QR dark modules `#064e3b` -> `#172033` (payload untouched).
- `index.html` theme-color and `manifest.webmanifest` colours -> blue.
- Human edit in `home.component.html` untouched.

## Builds
- development: pass. production: pass.

## Known / not verified
- No browser/visual check by me (QA to do at 360/768/1440).
- `themes/_admin.scss` still has violet vars (unused in this app).
- Cart/checkout remain card/list layouts (no sticky summary added: no existing summary element in cart).
- Marketplace cards show no price (API token price is not rendered there today); not invented.
