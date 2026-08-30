# B2 evidence: local session mining

Task-type taxonomy and default task-mix weights mined from real coding-agent session logs on this machine. This is the discovery work behind backlog item B2 and the validation trigger for assumption A2.

Method: observation only. No source files were edited to produce this report.

---

## 1. Sessions examined

- **Found:** 49 Claude Code session logs (`.jsonl`) across 6 project directories in `~/.claude/projects/`. No opencode session logs were found on this machine (`~/.config/opencode` contains config only, no session transcripts; no project-local `.opencode/` dirs existed in the projects inspected). All sessions examined are therefore Claude Code.
- **Examined:** 8 sessions, spanning 4 distinct real projects and 6 distinct task types (bug-fix-from-screenshot, root-cause-debugging + TDD fix, feature design via interview + implementation, pure research-and-report, initial-commit-with-exclusion-analysis, project-overview + commit-planning, code-explanation Q&A, prose-instruction-drafting).
- **Date range:** 2026-07-12 → 2026-07-21 (10 days).
- **Models used in sessions:** `minimax-m3` (dominant), `glm-5.2`, `devstral-small-2:24b-cloud` (brief switch in S6).
- **Where found:** `~/.claude/projects/<project-slug>/<session-uuid>.jsonl`. Each line is a JSON event (`user` / `assistant` / `file-history-snapshot` / `attachment`); assistant turns carry `thinking`, `text`, and `tool_use` content blocks; user turns carry `tool_result` blocks (the input tokens that dwarf everything else).

## 2. Task types observed

