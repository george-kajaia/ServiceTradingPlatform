# Workflow rules (always on)

## Before editing code
- Read `CLAUDE.md` and 1–2 existing components/services that do the same kind of thing; match them.
- Run `git status` — George often has uncommitted work. Don't stage or overwrite it.

## Significant changes (new screen or flow, payment/login change, >2 files)
- Plan first (plan mode or the `architect` agent). Once George approves, save the full plan to
  `docs/decisions/NNN-<slug>.md` (Status / Date / Context / Approach / Key files / API needs / Verification).
  Don't ask whether to — just write it.
- Small fixes, typos and style tweaks skip this.

## Before saying "done"
- `npx ng build --configuration development` passes.
- Any API call you added or changed matches `../../ServiceTokenAPI/ServiceTokenAPI/Controllers/` and `Dto/` (run `api-contract-sync`).
- For user-facing features dispatch `product-verifier`; for login/identity/QR scan / redemption changes, `security-reviewer`.
- Report the evidence: commands and results, `git log --oneline -1`, and anything not verified. No silent scope cuts.
- Record the work: update the decision doc (Status: Completed, what shipped, commits), or for small fixes add a
  dated entry at the top of `docs/CHANGELOG.md`.

## When George corrects the same mistake twice
Encode the fix where it belongs — a line in the relevant rule, skill or agent's constraints — and tell him what
you changed so he can veto it. Don't create rules from one-off preferences.
