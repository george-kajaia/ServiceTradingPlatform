---
name: new-ticket
description: Draft the next SRV-NNN ticket for ServiceUI and save it to docs/tickets/. Use when George asks to create, log or write up a ticket.
argument-hint: "\"<description of the ask>\""
disable-model-invocation: true
---

# /new-ticket

Ask: $ARGUMENTS

1. Find the highest `SRV-NNN` in `docs/tickets/` (create the folder if missing) and add 1.
2. Write `docs/tickets/SRV-NNN-<kebab-slug>.md` with the template below; report the path.
3. Under 200 words; split anything bigger than one engineer-day.

```markdown
# SRV-NNN: <imperative title>

**Status:** Todo
**Type:** feat | fix | refactor | test | chore | security
**Owner:** frontend-engineer | designer | qa-tester | george
**Estimate:** N hours

## Problem
<one sentence>

## Acceptance criteria
- [ ] <testable condition, from the user's screen>

## Out of scope
- <explicitly not doing>

## Technical notes
<≤5 lines: routes, components, API endpoints (and any API change needed)>

## Definition of done
- [ ] /check green
- [ ] API calls match ServiceTokenAPI
- [ ] Reviewed (code-reviewer) and committed
```

Lifecycle: Todo → In Progress → Done (tick criteria) or Blocked (with reason).
