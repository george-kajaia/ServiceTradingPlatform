---
name: check
description: Build (and test, once tests exist) ServiceTokenAPI, fix failures and loop until green. Use before every commit and after a subagent reports "done".
allowed-tools: Bash(git status*), Bash(dotnet build*), Bash(dotnet test*)
---

# /check

## Current state
!`git status --short || true`

## Steps
1. `dotnet build ServiceTokenAPI.sln --nologo -v q`
2. If a test project exists in the `.sln`: `dotnet test ServiceTokenAPI.sln --nologo`
3. If the model changed: confirm a new migration exists in `ServiceTokenAPI/Migrations/` and read its `Up`/`Down`.
4. On failure: read the **first** error, fix the cause, re-run that step. Never skip ahead.

## Rules
- Never "fix" by deleting a test, weakening an assertion, or `#pragma warning disable`.
- Don't commit while red. Finish with ✅/❌ per step.
