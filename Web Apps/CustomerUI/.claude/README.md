# CustomerUI — Claude Code აგენტური გუნდი

ეს repo-ს **საკუთარი, დამოუკიდებელი** გუნდია. Claude Code გახსენი ამ repo-ს ფოლდერში.
აწყობილია [shavidze/create-claude-team](https://github.com/shavidze/create-claude-team)-ის template-ის
მიხედვით, Claude Code-ის მიმდინარე დოკუმენტაციის ფორმატით.

| ფენა | რა | როგორ ირთვება |
|---|---|---|
| `../CLAUDE.md` | repo-ს მეხსიერება, გუნდის ცხრილი, კონვენციები | ყოველ სესიაზე |
| `agents/` | `product-manager`, `architect`, `designer`, `frontend-engineer`, `qa-tester`, `code-reviewer`, `security-reviewer`, `product-verifier`, `release-manager` | Claude აგზავნის `description`-ის მიხედვით, ან შენ: „`code-reviewer`-ით გადახედე" |
| `skills/` | `/check`, `/new-ticket`, `/new-feature`, `/api-contract-sync`, `pre-flight`, `new-component` | `/name` ან Claude თავად |
| `rules/` | `workflow.md` (ყოველთვის), `rules/angular.md` (მხოლოდ `src/**`-ზე) | ავტომატურად |
| `hooks/` + `settings.json` | push იბლოკება, თუ `ng build` ვერ გადის; Stop-ზე uncommitted გაფრთხილება; უსაფრთხოების deny-სია | დეტერმინისტულად |

ServiceTokenAPI-ს (`../../ServiceTokenAPI`) მხოლოდ კითხულობს, როგორც contract-ის წყაროს; API-ში ცვლილება საჭიროების შემთხვევაში API repo-ს თავის გუნდს გადაეცემა.

სასარგებლო ბრძანებები: `/agents`, `/context`, `/hooks`, `/memory`.

წყაროები: [Subagents](https://code.claude.com/docs/en/sub-agents) · [Skills](https://code.claude.com/docs/en/skills) ·
[Hooks](https://code.claude.com/docs/en/hooks) · [Memory & rules](https://code.claude.com/docs/en/memory) ·
[Best practices](https://code.claude.com/docs/en/best-practices)
