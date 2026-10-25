---
name: new-ticket
description: Draft the next API-NNN ticket for ServiceTokenAPI and save it to docs/tickets/. Use when George asks to create, log or write up a ticket.
argument-hint: "\"<description of the ask>\""
disable-model-invocation: true
---

# /new-ticket

Ask: $ARGUMENTS

1. Find the highest `API-NNN` in `docs/tickets/` (create the folder if missing) and add 1.
2. Write `docs/tickets/API-NNN-<kebab-slug>.md` with the template below; report the path.
3. Under 200 words; split anything bigger than one engineer-day.

```markdown
# API-NNN: <imperative title>

**Status:** Todo
**Type:** feat | fix | refactor | test | chore | security
**Owner:** backend-engineer | qa-tester | george
**Estimate:** N hours

## Problem
<one sentence>

## Acceptance criteria
- [ ] <testable condition>

## Out of scope
- <explicitly not doing>

## Technical notes
<≤5 lines: files, patterns, migration, contract change + affected UIs>

## Definition of done
- [ ] /check green
- [ ] UI follow-ups listed (if contract changed)
- [ ] Reviewed (code-reviewer) and committed
```

Lifecycle: Todo → In Progress → Done (tick criteria) or Blocked (with reason).
