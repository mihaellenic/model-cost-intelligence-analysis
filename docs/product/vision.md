# Vision

## What this is

A cost-intelligence tool for users of coding agents (opencode and others). It answers: **which models are the most cost-effective for the different task types a coding-agent workflow actually has.**

## Who it's for

A solo developer using a coding agent who wants to optimize spend. They run a real workflow — planning + execution — and want to pick a **pair** of models: one strong/expensive model for planning and complex work, one cheaper model for simpler implementation tasks. The product's job is to recommend that pair against the user's reality, not to crown a single "best model."

## Why it exists (2-year)

Coding-agent cost is recurring and grows with usage. Model choice dominates that cost by 1–2 orders of magnitude, yet the choice is made blind today: benchmarks report intelligence, providers report price, nothing connects the two *per task type*. This tool owns that connection. The defensible position in 2 years is being the source that maps intelligence × cost onto the **task taxonomy coding agents actually use**, so a user gets a workflow-aware spend recommendation, not a leaderboard.

## What it is not

- Not a general LLM leaderboard. Coding only.
- Not a single-model picker. The output is a pair (or, later, a tiered set).
- Not a self-host / TCO calculator. API pricing only — the cost axis is meaningless for local inference (already documented in README §Caveats).
- Not a benchmark source. Intelligence is sourced (benchlm.ai today); we add the cost + task-type framing, not new scores.

## The one-sentence "done for mature version"

A solo dev using a coding agent can pick a **planning + execution model pair** that minimizes their expected workflow spend, in under 60 seconds, with confidence the recommendation reflects how they actually work.