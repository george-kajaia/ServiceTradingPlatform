---
name: new-feature
description: Orchestrate a full backend feature in ServiceTokenAPI with this repo's agent team — spec, design, implementation, tests, review, verification, UI hand-off — with gates between steps. Use only for genuinely multi-step features.
argument-hint: "\"<feature description>\""
disable-model-invocation: true
---

# /new-feature — backend slice

Feature: $ARGUMENTS

You (the main session) are the Engineering Manager. Dispatch each step, **check its output before moving
on**, and stop at a failed gate. Skip steps that don't apply and say so.

1. **Scope** → `product-manager`: PRD, API tickets, UI follow-ups. **Gate:** George approves.
2. **Design** → `architect`: entities, migration, endpoint contracts, UI impact, security notes.
   **Gate:** contract agreed. Save to `docs/decisions/NNN-<slug>.md`.
3. **Build** → `backend-engineer`. **Gate:** you re-run `dotnet build` and read the new migration yourself.
4. **Tests** → `qa-tester` for anything with money, token state or payments. **Gate:** tests run green.
5. **Review** → `code-reviewer` (always), `security-reviewer` (auth, payments, tokens, config). Apply Critical/Major fixes.
6. **Verify** → `product-verifier`. **Gate:** SHIP.
7. **Hand off** → `api-contract-sync`: per-UI change list + paste-ready prompt for each UI repo's Claude session.
8. **Close out** → `/check`, `git log --oneline -3`, decision doc → Completed. Pushing is George's call.

For a change of a few files, skip this and do it directly or with `backend-engineer` alone.
