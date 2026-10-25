---
name: check
description: Build (and test, once a runner exists) CustomerUI, fix failures and loop until green. Use before every commit and after a subagent reports "done".
allowed-tools: Bash(git status*), Bash(npx ng build*), Bash(npx ng test*), Bash(npm run build*)
---

# /check

## Current state
!`git status --short || true`

## Steps
1. `npx ng build --configuration development`
2. If a test runner is configured: `npx ng test --watch=false`
3. Before a release: `npm run build` (production budgets and AOT checks are stricter).
4. On failure: read the **first** error, fix the cause, re-run that step. Never skip ahead.

## Rules
- Never "fix" by deleting a test, weakening an assertion, `// @ts-ignore`, or raising budgets without asking.
- Don't commit while red. Finish with ✅/❌ per step.
