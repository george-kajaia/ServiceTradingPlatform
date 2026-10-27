# CLAUDE.md — ServiceUI

Redemption scanner used by company staff to redeem customers' service tokens. Split out of
CompanyUI, so much of the code is shared/copied from there. Workspace conventions and the agent
team live in `../../CLAUDE.md` and `../../.claude/`.

## Commands

```bash
npm install
npm start                                   # ng serve → http://localhost:4200
npx ng build --configuration development    # verification build
npm run build                               # production → dist/service-token-service-ui
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
`main.ts` uses `bootstrapApplication` (not `AppModule`). Providers: `provideRouter`, `provideHttpClient`,
`provideAnimations`, `provideServiceWorker`.

### Routing (`app.routes.ts`)
| Path | Component |
|---|---|
| `` | `HomeComponent` |
| `login` | `ServiceLoginComponent` (`features/auth/service-login`) |
| `scan` | `ServiceScanComponent` (`features/service/scan`) |
| `**` | redirect to `` |

No auth guards are configured on routes.

### State (`core/state/`)
`CompanyStateService` holds the logged-in `CompanyUser` + `Company` in memory (no persistence).

### API Layer (`core/api/`)
`CompanyApiService` and `ServiceTokenApiService`, both `providedIn: 'root'`, calling
`${environment.apiBaseUrl}/<Controller>`. Key call: `getService(serviceTokenId, rowVersion, connectionId)`
→ `POST /api/ServiceToken/GetService`, which redeems the token and pushes a SignalR `ServiceResult`
to the customer's QR screen.

### Features
- **`service/scan`** — page hosting the scanner overlay.
- **`service/scan-token`** (`ScanTokenComponent`) — QR scanning state machine
  `scanning → loading → confirm → submitting → (closed)` (or `→ error → scanning`).
  QR payload JSON: `{ tokenId, rowVersion, connectionId }` (CustomerUI also sends `companyId`).
  Always stop the camera reader in `ngOnDestroy`.

### Shared UI (`shared/components/`)
`ToastComponent` + `ToastService`, `ConfirmDialogComponent` + `DialogService` — signal-based, rendered once in `AppComponent`.

### Environment
`src/environments/environment.ts` is the only environment file; it holds `apiBaseUrl` with a commented local alternative.

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

- Commits: `<type>(service): <description>`; types `feat|fix|refactor|perf|test|docs|chore|security`. Push to `main`.
- Banned in new code: `any`, hard-coded API URLs outside `src/environments/`, sensitive data in web storage,
  `innerHTML` on user content, models that drift from the API DTOs.
- The API has no authentication: the UI is never a security boundary.
