# ServiceTokenAPI

Backend for the Service Token platform. Workspace-level conventions and the agent team live in
`../CLAUDE.md` and `../.claude/`.

## Commands

```bash
dotnet build ServiceTokenAPI.sln --nologo -v q
dotnet run --project ServiceTokenAPI          # http://localhost:5177 (profile "http"); Swagger at /swagger
dotnet ef migrations add <Name> --project ServiceTokenAPI
dotnet ef migrations script <From> <To> --project ServiceTokenAPI
```

Startup calls `db.Database.MigrateAsync()` — **running the app applies pending migrations** to the
database in the connection string `ServiceTokens`. Check which DB that is before `dotnet run`.

## Layout (`ServiceTokenAPI/`)

- `Controllers/` — `[ApiController]`, `api/[controller]`, explicit action routes (`GetAll`, `GetById/{id}`, `Login`, `create`, …).
  `ServiceTokenController` holds the token lifecycle: primary/secondary market, cart, buy, resell, cancel, `GetService` (redeem).
  `PaymentController`: `InitiateEmbeddedPaymentBatch`, provider `Callback`, `Return`, `GetStatus`.
- `Entities/` + `Configurations/` (Fluent API, one class per entity) + `DBContext/ServiceTokenDbContext.cs`.
- `Dto/` — request/response shapes mirrored by the Angular apps.
- `Enums/` — numeric values are mirrored by the UIs; never renumber.
- `Hubs/RedemptionHub.cs` at `/hubs/redemption` — server→client push only; `GetService` sends `ServiceResult`
  to the customer's `connectionId` from the QR payload.
- `Services/Flitt`, `Services/Tbc` — typed `HttpClient` payment clients; options in `Options/`.
- `Program.cs` — CORS from `Cors:AllowedOrigins` (with credentials, for SignalR), forwarded headers for Nginx,
  JSON `ReferenceHandler.IgnoreCycles`, Swagger always on.

## Gotchas

- Target framework is `net9.0` (the machine SDK is 10.x — fine for building).
- No auth middleware; `UseAuthorization()` is present but nothing is protected.
- Passwords are currently stored/compared in plaintext (see `UserController`); BCrypt is commented out.
- `appsettings*.json` is tracked — keep secrets in `dotnet user-secrets` / environment variables.
- `PPK Files/` holds an SSH key and is gitignored. Never read, move or commit it.

## Related repos

The four Angular apps (`../New/AdminUI`, `CompanyUI`, `CustomerUI`, `ServiceUI`) are separate repos with
their own Claude teams. They mirror this API's DTOs/enums by hand. This repo may **read** them
(`additionalDirectories` in `.claude/settings.json`) but never edits them: for a contract change, run the
`api-contract-sync` skill and hand each UI its change list.

## Claude Code team (`.claude/`)

The main session acts as Engineering Manager: it turns asks into specs, delegates, and **verifies** results
(re-runs the build, reads `git log`) before reporting.

| Agent | Use for |
|---|---|
| `product-manager` | Fuzzy ask → stories, acceptance criteria, API tickets, UI follow-ups (read-only) |
| `architect` | Entities, migrations, endpoint contracts, payment/redemption flows (read-only, opus) |
| `backend-engineer` | All code changes in this repo |
| `qa-tester` | xUnit tests; creates `ServiceTokenAPI.Tests` when first needed |
| `code-reviewer` | After non-trivial changes, before commit (read-only) |
| `security-reviewer` | Auth, passwords, payments, tokens, CORS, secrets; before releases (read-only, opus) |
| `product-verifier` | End of every user-facing feature: flow covered end to end (read-only) |
| `release-manager` | CHANGELOG, version, deploy runbook — never deploys |

Skills: `/check`, `/new-ticket`, `/new-feature`, `/api-contract-sync`, `pre-flight`, `db-design`.
Rules: `.claude/rules/workflow.md` (always), `.claude/rules/csharp.md` (C# files only).
Hooks: `git push` is blocked unless `dotnet build` passes; a Stop hook warns about uncommitted changes.
Delegate only when it pays — a small change is faster done directly.

## Conventions

- Commits: `<type>(api): <description>`; types `feat|fix|refactor|perf|test|docs|chore|security`. Push to `main`.
- Never commit `PPK Files/`, `bin/`, `obj/` or real secrets.
- Banned in new code: plaintext passwords, secrets in `appsettings*.json`, SQL string concatenation, editing an
  applied migration, breaking a DTO/enum/route without listing the affected UIs.
- Known risks (raise with George, don't fix silently): no auth middleware, plaintext passwords, tracked `appsettings.json`.
