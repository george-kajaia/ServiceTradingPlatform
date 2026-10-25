The blue redesign is implemented across AdminUI. Both builds pass, but I haven't looked at any screen in a browser. The tree was clean before I started, so there were no human edits to merge. Nothing is staged or committed.

**Verification**
- The development build (`ng build --configuration development`) passes.
- The production build (`ng build --configuration production`) passes.
- A search of `src` for the old cyan/green/violet/pink/dark-navy colours, `linear-gradient` and `z-index: 1000` returned nothing. One earlier shell command was blocked, so I didn't run the search again after the final `manifest.webmanifest` edits. They only touched `src/manifest.webmanifest`, which the search doesn't cover for these colours.
- Not verified: the layout at 360, 768 and 1440 px, keyboard focus, contrast, and the modal and toast states. QA still has to check those in the browser.

**What changed**
- **Tokens:** the blue/ink/page/line/ok/danger/warn tokens, 44px control height, focus ring and shadows are in `src/styles/_variables.scss`. They are the shared tokens from the designer report.
- **Global styles:**
  - `src/styles/themes/_user.scss` is rewritten flat and blue: buttons, inputs, tables, tabs, badges, alerts, modal, card and page.
  - `src/styles/themes/_admin.scss` is remapped to the same blue tokens.
  - `src/styles/_base.scss` now has a page background, a visible focus ring and reduced-motion handling.
- **Routes:**
  - `/dashboard`: restyled with a scrollable table wrapper and a sticky header. Filters stack below 768px.
  - `/login`: restyled.
  - `/` (home): moved from dark navy to the light blue surface.
- **Toast and confirm dialog:**
  - Toast: white surface with a coloured left bar, bottom on mobile, 44px close button.
  - Confirm dialog: neutral backdrop, 16px radius, buttons stack below 480px.
- **Theme colours:** `index.html` and `manifest.webmanifest` theme and background colours are now blue and light.

**Template changes**
- **Stray text:** the dashboard template had the visible text "filteredRequests" in front of the heading. I removed it.
- **Class mismatch:** the dashboard SCSS targeted classes the template never used, so I restyled to the template's real classes.
- **Dashboard markup:** I added table scroll wrappers, text status badges and `aria-pressed` on the tabs.
- **Login:** I added `autocomplete` on the login inputs.

No bindings, API calls, TypeScript, dependencies or other apps were touched. I wrote `docs/design-blue/CHECKPOINT.md`.

**Remaining issues**
- Approve in the Companies table has no confirmation dialog, because adding one would change the approval flow.
- The Google Fonts `@import` in `styles.scss` was already there and I left it alone.