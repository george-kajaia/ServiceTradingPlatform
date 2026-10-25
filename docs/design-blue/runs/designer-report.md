# Blue Rollout Spec: InvestorUI, CompanyUI, AdminUI, ServiceUI

**Basis.** I read `brief.md` and the SCSS entry points of all four apps. I also read the full InvestorUI marketplace SCSS and sampled the class inventories of the Company dashboard, Admin dashboard and Service scan-token SCSS, plus the route files.

**Not inspected.** I did not open the `.html` and `.ts` templates. I also did not open the human-edited `home.component.html` or `styles.scss` diffs in Investor, Company and Service, beyond reading Investor's and Service's current `styles.scss`. Frontend should read those diffs first and keep their content and bindings.

## 1. Findings that drive the work

- **Four copies of the theme.** Each app has its own copy of `styles/_variables.scss`, `_mixins.scss`, `_base.scss` and `themes/_user.scss` and `_admin.scss`.
  - `_user.scss` is cyan/blue with gradients (`$user-gradient-primary`).
  - `_admin.scss` is the violet/pink variant.
  - Both are `@use`d in Company, Admin and Service `styles.scss`.
- **InvestorUI's global styles differ from the other three.**
  - Its `styles.scss` does not import `styles/*` at all.
  - It is a green-tinted body (`#064e3b` text on `#f0fdf4`).
  - Investor components `@use` `variables` and `mixins` directly.
- **Most component SCSS has its own local palette.** Each file redefines hex variables instead of using shared ones.
  - Investor (all 7 feature files): green `#059669`.
  - Company login and dashboard, Service login and scan: cyan `#06b6d4`.
  - Admin login and dashboard: violet `#8b5cf6` with pink accent.
  - Admin home: dark navy `#0a0f1a`.
  - Service `scan-token`: already blue, but `#1a56db`, not the brief's `#2563EB`.
  - Company `home`, `home.component.scss` ×2 and `scan-token` are also hex-heavy; the Service and Admin home files have about 60 and 13 hex or gradient hits.
- **Hardcoded one-offs in Investor marketplace.**
  - `.cart-btn` uses `#059669`.
  - `.logout-btn` is a red pill with a glow shadow.
  - `.cart-badge-mobile` uses `#ef4444` at 0.6rem.
  - `.modal` has a 20px radius.
  - `.card-grid` has 5 columns at ≥1400px.
  - `.tc-btn--sm` is about 26px tall.
- **Contrast failures in the shared themes.** These are WCAG AA failures on white surfaces.
  - `.badge--success`, `.alert--success` and `.field__error` use the 400-level colours (`$success-400`, `$error-400`).
  - `.link` uses cyan-400.
  - Local `$text-muted` greys are about 4.5:1 or lower.
- **Small controls.** `.btn` has no min-height, `.btn--icon` is 36px, the app-bar refresh is 36px, and the modal close is 32px. All are below the 44px touch target.
- **Z-index.** Modals use a hardcoded `z-index: 1000` while `$z-modal-backdrop` is 400. The sticky app bar is 200.

## 2. Shared tokens (identical in all four apps)

Edit each app's `src/styles/_variables.scss` and `themes/_user.scss`. Keep SCSS variable names where possible so existing `@use` consumers still compile.

**Add to `_variables.scss`:**
```
$blue-600:#2563EB; $blue-700:#1D4ED8; $blue-50:#EAF1FF;
$ink:#172033; $ink-2:#596779; $page:#F4F7FB; $surface:#FFFFFF; $line:#E0E6EE;
$ok:#15803D; $ok-bg:#E7F5EC; $danger:#B91C1C; $danger-bg:#FDECEC; $warn:#92400E; $warn-bg:#FEF3E2;
$ctl-h:44px; $focus-ring:0 0 0 3px rgba($blue-600,.35);
$shadow-card:0 1px 2px rgba(23,32,51,.06); $shadow-pop:0 12px 32px rgba(23,32,51,.16);
$container-padding-mobile:$space-4;
```

**Remap in `_user.scss`.**
- `$user-primary-*` and `$user-secondary-*` become the blue tokens.
- `$user-accent-*` becomes `$ok`.
- Set `$user-bg-base: $page`, `$user-text-primary: $ink` and `$user-text-secondary: $ink-2`.
- Set `$user-text-muted: $ink-2`, so muted text is also ≥4.5:1 on white and on `$page`.
- Border variables all become `$line`; `$user-border-strong` becomes a slightly darker `$line`.
- Remove the gradient variables, or alias them to a flat `$blue-600`.

