---
name: pre-flight
description: Pre-coding checklist before non-trivial implementation in CompanyUI — use before writing more than ~30 lines, adding a component or file, or refactoring. Forces stated assumptions, the smallest version, surgical file scope, and a verification step defined up front.
---

# Pre-flight

Post this gate in chat **before** writing code:

> **Pre-flight**
> - **User flow:** company user opens <route>, does <A, B>, and then sees <X, Y>.
> - **Assumptions:** 2–4 bullets. If one could go two ways, stop and ask.
> - **Smallest version:** minimum change (~N lines)? What did I almost add and cut?
> - **Files:** each file + one line on why the ask requires it.
> - **API:** which endpoints are called; do they exist with this exact route/binding/shape in ServiceTokenAPI?
> - **Success check:** `npx ng build --configuration development` passes, plus the manual check
>   (e.g. "on `/route`, clicking X shows Y; API error shows the error toast").

While coding: no drive-by reformatting, renames or "while I'm here" refactors; no abstraction used in only one place.

After coding: run the success check, `git status` (only intended files), commit.
