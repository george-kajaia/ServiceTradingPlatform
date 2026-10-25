# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm start         # Dev server at http://localhost:4200 (uses development config)
npm run build     # Production build → dist/service-token-customer-ui
npm run watch     # Build in watch mode (development)
```

No test runner is configured in this project.

## Architecture Overview

**Angular 17 standalone components** — no NgModules anywhere. Everything uses `standalone: true` with explicit `imports: []` arrays.

Bootstrapped in [src/main.ts](src/main.ts) with `bootstrapApplication`, providing `HttpClient`, `Router`, `Animations`, and `ServiceWorker` globally.

### Layers

**`core/api/`** — Thin `HttpClient` wrappers, one service per backend controller. All API calls use query params (no request bodies for reads). Base URL comes from `environment.apiBaseUrl`.

**`core/services/`** — Cross-cutting concerns:
- `SignalRService` — manages a single HubConnection lifecycle (`connect()` returns `connectionId`, caller must `disconnect()` in `ngOnDestroy`)
- `ToastService` — imperative toast notifications
- `DialogService` — imperative confirm dialogs

**`core/state/`** — Simple injectable state holders (plain classes, no signals/BehaviorSubjects). `CustomerStateService.customer` is the logged-in customer.

**`features/`** — Feature components grouped by domain. All are standalone and routed directly in [src/app/app.routes.ts](src/app/app.routes.ts).

**`shared/models/`** — Pure interfaces and enums. `ServiceTokenDto` extends `ServiceToken` and adds `companyName`/`productName`.

### Routes

| Path | Component |
|---|---|
| `/` | `HomeComponent` |
| `/login` | `CustomerLoginComponent` |
| `/marketplace` | `CustomerMarketplaceComponent` |
| `/cart` | `CartComponent` |
| `/checkout` | `CheckoutComponent` (Flitt embedded checkout) |
| `/payment/return` | `PaymentReturnComponent` |
| `/token/:id` | `TokenDetailComponent` |

### QR / Get-Service Flow

[get-service.component.ts](src/app/features/customer/get-service/get-service.component.ts) is a modal overlay that:
1. Opens a SignalR connection and gets a `connectionId`
2. Encodes `{ tokenId, companyId, rowVersion, connectionId }` as JSON into a QR code
3. Waits for a `ServiceResult` SignalR event, then emits `closed` with the result

The component is used as an overlay inside both `CustomerMarketplaceComponent` and `TokenDetailComponent`.

### Environment / API

[src/environments/environment.ts](src/environments/environment.ts) holds `apiBaseUrl` and `signalRHubUrl`. Both point to `https://service-tokens.com` in production. Uncomment the `localhost` lines for local backend development.

The app is a PWA (service worker enabled in production builds via `ngsw-config.json`).

### Deployment

- Target URL: `https://customer.service-tokens.com`
- EC2 path: `/var/www/ServiceTokenUI/Customer`
- Build output: `dist/service-token-customer-ui`

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
| `security-reviewer` | Login/identity, checkout / payments / redemption, config; before releases (read-only, opus) |
| `product-verifier` | End of every user-facing feature: real user flow works (read-only) |
| `release-manager` | CHANGELOG, version, deploy runbook — never deploys |

Skills: `/check`, `/new-ticket`, `/new-feature`, `/api-contract-sync`, `pre-flight`, `new-component`.
Rules: `.claude/rules/workflow.md` (always), `.claude/rules/angular.md` (`src/**` only).
Hooks: `git push` is blocked unless `ng build` passes; a Stop hook warns about uncommitted changes.
Delegate only when it pays — a small change is faster done directly.

## Conventions

- Commits: `<type>(customer): <description>`; types `feat|fix|refactor|perf|test|docs|chore|security`. Push to `main`.
- Banned in new code: `any`, hard-coded API URLs outside `src/environments/`, sensitive data in web storage,
  `innerHTML` on user content, models that drift from the API DTOs.
- The API has no authentication: the UI is never a security boundary.