**Components in `_user.scss`.**
- `.btn`:
  - `min-height: $ctl-h`, 8px radius, `--primary` solid `$blue-600` with white text, hover `$blue-700`.
  - Remove `hover-lift` and glow shadows.
  - `:focus-visible` uses `$focus-ring`.
  - `:disabled` is opacity .55 with `cursor: not-allowed`.
  - Add `.is-loading` with a spinner and `pointer-events: none`.
  - `--success` is white on `$ok`, `--danger` is white on `$danger`.
  - `--sm` keeps `min-height: 36px` only inside dense tables and has a padded hit area ≥44px on touch via `@media (pointer: coarse)`.
  - `--icon` becomes 44px.
- `.btn--secondary` has a `$surface` background, `$line` border and `$ink` text.
- `.input` and `.select`:
  - `min-height: $ctl-h`, 16px font on mobile so iOS doesn't zoom.
  - Focus is a `$blue-600` border plus `$focus-ring`.
  - Error uses a `$danger` border.
  - The select chevron is `$ink-2`.
- `.field__error` uses `$danger` and `.field__helper` uses `$ink-2`.
- `.badge--*` use dark text on tinted backgrounds: `$ok` on `$ok-bg`, `$danger` on `$danger-bg`, `$warn` on `$warn-bg`, `$blue-700` on `$blue-50`.
- `.alert--*` use the same pairings. Every status keeps a text label.
- `.link` uses `$blue-600`, underlined on hover and focus.
- `.table`:
  - Header is `$page` with `$ink-2` text, no uppercase tracking beyond 0.04em.
  - Hover is `$blue-50`.
  - Selected is `$blue-50` with a 3px inset left `$blue-600` bar.
  - Always wrapped in a contained `overflow-x:auto` wrapper.
- `.tabs__tab`:
  - Active is `$blue-50` with `$blue-700` text and an underline or border (no gradient).
  - Inactive hover is `$page`; the current white-on-cyan hover goes away.
- `.card`: 12px radius, `$line` border, `$shadow-card`. `--elevated` and large panels use 16px.
- `.modal`:
  - Backdrop is `rgba($ink, .5)` with no blur.
  - Container is `$surface`, 16px radius, `$shadow-pop`, `max-height: calc(100dvh - 32px)`, scrolls internally.
  - Header, body and footer padding is 20/24px on desktop and 16px on mobile.
  - Footer buttons stack full-width below 480px, with the primary action first in visual order on mobile.
  - Close button is 44×44.
  - Use `$z-modal-backdrop` and `$z-modal` everywhere instead of hardcoded 1000.
- `.page`: max-width 1120px, gutters 24px (16px below 768px).
- `_base.scss`: Inter/system stack, body 14–16px, `:focus-visible` default ring, `prefers-reduced-motion` disables transforms and spinners.
- `_admin.scss`: replace the violet/pink variables with the same blue tokens, or empty it if unused. grep for `admin-theme` usage first.
- **Shared components, same CSS in all four apps.**
  - **Toast.** `$surface` with a 4px left bar in `$ok`/`$danger`/`$blue-600`, `$ink` text, placed bottom-center on mobile (`inset-inline: 16px`) and top-right on desktop. Keep `role="status"` or `alert`.
  - **Confirm dialog.** Use the `.modal` rules above. Confirm is `--primary`, or `--danger` for destructive actions. Cancel is `--secondary`.

## 3. Per-app work

### InvestorUI (routes `/`, `/login`, `/marketplace`, `/cart`, `/checkout`, `/payment/return`, `/token/:id`, plus the QR modal)

- **`styles.scss`.** Replace the green `body` colours with `$ink` on `$page`. Add `@use 'styles/variables'` and `@use 'styles/base'`, plus the `themes/user` import, so shared tokens exist globally. Preserve the human-edited content.
- **Local palettes in 7 files.** Delete the local palette blocks and `@use` the shared tokens. Use `$blue-600` and `$blue-700` for `$primary` and `$primary-dark`. Map `$primary-bg` to `$page`, `$primary-muted` to `$blue-50`, `$border` to `$line`, `$text` to `$ink` and `$text-muted` to `$ink-2`.
- **Marketplace app bar.**
  - Brand logo is `$blue-600`.
  - The key chip uses `$page`.
  - Logout becomes a `btn--secondary` style (neutral border, `$danger` text on hover), with no red pill or glow.
  - Cart button is a solid blue pill, 44px tall. Its count badge is white on `$blue-700`, ≥18px.
  - `.cart-badge-mobile` is `$danger` or `$blue-700` with ≥16px size and 11px text.
  - Refresh is 44px.
