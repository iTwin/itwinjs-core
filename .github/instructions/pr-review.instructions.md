---
applyTo: "**/*"
---

# iTwin.js pull request review heuristics

These heuristics **supplement** — not replace — GitHub Copilot's default code review behavior. Continue applying standard review practices (correctness, security, performance, readability). The guidance below adds iTwin.js-specific concerns that are easy to miss without domain context.

These heuristics are primarily intended to improve GitHub Copilot pull request reviews, but GitHub's current repository instruction model also lets them influence other Copilot interactions for matching files.

In addition to your standard review checks, pay special attention to issues that are likely to cause runtime regressions, integration churn, consumer confusion, or repeated reviewer rework. Skip pure style nits unless they hide a real issue or contradict an established repo pattern.

## Consumer impact and compatibility

- For dependency, peer dependency, or version bumps, question whether each bump is necessary, whether the peer range can stay broader, and whether downstream apps need follow-up changes.
- If a PR claims a fallback keeps the change safe, verify that the fallback is real in code or tests. Ask for the exact helper, call path, or test when the proof is missing.
- For parser, schema, persistence, or serialization changes, check whether old data still works and whether the behavior survives roundtrips.

## APIs, invariants, and reuse

- For public or beta API changes, verify release tags, `rush extract-api` output, and required `rush change` files.
- In this lockstep monorepo, do not flag generated `rush change` files that use `"type": "none"` as having an incorrect bump type.
- Only ask for `docs/changehistory/NextVersion.md` and migration guidance when the PR introduces a breaking change or a significant new user-visible feature.
- Prefer comments about weak invariants over local style nits: push undefined or loading handling upward, remove redundant state, require props through types, and reuse shared helpers instead of duplicating logic.
- Call out duplicated conditionals, repeated heuristics, or ad hoc string matching when a shared helper or stronger type would make the behavior safer.

## UI, docs, and examples

- For UI or UX changes, check for a GIF or screenshot in the PR description and flag confusing CTA placement, layout shift, copy, localization, accessibility, or cases that should get UX review.
- Check that README files, example snippets, comments, screenshots, and localized strings still match the shipped behavior. Prefer compiled or extracted snippets over hand-written README code.
- For changelog text, prefer concrete user-facing behavior descriptions over vague labels like "breaking" unless the PR truly changes a supported contract.

## Review style

- Prefer high-signal comments that explain downstream impact, missing validation, or future maintenance risk.
- Do not spend review budget on formatting-only comments unless they create ambiguity or churn that reviewers in this repo have repeatedly called out.
