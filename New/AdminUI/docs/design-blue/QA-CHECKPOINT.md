# AdminUI QA checkpoint
- [x] Round 1: harness written, found BUG-1/2/3.
- [x] Round 2 (2026-10-15): harness updated for #166534 token, settled focus, parent-width filters, dialog focus/scroll, empty-body toast.
- [x] Dev + prod builds exit 0.
- [x] Dev run 559/559, prod run 488/488, 0 unexpected console errors (SW-blocked warnings are harness-caused), 0 remote requests.
- [x] qa-report.md written. Open bugs: 0.
Rerun: `node docs/design-blue/qa/harness.cjs dev`; prod: build to `docs/design-blue/qa/_dist/prod`, then `harness.cjs prod <dir>`.
Notes: shell variables, `$?`, `cd`, `rm` are denied in this session.