- **Desktop tabs and filter bar.** Active tab is a `$blue-600` underline with `$blue-700` text. The filter bar is `$surface` with `$line` borders (remove `#fafafa`). Inputs are 44px tall and filter buttons are 44px.
- **Token card (grid and mobile).** Order inside the card:
  1. Company name, uppercase, 12px, `$blue-700`.
  2. Product name, 16px, 600 weight.
  3. Price, large, right-aligned numerals (`font-variant-numeric: tabular-nums`) in `$ink` (price is not green).
  4. Uses and validity.
  5. Mono ID in `$ink-2`.
  6. Actions.
  - Card styling: `$surface` with a `$line` border, 12px radius, `$shadow-card`. Hover shows a border of `$blue-600` and a soft shadow, with no 4px lift.
  - The `--buyable` accent is a 3px top or left `$blue-600` bar.
  - Image placeholder is `$page` with `$ink-2` icon.
  - `.card-grid` columns: 1 under 520px, 2 from 520px, 3 from 1024px, 4 from 1280px (5 columns today is too tight).
  - Gap is 16px on mobile and 20px on desktop.
  - Card action buttons are ≥44px, or at least 36px visually with a 44px hit area (`.tc-btn--sm`). `--in-cart` is `$blue-50` with `$blue-700` text. `--warn` is `$warn` text on `$warn-bg`, or solid warn with white text.
- **Row table (`.grid`, desktop `≥768`).** Header is `$page` with `$ink-2` text, and the table sits inside `.table-wrap` (already contained). Hover is `$blue-50`, and the selected row is `$blue-50` without `!important` if feasible.
- **Detail modal and `/token/:id`.**
  - Modal is 16px radius, 520px max, with a 44px close button.
  - Details grid is 2 columns on desktop and 1 column below 480px.
  - `dt` is 12px `$ink-2` and `dd` is 14–16px `$ink`.
  - Price is in `$ink` at 20px.
  - Actions are full-width stacked on mobile.
  - The token detail page keeps the same structure, using the `.page` container.
- **QR modal (`get-service`).**
  - The QR sits on a white tile with ≥16px padding and dark modules. Do not tint it.
  - Waiting, connecting, error (with a retry button if one exists) and success states all need a visible text status.
  - Close is 44px and Escape and backdrop behaviour is unchanged.
  - Fit at 360×800 with no scroll (QR ≤ 240px).
- **Cart and checkout.**
  - Cart lines are cards on mobile and a table on desktop, with right-aligned totals. Remove buttons are 44px with a text or `aria-label` ("Remove").
  - The summary is sticky on desktop and a sticky bottom bar on mobile (respect `safe-area-inset-bottom`).
  - The Flitt embedded checkout container is `$surface` with a `$line` border, `min-height` set so it does not collapse, and it must not clip the iframe at 360px.
- **Payment return.** Success shows `$ok` with a text label ("Payment successful"). Failure and pending states are `$danger` and `$warn`. Keep the current copy and logic: status always comes from the API, never client-side.
- **Login and home.** Blue primary button, card on `$page`. Remove gradients and green. Keep the current copy and the human edits in `home.component.html`.

### CompanyUI (`/`, `/login`, `/dashboard` and its modals, including scan-token)

- Remap `company-dashboard`, `company-login` and `home` local palettes (`$dash-*`, `$auth-*`) to the shared tokens. Delete the cyan hexes.
- **Dashboard layout.**
  - Header and company-info: the "scan token" button becomes a `btn--primary` (44px). Company actions are secondary buttons.
  - Tabs follow the shared `.tabs` style and scroll horizontally in a contained row on mobile.
  - Panels are `$surface`, 16px radius, with 24px desktop and 16px mobile padding.
  - The search row stacks on mobile.
  - `.badge-active` and `.badge-inactive` become `$ok` on `$ok-bg` and `$ink-2` on `$page`, always with text.
- **Tables (`.grid`).** Wrapped in an `overflow-x:auto` container. `.row-actions` has one primary action plus secondary ones. Destructive actions are `$danger` text buttons that open the confirm dialog. Each action button is ≥44px high on touch, and below 768px keep them wrapped, not clipped.
- **Modals (`.modal`, `.modal-backdrop`, `.company-grid`, `.form`).**
  - `.company-grid` is 2 columns on desktop (`.span-2`) and 1 column below 640px.
  - `.modal-actions` is right-aligned on desktop and stacked on mobile.
  - `.icon-btn` is 44px.
  - Pictogram upload and preview: a dashed `$line` border, a `$blue-50` hover, and a preview that does not overflow.
  - Validation: `.validation-error` and `.error` use `$danger` on `$danger-bg` with an icon and text.
- **Scan-token.** Same rule as ServiceUI below. Keep the camera and redemption behaviour untouched.

### AdminUI (`/login`, `/dashboard`)

