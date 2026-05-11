---
name: pr-review-considerations
description: Additional iTwin.js PR review heuristics focused on consumer impact, compatibility, invariants, UI evidence, and docs accuracy.
---

# PR Review Considerations

Use this skill when reviewing pull requests, preparing review guidance, or deciding what GitHub Copilot should pay attention to in this repository.

> GitHub Copilot PR review on GitHub.com does **not** load repository skills directly. To influence GitHub review comments, keep the concise version of this guidance in `.github/instructions/pr-review.instructions.md`. GitHub's current repository instruction model also means that file can influence other Copilot interactions for matching files, not only PR review.

## Review stance

These considerations **supplement** — not replace — standard code review practices. Continue checking for correctness, security, performance, and readability as you normally would. The guidance below adds iTwin.js-specific domain concerns on top of that baseline.

- In addition to standard review checks, prioritize issues likely to cause runtime regressions, consumer confusion, integration churn, or repeated reviewer back-and-forth.
- Skip pure style-only nits unless they hide a correctness problem or conflict with an established repo pattern.
- Prefer comments that explain *why* the issue matters to consumers, downstream apps, or maintainers.

## What reviewers repeatedly look for

### 1. Consumer impact and compatibility

- For `package.json`, peer dependency, or version bumps, ask whether each bump is necessary and whether the peer range can stay broader.
- Watch for unrelated dependency churn getting folded into a feature PR.
- If a change is declared safe because of fallback behavior, verify the fallback exists and ask for the exact helper or test when the proof is missing.
- For parser, persistence, schema, or serialization changes, check old-data compatibility and roundtrip behavior.
- When integration risk exists, ask whether the change was validated in downstream apps, learning snippets, or consumer patch testing.

### 2. Stronger invariants and less ambiguity

- Push `undefined` and loading handling upward instead of spreading optional checks through the tree.
- Remove redundant or duplicated state when a single source of truth is available.
- Encode behavioral requirements in types when possible, especially prop combinations tied to modes like `editable`.
- Prefer extracting shared helpers over duplicating similar conditionals, heuristics, or parsing logic.
- Call out ad hoc string-matching heuristics or repeated condition fragments that should be centralized.

### 3. UI and UX expectations

- UI workflow changes should include a GIF or screenshot in the PR description.
- Check CTA placement, layout shift, copy clarity, localization wording, accessibility, and whether UX feedback is warranted.
- Confirm that app-specific glue is not being accidentally presented as reusable package behavior.

### 4. Docs, examples, and change notes

- README content, comments, screenshots, and example snippets should match what actually ships.
- Prefer compiled or extracted snippets over handwritten README code that can drift.
- For public or beta API changes, verify release tags, `rush extract-api`, and required `rush change` files.
- Only ask for `docs/changehistory/NextVersion.md` and migration guidance when the change is breaking or is a significant new user-visible feature.
- In changelog text, describe concrete user-visible behavior instead of labeling every bug fix as "breaking."

## High-signal review prompts

- "If this is safe because of a fallback, can you point to the helper or test that proves it?"
- "Can this invariant be expressed in the type instead of repeated runtime checks?"
- "Does this peer dependency bump need to happen in this PR, or can the range stay broader?"
- "Will this behavior survive save/load or serialize/deserialize roundtrips?"
- "Please add a GIF or screenshot so reviewers can validate the UI workflow quickly."
