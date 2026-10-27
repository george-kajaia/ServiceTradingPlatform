---
name: new-feature
description: Orchestrate a full feature in CustomerUI with this repo's agent team — spec, design, UI spec, implementation, tests, review, verification — with gates between steps. Use only for genuinely multi-step features.
argument-hint: "\"<feature description>\""
disable-model-invocation: true
---

# /new-feature — CustomerUI slice

Feature: $ARGUMENTS

You (the main session) are the Engineering Manager. Dispatch each step, **check its output before moving on**,
and stop at a failed gate. Skip steps that don't apply and say so.

1. **Scope** → `product-manager`: PRD, tickets, API needs. **Gate:** George approves.
   If API needs exist: stop here until the ServiceTokenAPI change is done (George runs it in that repo).
2. **Structure** → `architect`: routes, components, state, API methods. **Gate:** contract matches the API.
   Save to `docs/decisions/NNN-<slug>.md`.
3. **UI spec** → `designer` (only if there's visible UI). **Gate:** George approves copy/layout.
4. **Build** → `frontend-engineer`. **Gate:** you re-run `npx ng build --configuration development` yourself.
5. **Tests** → `qa-tester` (once a runner exists) for services and state machines.
6. **Review** → `code-reviewer` (always), `security-reviewer` (login, identity, checkout / payments / redemption). Apply Critical/Major fixes.
7. **Verify** → `product-verifier`. **Gate:** SHIP.
8. **Close out** → `/check`, `git log --oneline -3`, decision doc → Completed. Pushing is George's call.

For a change of a few files, skip this and do it directly or with `frontend-engineer` alone.