- Remove the violet/pink and the dark navy home. `admin-dashboard`, `admin-login` and `home` use shared blue tokens. The admin theme is dense and neutral: 13px table text, 8px row padding, `$page` background.
- **Dashboard.** Tabs are contained, and `.filters` wraps to a stacked layout below 768px with 44px controls. `.grid` sits in a scroll wrapper, with sticky header (`position: sticky; top: 0`) and a minimum column width.
- **Approval controls.**
  - Approve is `btn--success` and reject or block is `btn--danger` (text-labelled).
  - Pending and approved states use badges with text ("Pending", "Approved", "Rejected" — the app's existing labels).
  - Disabled and in-flight buttons use `.is-loading`.
  - Confirm dialogs on irreversible actions.
- **Login.** Blue primary button, card on `$page`, error alert with `$danger`.
- **Home (`/` redirects to login).** If the `home` component is still reachable, move it to the light blue surface. Do not leave dark navy on a blue site.

### ServiceUI (`/`, `/login`, `/scan`)

- Remap `scan`, `service-login` and `home` palettes. Change `scan-token.component.scss` `$primary` from `#1a56db` to `$blue-600`, plus its `$border` and `$text` tokens. Use `$success` as `$ok` and `$error` as `$danger`.
- **Mobile-first scanner.**
  - The primary "Scan" action is a full-width, ≥56px blue button, fixed or sticky at the bottom on mobile (safe-area padding) and inline in a 480px column on desktop.
  - The scan modal is full-screen on <480px (100dvh, no radius) and a centred card up to 480px on larger screens.
  - Camera wrap is 4:3 or square, with blue corner brackets and a scan line in `$blue-600` (≥3:1 over video, so add a white 1px outer or dark shadow).
- **States, all with text.**
  - Requesting camera permission.
  - Scanning.
  - Camera denied or error: `$danger-bg` alert with an instruction and a retry button.
  - Token found (details): `.token-detail-row` label `$ink-2`, value `$ink`; highlight row in `$blue-50`; ID mono, with word-break.
  - Confirm: primary blue `--confirm` and a neutral ghost cancel, both ≥44px, stacked on mobile.
  - Processing: disabled with a spinner.
  - Success is `$ok` and failure is `$danger`.
- **Any QR rendered** is on a white background with dark modules.
- No change to the camera, `getUserMedia`, SignalR or redemption contracts.

## 4. Modal and state rules (all apps)

- Every modal needs `role="dialog"`, `aria-modal="true"`, a label, focus moved in on open and returned on close, Escape and backdrop close unless an action is in flight, and background scroll locked.
- Every list or table needs empty, loading, error and populated states. Use existing copy; don't invent new strings. If a state has no copy today, flag it to George.
- Controls are never colour-only: status badges and alerts always include text.
- `:focus-visible` is visible everywhere. Disabled is `.55` opacity and not clickable.
- Use no `transform` lifts or gradients, and honour reduced motion.

## 5. Order of work and verification

**Order.** Do shared tokens and components in Investor first (including `styles.scss`), then copy the same shared files into the other three. Then do per-screen SCSS, then the shared toast and confirm dialog in all four. Keep the human-edited `home.component.html` and `styles.scss` content.

**Automated checks (per app).**
- `npx ng build --configuration development` and the production build both pass.
- `rg -i "#(059669|047857|f0fdf4|06b6d4|0891b2|8b5cf6|a855f7|ec4899|10b981|0c4a6e|0369a1|bae6fd|1a56db)|linear-gradient"` over `src` returns nothing, except documented exceptions.
- `rg "z-index: *1000"` returns nothing.

**Manual and Playwright checks at 360×800, 768×1024 and 1440×1000.**
1. No horizontal viewport overflow on any route. Tables scroll only inside their wrapper.
2. All routes (listed above per app) plus every modal (Investor detail and QR, Company forms, confirm and scan, Admin approvals and confirm, Service scan) open, close with Escape and backdrop, and trap and return focus.
3. Keyboard Tab order is logical and the focus ring is visible on every control.
4. Touch targets ≥44px on primary controls. Check icon buttons, modal closes and card actions.
5. Contrast ≥4.5:1 for text and ≥3:1 for UI borders and icons, measured on badges, alerts, muted text, links and disabled controls.
6. States: loading, empty, error, success, validation, disabled and populated, using synthetic fixtures only.
7. Investor-specific: filters, cart add and remove, checkout container (no clipping), payment return success, failure and pending, and the QR is white with dark modules.
8. Service/Company scanner: permission, scanning, denied, found, confirm, cancel, success and failure. Do not trigger a real redemption.
9. Screenshot comparison against the brief's colours and spacing: 4/8px rhythm, 1120px page max-width, 24px/16px gutters, radii 12/16/8.
10. The diff contains no unrelated changes, and the human edits in `home.component.html` and `styles.scss` are preserved.

**Open item for the coordinator.** I did not inspect the home templates or the TypeScript bindings. If any template uses inline `style=` colours, grep for `style="` and `ngStyle` and fix them too.