# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development server
npm start          # ng serve

# Production build
npm run build      # output: dist/service-token-company-ui

# Watch mode (development build)
npm run watch
```

There are no test scripts configured in this project.

## Architecture

### Tech Stack
- **Angular 17** with **standalone components** throughout (no NgModules)
- **Angular Signals** for reactive UI state (toast, dialog services)
- **RxJS** for HTTP observables
- **SCSS** for styling
- **PWA** with service worker (`ngsw-config.json`)
- **@zxing/browser** for QR code scanning via device camera

### Application Bootstrap
`main.ts` uses `bootstrapApplication` (not `AppModule`). Providers are configured there: `provideRouter`, `provideHttpClient`, `provideAnimations`, `provideServiceWorker`.

### Routing (`app.routes.ts`)
| Path | Component |
|---|---|
| `` | `HomeComponent` |
| `login` | `CompanyLoginComponent` |
| `dashboard` | `CompanyDashboardComponent` |
| `**` | redirect to `` |

No auth guards are configured on routes.

### State Management (`core/state/`)
Three thin signal-based state services hold authenticated user data in memory (no persistence):
- `CompanyStateService` — current `CompanyUser` + `Company`
- `CustomerStateService` — current `Customer`
- `AdminStateService` — current `AdminUser`

### API Layer (`core/api/`)
All services are `providedIn: 'root'` and call `${environment.apiBaseUrl}/[Controller]` via `HttpClient`. Base URL is `https://service-tokens.com/api` (production). All params are passed as query strings, never in the request body, even for POST endpoints.

Key service: `ServiceTokenApiService` — covers the full service-token lifecycle: primary/secondary market listing, buy, resell, cancel, and `getService` (confirms token usage; triggers server-side SignalR notification to the customer).

### Features

**`company/dashboard`** — The main authenticated view. Contains tabs for Requests and Products, with inline modal panels for CRUD. Also hosts the `ScanTokenComponent` overlay.

**`company/scan-token`** — QR scanning flow with explicit state machine:
`scanning → loading → confirm → submitting → (closed)`
(or `→ error → scanning` via rescan).
The QR payload JSON shape is `{ tokenId, rowVersion, connectionId }`. On confirm, calls `getService(tokenId, rowVersion, companyId, connectionId)` where `companyId` comes from the fetched `ServiceTokenDto`.

**`auth/company-login`** — Handles both login and registration in a single component with mode switching.

### Shared UI (`shared/components/`)
- `ToastComponent` + `ToastService` — signal-based, rendered once in `AppComponent`; supports `success`, `error`, `info`, `warning`, `errorWithRetry`
- `ConfirmDialogComponent` + `DialogService` — signal-based modal, rendered once in `AppComponent`; manages focus trap and keyboard navigation

### Environment
`src/environments/environment.ts` is the only environment file (no `environment.development.ts`). The `apiBaseUrl` may need switching between the EC2 host and the production domain during development.

### Deployment
- Target: `https://company.service-tokens.com`
- Suggested server path: `/var/www/ServiceTokenUI/company` on EC2
- Build output: `dist/service-token-company-ui`

## Related repos

The backend is **ServiceTokenAPI** at `../../ServiceTokenAPI` — a separate repo with its own Claude team.
It is the source of truth for routes, parameter binding, DTO fields and enum numbers. This repo may **read** it
(`additionalDirectories` in `.claude/settings.json`) but never edits it: if the UI needs an API change, write the
request for George to run in the API repo. AdminUI, CompanyUI, CustomerUI and ServiceUI share copied code.

## Claude Code team (`.claude/`)

The main session acts as Engineering Manager: it turns asks into specs, delegates, and **verifies** results
(re-runs the build, reads `git log`) before reporting.

| Agent | Use for |
|---|---|
| `product-manager` | Fuzzy ask → stories, acceptance criteria, tickets, API needs (read-only) |
| `architect` | Routes, component structure, state, API methods/models for a new flow (read-only, opus) |
| `designer` | Screen specs: layout, states, copy, accessibility (read-only) |
| `frontend-engineer` | All code changes in this repo |
| `qa-tester` | Angular unit tests (proposes a runner setup first — none configured yet) |
| `code-reviewer` | After non-trivial changes, before commit (read-only) |
| `security-reviewer` | Login/identity, QR scan / redemption, config; before releases (read-only, opus) |
| `product-verifier` | End of every user-facing feature: real user flow works (read-only) |
| `release-manager` | CHANGELOG, version, deploy runbook — never deploys |

Skills: `/check`, `/new-ticket`, `/new-feature`, `/api-contract-sync`, `pre-flight`, `new-component`.
Rules: `.claude/rules/workflow.md` (always), `.claude/rules/angular.md` (`src/**` only).
Hooks: `git push` is blocked unless `ng build` passes; a Stop hook warns about uncommitted changes.
Delegate only when it pays — a small change is faster done directly.

## Conventions

- Commits: `<type>(company): <description>`; types `feat|fix|refactor|perf|test|docs|chore|security`. Push to `main`.
- Banned in new code: `any`, hard-coded API URLs outside `src/environments/`, sensitive data in web storage,
  `innerHTML` on user content, models that drift from the API DTOs.
- The API has no authentication: the UI is never a security boundary.
