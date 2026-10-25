---
paths:
  - "ServiceTokenAPI/**/*.cs"
  - "ServiceTokenAPI/**/*.csproj"
  - "ServiceTokenAPI/appsettings*.json"
---

# C# / API rules

- Changing anything in `Entities/` or `Configurations/` ⇒ follow the `db-design` skill and add a migration.
- Changing anything in `Dto/`, `Enums/`, a controller route or action signature ⇒ run `api-contract-sync`.
- `appsettings*.json` is tracked in git: never add real secrets; use `dotnet user-secrets` (the project has a
  `UserSecretsId`) or environment variables, and leave placeholders in the file.
- Startup runs `MigrateAsync()`; a bad migration breaks production on the next deploy. Read every generated migration.
- Don't return whole entities that contain secrets (e.g. `User.Password`) — project to a DTO.
