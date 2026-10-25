---
name: pre-flight
description: Pre-coding checklist before non-trivial implementation in ServiceTokenAPI — use before writing more than ~30 lines, adding a file, adding a migration, or refactoring. Forces stated assumptions, the smallest version, surgical file scope, and a verification command defined up front.
---

# Pre-flight

Post this gate in chat **before** writing code:

> **Pre-flight**
> - **User flow:** <role> does <A, B> through <endpoints>, and then can read <X, Y> back.
> - **Assumptions:** 2–4 bullets. If one could go two ways, stop and ask.
> - **Smallest version:** minimum change (~N lines)? What did I almost add and cut?
> - **Files:** each file + one line on why the ask requires it.
> - **Contract:** does a route / binding / DTO / enum change? If yes → which UIs (`api-contract-sync`), breaking or additive?
> - **Success check:** exact command(s) and expected result, e.g.
>   `dotnet build ServiceTokenAPI.sln --nologo -v q` → 0 errors;
>   `curl "http://localhost:5177/api/ServiceToken/GetPrimaryMarketServiceTokens?take=1"` → 200 with field `x`.

While coding: no drive-by reformatting, renames or "while I'm here" refactors; no abstraction used in only one place.

After coding: run the success check, `git status` (only intended files), commit.
