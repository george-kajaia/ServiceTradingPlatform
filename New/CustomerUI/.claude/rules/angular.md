---
paths:
  - "src/**/*.ts"
  - "src/**/*.html"
  - "src/**/*.scss"
---

# Angular rules

- Standalone components only; add new components to the route table or the parent's `imports`.
- Models in `src/app/shared/models/` mirror API DTOs — check the C# DTO in `../../ServiceTokenAPI`, not memory.
- AdminUI, CompanyUI, CustomerUI and ServiceUI are separate repos with copied code (toast, dialog, api services).
  A fix here may be needed in the others — mention it to George instead of assuming.
- `src/environments/environment.ts` has commented localhost lines. Don't commit it switched to localhost.
- Payment and checkout code: never mark a payment successful client-side; always read the status back from the API.
