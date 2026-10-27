# CompanyUI blue redesign – CHECKPOINT (updated 2026-10-15, correction pass)

## State
Redesign + correction pass applied, all uncommitted/unstaged. Dev build PASS, production build PASS (run directly with `node node_modules/@angular/cli/bin/ng.js build --configuration development|production`).
Browser harness NOT rerun by me (QA agent owns it). git status was not run (shell denied it); no staging/commit done.

## Correction ledger (QA bugs B1–B7 + coordinator findings)
| ID | Fix | Files |
|---|---|---|
| B1 | New shared `ModalDialogDirective` (`appModalDialog`): focus in on open, document-level Tab/Shift+Tab trap, Escape (works from any focus), ref-counted html/body scroll lock, focus returned to opener on destroy, topmost-dialog-only key handling. Dashboard backdrop uses it; backdrop click closes. | `shared/directives/modal-dialog.directive.ts`, dashboard `.ts/.html` |
| B2 | Confirm dialog uses same directive (scroll lock + focus return to Delete button; existing trap/Escape kept). | `confirm-dialog.component.ts` |
| B3 | `modalSubmitting` (loading but not just fetching view/edit data) blocks Escape/backdrop/× /Cancel via `requestClose()`; buttons disabled while submitting. | dashboard `.ts/.html` |
| B4 | Price column/`dd` get `.num` (tabular-nums; table cells right-aligned). Values unchanged (zero still renders). | dashboard `.html/.scss` |
| B5 | `$ok` #15803D → #166534 (brief's corrected success). | `_variables.scss` |
| B6 | Shared focus ring now `0 0 0 2px #FFF, 0 0 0 4px #2563EB`; explicit focus ring on `.back-link` (login, dashboard) and footer logo; footer logo min-height 44px. | `_variables.scss`, login/dashboard/home scss |
| B7 | `aria-label` on Products/Users search inputs. Products Delete given `danger` class for consistency. | dashboard `.html` |
| Toast | `ToastService.error` falls back to "Something went wrong. Please try again." for empty/undefined/non-string messages (empty-body 500s). | `toast.service.ts` |
| Scanner | Real flow is automatic redemption: dead confirm/loading branch, `token`, display helpers removed; states `scanning → submitting → closed` + `error` (retry). Duplicate-decode guard before stop; payload parsed as `unknown` (null/array/primitive/wrong types → "missing required data", no POST; rowVersion 0 valid, uint range); dismissal (Escape/backdrop/×/Cancel) blocked while submitting; camera controls stopped if destroyed during startup. API params unchanged (3 args matches `service-token-api.service.ts`). Uses shared directive. | `scan-token.component.ts/.html` |

## Not changed / notes
- Scanner is still not mounted by any route/template (pre-existing); stale `ServiceTokenDto` model left (unused by reachable UI).
- Google Fonts `@import` in human-edited `styles.scss` untouched (remote asset; harness aborts it).
- Pre-existing: password input `type="text"`, no route guard.
- Not verified in browser by me: focus/scroll behaviour, 360/768/1440 visuals.
- Same directive/toast fix likely needed in the sibling apps (copied code) — not touched here.