| Type label | One-line definition | Example snippet (≤2 lines, from a real session) | Frequency across sessions |
|---|---|---|---|
| PLANNING | Reading code/logs/docs to form a hypothesis, design a fix, or scope work; includes exploratory debugging where the root cause is still unknown. | "Found the smoking gun. The errors are very clear — this is a Zod validation failure. The Cloudflare AI Search API is rejecting each file upload because the metadata object is m…" | 8/8 (every session opens with planning; in 4 sessions it dominated) |
| EXECUTION | Writing/editing code, running tests/lint/typecheck, iterating on a failing test until green, applying a fix whose design is already settled. | "## GREEN — minimal fix: add the lightweight schema and switch the contract" → `Edit(uploadItem to return UploadItemResponse)` | 6/8 (absent in the two pure-research/QA sessions S4, S7) |
| TRIVIAL | Mechanical commit housekeeping, git-status reads, task-status toggles, git-config fumbling — no reasoning, no new artifact. | "commit all cirrent changes" → `git status` / `git diff --stat` / `git log --oneline -10` | 6/8 (always at the tail; never the main event) |
| QA | Read code to answer a factual question or draft a prose document (instructions, overview); no code change intended. | "how does LEANN mcp discover indexes? i.e. I built and index of one codebase…" → reads `mcp.py`, answers in prose. | 2/8 (S7 entirely; S8's final output block) |

No additional type beyond these four was forced by the content. "EXPLORATORY DEBUGGING" did not emerge as a distinct tier: in S1 and S2 the debugging phase was inseparable from "forming the plan" — once the root cause was known, the plan was already fixed, so the activity collapsed into PLANNING rather than sitting between PLANNING and EXECUTION.

## 3. Volume share per session

Unit: **characters**, summed over assistant text + assistant thinking + user tool_results + user prompts. Tool_results (file contents, command output, doc pages returned by MCP) dominate because they are the input tokens the model must read on the next turn — they are the cost driver, not the assistant's own output. Token counts were not available in the logs; char count is a rough proxy (≈4 chars/token for English/code, less reliable for log-heavy tool output). Sessions are anonymized; the task column is one-line description only.

| Session ID | Tool | Task (one line) | PLANNING % | EXECUTION % | TRIVIAL % | QA % | Total volume (chars) |
|---|---|---|---|---|---|---|---|
| S1 | Claude Code | Debug failing AI-search upload via logs, then TDD-fix the schema contract | **80.7** | 14.0 | 5.2 | 0 | 189,365 |
| S2 | Claude Code | Add missing `/auth/logout` route (404 from screenshot) | **61.0** | 25.9 | 13.1 | 0 | 105,216 |
| S3 | Claude Code | Design + implement pretty-stdout logger alongside JSON file sink | 40.8 | **57.3** | 1.9 | 0 | 103,756 |
| S4 | Claude Code | Research Cloudflare AI Search pricing limits and write a report | **99.5** | 0.5 | 0 | 0 | 168,126 |
| S5 | Claude Code | Initial commit; analyze and exclude dev artefacts | **87.4** | 11.0 | 1.6 | 0 | 53,274 |
| S6 | Claude Code | Project overview + commit-separation analysis + lint fixes | 53.3 | **46.7** | 0.0 | 0 | 166,505 |
| S7 | Claude Code | Explain how LEANN mcp discovers indexes (Q&A) | 0 | 0 | 0 | **100** | 48,631 |
| S8 | Claude Code | Draft CLAUDE.md instructions for LEANN mcp usage | 85.2 | 0 | 0 | 14.8 | 33,983 |

## 4. Aggregate default mix

**PLANNING 68%, EXECUTION 23%, TRIVIAL 3%, QA 6%** (char-weighted, 8-session aggregate, 868,856 chars total).

The mix varies **wildly** session-to-session, so the point number is misleading on its own:
- PLANNING share spans **40% → 99%** depending on whether the task is debugging/research-heavy (S1, S4, S5) vs. a build-out where the design was settled early (S3).
- EXECUTION share spans **0% → 57%** — zero in the two research/Q&A sessions, majority in the one session where the plan was a quick interview and the rest was test-driven coding (S3).
- TRIVIAL is consistently small (**0–13%, median ~2%**) and always at the tail.
- QA is **0% or 100%** — it's a different task shape entirely (pure explanation or prose drafting), not a third of a normal coding session.

**Reasoning for the default:** the aggregate is PLANNING-heavy because 4 of 8 sessions were dominated by investigation (debugging, research, commit analysis) where the bulk of tokens came from tool_results (log files, doc pages, `git diff` output) that the model had to read and reason over before producing a short conclusion. If the workload skews toward "implement a known plan" sessions, EXECUTION rises and PLANNING drops toward 40–55% (as in S3, S6).

## 5. A2 verdict

**A 3rd tier is warranted — but it is QA, not TRIVIAL.**

- **TRIVIAL** (the candidate named in assumption A2) is **not** a meaningful 3rd tier. Across 8 sessions it never exceeded 13% and was usually ~2% — just commit housekeeping at the tail. Folding it into EXECUTION (as "mechanical execution") would misrepresent almost nothing. The traces do **not** force a TRIVIAL tier.
- **QA** is the tier the traces force. It appeared in 2 of 8 sessions (25%), and in one of those (S7) it was the **entire** session: the user asked a factual question about how a tool works, the agent read code and answered in prose, no file was changed. This is neither PLANNING (there was nothing to plan — no code change was intended) nor EXECUTION (no code was written or edited). Folding S7 into PLANNING would mislabel 48k chars of "read code to explain it" as "architecting a fix." Folding it into EXECUTION would mislabel "produce a prose answer" as "writing code."
- **Definition of the QA tier:** read codebase/docs and produce a prose answer or instruction document; no source file is modified; the deliverable is natural language, not an edit. Volume share in the aggregate: **6.2%**; but in the sessions where it occurs it is **15–100%** of that session.

The 2-role split is therefore insufficient: a non-trivial minority of sessions (here, 2/8) are neither planning a change nor executing one. The recommended taxonomy is **3 top-level types: PLANNING, EXECUTION, QA**, with TRIVIAL folded into EXECUTION as a low-effort sub-type (or ignored at this stage — its volume is negligible).

## 6. One-sentence-per-type fitness note

- **PLANNING** — fitness is general reasoning over large contexts (reading 40k-char log dumps and forming a correct hypothesis), so the measurable dimension is **long-context comprehension + causal reasoning**, not pure code-generation skill.
- **EXECUTION** — fitness is producing correct localized edits that pass tests/lint on the first or second try; the measurable dimension is **edit-precision / first-pass-green rate** under a spec, which is narrower than general intelligence.
- **TRIVIAL** — any instruction-following model suffices; the dimension is **price alone** since the reasoning load is near zero (this is where a cheap model is unambiguously optimal, supporting the pair recommendation).
- **QA** — fitness is reading code and producing an accurate prose explanation without editing anything; the dimension is **code-reading comprehension + faithful summarization**, which is distinct from both planning (no design) and execution (no edits) and is the candidate for a separate benchmark split under backlog item B6.

## 7. Raw evidence appendix

**Session S1** — Debug failing AI-search upload via logs, then TDD-fix the schema contract.

- `[1] user` "analyse currently running server log please. the AI search upload is failing" — **PLANNING** (problem stated, cause unknown).
- `[34] assistant` "**Found the smoking gun.** The errors are very clear — this is a Zod validation failure. The Cloudflare AI Search API is rejecting each file upload because the metadata object is m…" — **PLANNING** (root cause formed from log evidence).
- `[125] assistant` "## RED — write a failing test that pins the real API shape … `Edit(tests/unit/vendors/ai-search-instances.test.ts)`" — **EXECUTION** (TDD cycle begins; plan settled).
- `[140] assistant` "## GREEN — minimal fix: add the lightweight schema and switch the contract … `Edit(src/vendors/ai-search-instances.ts)`" — **EXECUTION** (applying the fix).
- `[247] user` "commit all cirrent changes" → `[249] assistant` `Bash(git status)` — **TRIVIAL** (commit housekeeping).

**Session S2** — Add missing `/auth/logout` route (404 from screenshot).

- `[1] user` "when I click Logout I get this: [Image #3]" — **PLANNING** (bug from screenshot, cause unknown).
- `[22] assistant` "Confirmed: `index.ts` wires `/auth/login`, `/auth/callback`, and `/auth/verify` but there is **no `/auth/logout` route registered**." — **PLANNING** (root cause found).
- `[100] assistant` "**Step 1: Add `clearSessionCookie` to `src/auth/cookie.ts`.** … `Edit(src/auth/cookie.ts)`" — **EXECUTION** (plan settled, writing code).
- `[141] assistant` "**Step 5: Run tests, typecheck, lint, format** … `Bash(pnpm test)` `Bash(pnpm typecheck)`" — **EXECUTION** (verification, iterating until green).
- `[174] user` "commit all changes" → `[175] assistant` `Bash(git log --oneline -10)` — **TRIVIAL**.

**Session S3** — Design + implement pretty-stdout logger alongside JSON file sink.

- `[0] user` "find a way to support pretty print of stdout log along with the json print to file … interview me about ambiguities" — **PLANNING** (design intent + interview request).
- `[29] assistant` "I have enough. Let me restate intent for confirmation. Here's what I now think you want: - **Outcome:** Replace the current stdout NDJSON output with pino-pretty…" — **PLANNING** (design synthesized from interview).
- `[154] assistant` "Now write the new test file. … `Write(tests/unit/logger/pretty-stdout.test.ts)`" — **EXECUTION** (implementation underway).
- `[176] assistant` "Within my logger work: 18/19 pass, 1 assertion fix needed (`env: \"production\"` quoted, not bare)…" → `Edit(test)` — **EXECUTION** (iterating on a failing test, not trivial).
- `[223] assistant` "Done. Summary of what changed: **Production code** - `src/logger/streams.ts` — added `pretty: boolean`…" — **TRIVIAL** (post-hoc summary; no further reasoning).

**Session S4** — Research Cloudflare AI Search pricing limits and write a report.

- `[0] user` "I want you to investigate the usage cost for Ai search on cloudflare … I want to unders[and]" — **PLANNING** (pure research; no code change intended).
- `[6–8] assistant` `mcp__cloudflare__docs(AI Search pricing limits…)` ×3 → `[9–11] user` tool_results (16k, 11k, 10k chars each) — **PLANNING** (reading docs; these result tokens dominate volume).
- `[41] assistant` "# AI Search architecture & cost assessment ## Your setup, decoded …" (9858 chars) — **PLANNING** (analysis synthesized; this is the deliverable, not an edit).
- `[42] user` "write down this report in .md please" → `[49] assistant` `Write(docs/audit/2026-07-17-…md)` — **EXECUTION** (trivial file write; 0.5% of session volume).

**Session S5** — Initial commit; analyze and exclude dev artefacts.

- `[5] user` "commit all changes. exclude development and agent coding artefacts from the commit" — **PLANNING** (requires judgment about what counts as an artefact).
- `[38] assistant` "Now I have a clear picture. The agent/development artefacts are: planning docs (`tasks/`, `docs/audit`, `docs/ideas`…) and the debug…" — **PLANNING** (classification decision; the reasoning is the work).
- `[44] assistant` `Bash(pnpm test)` `Bash(pnpm typecheck)` `Bash(pnpm lint)` — **EXECUTION** (running gates).
- `[73] assistant` "Staged exactly the production code. … Now committing. … `Bash(git commit -m …)`" — **EXECUTION** (the commit act, small but reasoned).
- `[81–85] user` "g config set email…" → `<bash-stderr>error: key does not contain a section…` — **TRIVIAL** (mechanical git-config fumbling, no reasoning).

**Session S6** — Project overview + commit-separation analysis + lint fixes.

- `[0] user` "checkout the current project and give me a quick overview of its capabilities" — **PLANNING** (investigation).
- `[23] assistant` "# MCPaaS Platform Overview **MCPaaS** … an edge-first TypeScript monorepo on Cloudflare Workers…" (2078 chars) — **PLANNING** (overview synthesized from reads; overlaps with QA but no prose deliverable was requested, just an in-chat answer).
- `[24] user` "I want to commit all current changes. analyse them all and suggest what to commit and what not to commit…" — **PLANNING** (commit analysis requires judgment).
- `[67–72] assistant` "Linter found a formatting issue in `docs-client.ts` … `Edit(…)` ×5" — **EXECUTION** (fixing lint errors found by the gate).
- `[171] assistant` `Bash(git status && echo "---" && git log --oneline -3)` — **TRIVIAL** (final status check).

**Session S7** — Explain how LEANN mcp discovers indexes (Q&A).

- `[0] user` "how does LEANN mcp discover indexes? i.e. I built and index of one codebase, and when I look at the leann_list tool description, it says that it shows all indexed codebases. also, is that mcp used onl[y…]" — **QA** (factual question; no code change requested).
- `[3–10] assistant` `Bash(find …)` / `Bash(grep … leann_list …)` / `Bash(cat README.md)` → tool_results return code — **QA** (reading code to answer; tool_results dominate volume).
- `[31] assistant` "## How the MCP discovers indexes … The MCP `leann_list` tool is a thin wrapper — it just shells out to the `leann list` CLI command…" — **QA** (prose answer delivered; no file edited).
- `[32] user` "when claude runs leann_search from a single codebase, does it get results for other codebases that are also indexed?" — **QA** (follow-up question).
- `[33] assistant` "No — `leann_search` is scoped to a single index. From `mcp.py:149-167`…" — **QA** (answer with code citation).

**Session S8** — Draft CLAUDE.md instructions for LEANN mcp usage.

- `[2] user` "I want to provide instructions to my claude.md on how and when to use LEANN mcp server. help me draft that instruction" — **PLANNING** (investigation needed before drafting).
- `[5–17] assistant` `Bash(ls …)` / `Read(…)` / `Bash(find …)` — **PLANNING** (reading mcp code to understand the tools; tool_results are the volume).
- `[22] assistant` "Task list isn't needed here — this is a single drafting task. Let me put together a self-contained section you can paste into either file…" (5030 chars of prose) — **QA** (prose deliverable: instructions drafted, no source file edited).

---

**Method note:** Volume was measured in characters as a proxy for tokens (no token counts were present in the logs). Each turn's volume = assistant text + assistant thinking + user tool_result content + user prompt text. Tool_results (file reads, command output, MCP doc fetches) were the largest component in every session — often 5–20× the assistant's own output — because they are the input tokens the model must consume on the next turn. This is why PLANNING-heavy sessions (S1, S4) have high total volume despite short assistant outputs: the investigation required reading large logs/docs. Labels were assigned by reading each session's transcript in full and marking contiguous turn ranges; boundary turns were assigned to the label of the activity they initiated.