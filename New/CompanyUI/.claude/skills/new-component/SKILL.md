---
name: new-component
description: Canonical way to add a standalone Angular component, page or overlay in CompanyUI — file layout, imports, routing, state handling, cleanup. Use before creating any new component.
---

# New component in CompanyUI

1. **Find the nearest sibling** under `src/app/features/<area>/` (or `src/app/shared/components/`) and copy its
   structure: `<name>.component.ts|html|scss`, selector prefix `app-`, `templateUrl` + `styleUrls`.
2. **Standalone:** `standalone: true` and an explicit `imports: [...]` (`CommonModule`/`NgIf`/`NgFor`, `FormsModule`,
   `RouterLink`, child components). Missing imports fail at build time.
3. **Wiring:** a page → add to `src/app/app.routes.ts`; an overlay/modal → used by the parent with `@Input()` data
   and an `@Output() closed` event (match existing overlays).
4. **Data:** inject the `core/api/*` service; never call `HttpClient` from a component. Typed models only.
5. **States:** loading flag, empty state, error → `ToastService`; disable buttons while submitting.
6. **Cleanup:** `takeUntilDestroyed()` or `ngOnDestroy` — stop the zxing camera reader.
7. **Styles:** reuse classes/variables from `src/styles.scss` and sibling SCSS; no new colors without the designer spec.
8. **Verify:** `npx ng build --configuration development`.
