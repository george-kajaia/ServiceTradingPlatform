# Blue design rollout

Status: Authorized, in progress
Date: 2026-10-14 (Asia/Tbilisi)

The user selected the blue marketplace concept and authorized implementation and testing through the existing Claude agents. Codex coordinates and independently verifies. All four Angular UI apps are in scope. The backend and TestAPI are not changed. Preserve the user's pre-existing working changes. No commits, pushes, deployment, real purchases, or real redemption.

## Reference and concrete design contract

Selected concept: `C:/Users/georg/.codex/visualizations/2026/10/14/01a13bcf-2fba-74c1-946c-471991a11d75/service-token-directions.html`, first variant, blue clear marketplace. This is a direction reference, with illustrative data, not a complete pixel reference for all four apps. Keep real product information, functionality, current UI language and existing Angular bindings.

- Primary #2563EB, hover #1D4ED8, primary subtle #EAF1FF.
- Text #172033, secondary #596779, page #F4F7FB, surfaces #FFFFFF, borders #E0E6EE.
- Success #166534 (QA-corrected from #15803D to meet AA on #E7F5EC), danger #B91C1C, warning #92400E. Status labels accompany colors. Success green is semantic, not the primary brand.
- One shared visual language across all apps, replacing the cyan/green/violet/pink brand variants and unnecessary gradients with blue and neutral surfaces.
- 4/8px spacing rhythm. Page max width 1120px; desktop page gutters 24px, mobile 16px. Form/field spacing 12–16px, panels 20–24px desktop / 16px mobile. Cards 12px radius, large panels 16px, controls 8px. Subtle border and restrained shadow.
- Consistent existing Inter/system sans-serif stack. Body 14–16px, secondary >=12px, headings clear, aligned price numbers. No new remote assets needed.
- QA-corrected common focus ring: `0 0 0 2px #FFFFFF, 0 0 0 4px #2563EB` so button keyboard focus remains clear on light surfaces. Inputs keep their blue focus border. All four apps should use the same corrected shared token values.
- Primary controls have >=44px effective touch height, visible keyboard focus, readable disabled/hover/loading states. Solid blue buttons with white text. Neutral bordered secondary controls. Links must be readable on their actual surface.
- CustomerUI: bright service marketplace, clear cards with company/product/price/uses/validity, orderly filters, coherent cart/detail/checkout/payment-return/QR modal and auth/landing screens. Do not invent trading charts or fictitious product data.
- CompanyUI: calm requests/products/users tables, useful action hierarchy, responsive forms/dialogs, blue auth/landing/scanner treatment.
- AdminUI: dense neutral management surfaces, clear company/request tables and approval controls, blue auth treatment.
- ServiceUI: mobile-first scanning workflow, prominent camera/scanner action, clear scanning/processing/error/success outcomes, blue auth/landing. Source audit confirms the actual flow automatically redeems after reading a valid QR; preserve it and remove stale unreachable manual-confirm markup (see coordinator-findings.md). Any displayed QR uses a white background and dark modules for reliable reading. Do not change camera or redemption API contracts.

## Verification and pixel precision

Inspect each route and modal at 360x800, 768x1024, 1440x1000. No viewport overflow (tables may scroll within an explicitly contained wrapper), no overlaps, clipped labels/buttons or inaccessible dialogs. Check loading, empty, error, success, validation, disabled, focus, populated data. Review screenshot evidence against this spacing/color contract and the selected reference; do not claim a complete Figma-equivalent pixel match without a complete reference.

Both development and production builds must pass in each app. Claude QA writes/runs repeatable isolated local browser tests using bundled Playwright and headless Chrome with synthetic API fixtures; no production mutations. Test route navigation, modal open/close, filters, cart/checkout presentation, scanner states and forms. Do not add a dependency/test runner unnecessarily. Record exact findings/repro steps. Frontend agents fix design/regression findings, QA reruns until no reproducible bugs remain in the tested scope. Existing backend/security issues outside the redesign are recorded separately, not silently changed.

## Context policy

Each agent is a separate Claude CLI session, launched as its existing named role and configured model. The coordinator calibrates context capacity from CLI modelUsage.contextWindow, tracks per-message input+cache+output tokens (active context, not cumulative billing), and terminates the session at >=80%. Work resumes in a fresh session with this brief, on-disk phase reports and current diff. Agents maintain a short CHECKPOINT.md in their own app docs/design-blue directory when allowed to write. QA writes testing artifacts only; application fixes stay with frontend-engineer.

## Evidence locations

Coordinator logs and reports: docs/design-blue/runs/
Each app reports/checkpoints/tests: New/<App>/docs/design-blue/
Baseline patches: docs/design-blue/baseline/
