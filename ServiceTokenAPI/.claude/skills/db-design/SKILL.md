---
name: db-design
description: Data-model and migration discipline for ServiceTokenAPI (EF Core 9 + PostgreSQL/Npgsql). Use before adding or changing an entity, property, relation, enum, index or EF Core migration.
---

# DB design — EF Core 9 + PostgreSQL

State the key decisions and why in chat before editing.

## 0. Match what exists
Open a similar entity in `ServiceTokenAPI/Entities/` and its
`Configurations/<Entity>Configuration.cs`. Configure with the Fluent API in the configuration class,
registered the same way the others are in `DBContext/ServiceTokenDbContext.cs`.

## 1. Types
- Money / prices / quantities that can be fractional → `decimal` with `HasPrecision(18, 2)` (or match neighbors). Never `double`.
- Timestamps → `DateTime` in UTC (`DateTime.UtcNow`); Npgsql maps to `timestamp with time zone`.
- Enums → C# enum in `Enums/`; keep existing storage (int) unless there's a reason; **never renumber** existing members — the UIs mirror the numbers.
- Strings → set `HasMaxLength` for names/codes; required unless genuinely optional.
- Concurrency-sensitive rows (tokens, payments) → keep/add a concurrency token (`RowVersion` / `xmin`) and handle `DbUpdateConcurrencyException`.

## 2. Integrity
- Explicit FK + `OnDelete` (`Restrict` by default for business data; `Cascade` only for owned children).
- Natural keys → `HasIndex(...).IsUnique()`.
- Index every column used in `Where`/`OrderBy` on hot paths (market listings, by company, by customer, by status).
- Prefer status changes over hard deletes for tokens, payments, requests.

## 3. Transactions
Multi-row invariants (token ownership change + operation log + payment status) go in one
`SaveChangesAsync` or an explicit `BeginTransactionAsync`. Call external payment APIs **outside** the transaction.

## 4. Migration workflow
1. `dotnet ef migrations add <Name> --project ServiceTokenAPI`
2. Read the generated `Up`/`Down`. Check for unintended drops/renames (EF sometimes emits drop+add for a rename — fix with `RenameColumn`).
3. Narrowing types, new `NOT NULL` on existing rows, or a unique index on possibly-duplicate data needs a backfill/default step in the migration.
4. Never edit an applied migration; never run `dotnet ef database update` (startup applies migrations — possibly to prod).
5. `dotnet build ServiceTokenAPI.sln` must pass.

## 5. Output
The decision and the trade-off. If a choice could go two ways (JSON column vs table, cached vs computed), name both and recommend one.
