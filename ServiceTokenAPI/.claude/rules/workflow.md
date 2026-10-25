# Workflow rules (always on)

## Before editing code
- Read `CLAUDE.md` and 1–2 existing files that do the same kind of thing; match them.
- Run `git status` — George often has uncommitted work. Don't stage or overwrite it.

## Significant changes (new feature, migration, payment/auth change, >2 files)
- Plan first (plan mode or the `architect` agent). Once George approves, save the full plan to
  `docs/decisions/NNN-<slug>.md` (Status / Date / Context / Approach / Key files / UI follow-ups /
  Verification). Don't ask whether to — just write it.
- Small fixes, typos and config tweaks skip this.

## Before saying "done"
- `dotnet build ServiceTokenAPI.sln --nologo -v q` passes (and `dotnet test` once a test project exists).
- If the API contract changed, run the `api-contract-sync` skill and report the consumer files in each UI.
- For user-facing features dispatch `product-verifier`; for auth/payment/token changes, `security-reviewer`.
- Report the evidence: commands and results, `git log --oneline -1`, and anything not verified. No silent scope cuts.
- Record the work: update the decision doc (Status: Completed, what shipped, commits), or for small fixes add
  a dated entry at the top of `docs/CHANGELOG.md`.

## When George corrects the same mistake twice
Encode the fix where it belongs — a line in the relevant rule, skill or agent's constraints — and tell him
what you changed so he can veto it. Don't create rules from one-off preferences.
