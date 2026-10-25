AdminUI has 3 open bugs, all Low or Medium. Neither build warned, and login and the approve flows work. The dev run passed 531 of 541 browser assertions and the prod run passed 475 of 482. Every failing assertion belongs to one of the bugs below.

- **Dev build** (`ng build --configuration development`): passes with no warnings.
- **Production build**: passes with no warnings.
- **Browser runs**: the harness ran at 360x800, 768x1024 and 1440x1000, with mocked API fixtures. The fixtures covered the populated, empty, loading, error and retry states. I tested login, the Companies and Requests tabs with filters and approve, and toasts.
- **Network and console**: no request reached the real network. The 30 console errors in the dev run all come from the error fixtures I injected on purpose. The prod run has no unexpected console errors besides the service-worker warnings I caused by blocking the service worker.
- **Confirm dialog**: I tested it in the dev run only. Its dev-only hook doesn't exist in the prod build, and the Delete button isn't in the dashboard template.
- **Old brand colours**: none of the old cyan, green, violet or pink hex values, gradients or `z-index: 1000` remain in `src`.
- **Screenshots**: 54 dev and 51 prod, named by app, route, width and state.

## Open bugs
| ID | Severity | Where | Expected | Actual | Owner |
|---|---|---|---|---|---|
| BUG-1 | Low | `/dashboard`, "Active" and "Approved" badges, all viewports | Text contrast at least 4.5:1 | `.status--ok` (`#15803D` on `#E7F5EC`) measures 4.46:1 | frontend-engineer, `admin-dashboard.component.scss` (`.status--ok`) |
| BUG-2 | Medium | `/dashboard` Requests tab, 1440x1000, even with short names | Approve button reachable without horizontal scroll | Table scroll width is 1071px against a 1028px wrapper, so the Actions column and the Approve button are cut off | frontend-engineer, `admin-dashboard.component.scss` |
| BUG-3 | Low | Confirm dialog, all viewports | Focus returns to the button that opened it | After Escape or backdrop close, focus lands on the app root | frontend-engineer, `confirm-dialog.component.ts` |

I also noted, but did not count, that the focus ring on buttons (35% blue, no border change) is only about 1.7:1 against white. That comes from the shared design token, so it is a design decision.

## Not covered
- The `home` component, because it isn't routed.
- Real touch hardware, since I rewrote the `(pointer: coarse)` media query in the served bundles to simulate it.
- Real Inter font loading, because I stubbed Google Fonts.
- Safari and Firefox.
- Screen readers.
- Service-worker behaviour.
- Pixel equality to the concept reference.

I wrote only inside `docs/design-blue/`. Nothing is staged or committed.

Files are in `docs/design-blue/`:
- `qa-report.md`
- `QA-CHECKPOINT.md`
- `qa/harness.cjs`
- `results-dev.json`
- `results-prod.json`
- `screenshots/`

BUG_COUNT: 3