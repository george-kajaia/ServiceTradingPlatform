The blue redesign is applied across all InvestorUI routes and the shared dialogs and toasts. Both the development and production builds pass. I haven't opened it in a browser, so none of it has been checked visually at 360, 768 or 1440 wide. Nothing is staged or committed.

**Changes**
- **Tokens:** the shared blue tokens are in `src/styles/_variables.scss`, and every component reads from them. The local green palettes are gone. `src/styles.scss` now uses ink text on the `#F4F7FB` page, with a global focus ring and reduced-motion handling.
- **Screens restyled:**
  - Home: the hero, how-it-works, value, trust, FAQ and CTA sections are now flat blue and neutral. The footer is light, not dark.
  - Login.
  - Marketplace: the app bar (neutral logout, solid blue cart pill, 44px refresh), the filters, tabs and bottom nav, the token cards (1/2/3/4 columns, no lift on hover, 44px actions) and the detail modal (16px radius, 44px close, stacked actions on mobile).
  - QR modal: white tile with dark modules, fits at 360×800, with visible connecting, error and waiting text.
  - Cart.
  - Checkout: the Flitt container keeps a minimum height and scrolls instead of clipping.
  - Payment return.
  - Token detail.
  - Toast: top-right on desktop, bottom-center on mobile.
  - Confirm dialog: buttons stack on mobile.
- **Accessibility:**
  - The marketplace detail modal and the QR modal now have `role="dialog"` and labels.
  - The marketplace detail modal closes on Escape.
  - The cart remove button has an `aria-label`.
  - The QR modal has `status`/`alert` roles.
- **Colour outside the styles:** the QR dark modules changed from `#064e3b` to `#172033` (payload untouched). `index.html` theme-color and `manifest.webmanifest` colours are now blue. The unused `themes/_user.scss` token block is remapped to flat blue.
- **Left alone:** API calls, checkout status logic, SignalR cleanup and the human's removal of the test-mode notice in `home.component.html` and `styles.scss`.

**Verification**
- `node node_modules/@angular/cli/bin/ng.js build --configuration development` passes.
- `node node_modules/@angular/cli/bin/ng.js build --configuration production` passes.
- A search for the old palette hexes, gradients and `z-index: 1000` finds nothing in the app styles. It still finds the old colours in `themes/_admin.scss` and a `backdrop-filter` in `themes/_user.scss`; both files are unused by this app.

**Not done or not verified**
- Marketplace cards show no price. The detail modal has an unused price class and the cart does render prices, so I didn't add one to the cards.
- Cart and checkout keep their existing layouts. I did not add a sticky summary bar, because the cart has no summary element to attach one to.
- Only the marketplace detail modal closes on Escape; the QR modal's Escape and focus-return behaviour is unchanged, so QA should check it.
- Progress notes are in `docs/design-blue/CHECKPOINT.md`.

The edits to `index.html` and `manifest.webmanifest` weren't in the designer's list; they are colour changes only.