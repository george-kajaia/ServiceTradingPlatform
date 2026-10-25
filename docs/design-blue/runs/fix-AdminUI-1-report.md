I fixed all three open AdminUI findings plus the two shared items from the coordinator notes. Both builds pass: `npx ng build --configuration development` and `npm run build`. I did not run the browser harness, and I didn't stage or commit anything.

- **Status contrast (BUG-1):** I changed `$ok` from `#15803D` to `#166534` in `_variables.scss`. I estimate about 6.7:1 on `#E7F5EC`, calculated rather than measured. Brand blue is unchanged. The darker green also applies to the other places `$ok` is used, including the green buttons and success toasts.
- **Approve button clipped at 1440 (BUG-2):** In `admin-dashboard.component.scss`, I lowered the Requests table's minimum width from 960px to 720px. Name and date cells now wrap. The Id, token count, status and Actions cells stay on one line. Mobile and tablet widths still scroll inside the table wrapper. I haven't confirmed in a browser that the Approve button now fits at 1440.
- **Confirm dialog (BUG-3):** In `confirm-dialog.component.ts`, the dialog now remembers the button that opened it and returns focus there on close. It also locks body scrolling while open and restores it on close or destroy.
- **Button focus ring:** `$focus-ring` is now a 2px white ring plus a 2px `#2563EB` ring, instead of the faint 35% blue shadow. Input blue borders are untouched.
- **Empty error toast:** `ToastService.error` in `toast.service.ts` now falls back to "Something went wrong. Please try again." when the message is missing, blank or over 200 characters.

I left the 768px toast placement and the native Tab step to the document body unchanged, per the calibration notes.

The ledger is in `docs/design-blue/CHECKPOINT.md`.

The other three apps (CompanyUI, InvestorUI, ServiceUI) share copied tokens and toast code, so they need the same colour, ring and toast changes.

The shell was blocked when I tried a `cd` compound command, so I ran the builds directly in the working directory.