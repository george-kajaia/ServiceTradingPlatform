# AdminUI blue redesign - checkpoint
Status: correction pass 1 applied; dev + production builds pass. Not staged or committed (per instructions). Browser re-QA is for the QA agent.

Files (original pass): src/styles/_variables.scss, _base.scss, themes/_user.scss, themes/_admin.scss; admin-dashboard (scss+html), admin-login (scss+html), home scss, toast scss, confirm-dialog scss; index.html and manifest theme colours.

## Correction ledger
| Finding | Fix | File |
|---|---|---|
| BUG-1 `.status--ok` contrast 4.46:1 | `$ok` #15803D -> #166534 (about 6.7:1 on #E7F5EC); brand blue unchanged | `_variables.scss` |
| BUG-2 Approve clipped at 1440 | `.grid--wide` min-width 960 -> 720; non-key cells (names, dates) wrap; Id/count/status/actions stay nowrap; mobile still scrolls inside `.table-scroll` | `admin-dashboard.component.scss` |
| BUG-3 focus not restored after dialog close | Dialog records the opener on open, restores focus on close. Also locks body scroll while open and restores it on close/destroy | `confirm-dialog.component.ts` |
| Weak button focus ring (about 1.7:1) | `$focus-ring` now a 2px white + 2px #2563EB double ring; input blue borders untouched | `_variables.scss` |
| Empty/undefined error toast | `ToastService.error` falls back to "Something went wrong. Please try again." for missing, blank or over-200-char messages | `toast.service.ts` |

Not changed: toast at 768px (valid desktop layout), native Tab to body.
Unverified: no browser run by me; wrapping at 1440 checked by CSS reasoning only. Other apps share copied code (toast, tokens) and need the same fixes.
