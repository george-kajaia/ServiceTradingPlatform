---
name: api-contract-sync
description: Find every Angular UI that consumes an API endpoint, DTO or enum and produce the change list for each UI repo. Use whenever a controller route, action parameter binding, DTO, returned entity or enum changes in ServiceTokenAPI.
argument-hint: "[endpoint, DTO or enum name]"
---

# API → UI contract impact

Target: $ARGUMENTS

The UIs are separate repos with their own Claude teams. This repo's job is to change the API safely
and hand each UI an exact change list — **don't edit `../New/*`** (settings deny it).

1. **API side.** The controller action (route, verb, `[FromQuery]`/`[FromBody]`, return type), the DTO/entity,
   enums. JSON is camelCase; enums serialize as numbers unless a converter is configured — check `Program.cs`.
2. **Consumers.**
   ```bash
   grep -rn "<Controller>/<Action>\|<DtoName>\|<EnumName>" ../New/*/src/app --include=*.ts
   ```
3. **Impact table** in chat (and in the decision doc, if there is one):

   | App | File | Change needed | Breaking? |
   |---|---|---|---|
4. **Prefer additive.** Each UI deploys separately, so a rename/removal breaks deployed UIs until they ship.
   For a breaking change, propose an additive bridge (keep the old field/route until all UIs move).
5. **Hand-off text** per app, ready to paste into that repo's Claude session:
   `"API contract change: <what>. Update <files> per this table, then build."`
