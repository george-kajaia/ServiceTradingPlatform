---
name: api-contract-sync
description: Bring CustomerUI's API service wrappers and models in line with ServiceTokenAPI. Use when an API change is announced, when adding or changing a call in src/app/core/api, or when a call fails with 400/404/415 or returns unexpected fields.
argument-hint: "[endpoint, DTO or enum name]"
---

# UI ← API contract sync

Target: $ARGUMENTS

The API is a separate repo (`../../ServiceTokenAPI`, read-only here). It is the source of truth.

1. **API side.** In `../../ServiceTokenAPI/ServiceTokenAPI/`: the controller action (route `api/<Controller>/<Action>`,
   verb, `[FromQuery]` vs `[FromBody]`, return type), the DTO/entity, enums. JSON is camelCase; enums are numbers
   unless `Program.cs` configures a string converter.
2. **UI side.**
   ```bash
   grep -rn "<Action>\|<DtoName>\|<EnumName>" src/app --include=*.ts
   ```
3. **Diff table** in chat:

   | UI file | Current | API says | Fix |
   |---|---|---|---|
4. **Fix** `core/api/*-api.service.ts` (URL, `HttpParams` vs body), `shared/models/*` (fields, optionality, enum
   values), then the components that use them.
5. **Verify:** `npx ng build --configuration development`; grep again — nothing left on the old shape.
6. **API gaps:** if the UI needs something the API doesn't provide, don't fake it client-side — write the API
   request for George to run in the ServiceTokenAPI repo.
