# ServiceTokenAPI — Claude Code აგენტური გუნდი

ეს repo-ს **საკუთარი, დამოუკიდებელი** გუნდია. Claude Code გახსენი ამ repo-ს ფოლდერში.
აწყობილია [shavidze/create-claude-team](https://github.com/shavidze/create-claude-team)-ის template-ის
მიხედვით, Claude Code-ის მიმდინარე დოკუმენტაციის ფორმატით.

| ფენა | რა | როგორ ირთვება |
|---|---|---|
| `../CLAUDE.md` | repo-ს მეხსიერება, გუნდის ცხრილი, კონვენციები | ყოველ სესიაზე |
| `agents/` | `product-manager`, `architect`, `backend-engineer`, `qa-tester`, `code-reviewer`, `security-reviewer`, `product-verifier`, `release-manager` | Claude აგზავნის `description`-ის მიხედვით, ან შენ: „`code-reviewer`-ით გადახედე" |
| `skills/` | `/check`, `/new-ticket`, `/new-feature`, `/api-contract-sync`, `pre-flight`, `db-design` | `/name` ან Claude თავად |
| `rules/` | `workflow.md` (ყოველთვის), `rules/csharp.md` (მხოლოდ C# ფაილებზე) | ავტომატურად |
| `hooks/` + `settings.json` | push იბლოკება, თუ `dotnet build` ვერ გადის; Stop-ზე uncommitted გაფრთხილება; უსაფრთხოების deny-სია | დეტერმინისტულად |

Angular UI-ებს (`../New/*`) მხოლოდ კითხულობს; contract-ის ცვლილებისას `/api-contract-sync` თითო UI-სთვის ცვლილებების სიას ადგენს.

სასარგებლო ბრძანებები: `/agents`, `/context`, `/hooks`, `/memory`.

წყაროები: [Subagents](https://code.claude.com/docs/en/sub-agents) · [Skills](https://code.claude.com/docs/en/skills) ·
[Hooks](https://code.claude.com/docs/en/hooks) · [Memory & rules](https://code.claude.com/docs/en/memory) ·
[Best practices](https://code.claude.com/docs/en/best-practices)
