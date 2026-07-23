# Contributing to iTwin.js

This guide covers the path from a local checkout to a pull request. Read the affected package's `package.json`, source, tests, and configuration for package-specific details.

## Set up the repository

The repository uses [Rush](https://rushjs.io/) to manage its TypeScript packages. Use a Node.js version supported by [`rush.json`](./rush.json). Node.js 24 LTS is recommended.

```sh
rush install
rush build
```

Run these commands from the repository root when setting up a new checkout. Use `rushx` from the affected package directory for targeted changes. Do not use `npm install` or `pnpm install` in this repository.

## Make your first change

1. Create a lowercase branch named `<github-user>/<short-description>`.
2. Find the affected package in `rush.json`, then read its `package.json`, source, and tests.
3. Make the smallest change that resolves the problem.
4. From the package directory, run the relevant validation:

```sh
rushx build
rushx test
rushx lint
```

> Older Mocha packages test compiled output, so run `rushx build` before `rushx test`. **Use repository-wide Rush commands only when the change spans packages or the package-specific script does not cover the change.**
5. Before pushing, complete the checks required by the final diff.

### Before you push

| Final diff includes | Required work |
| --- | --- |
| Production code | Targeted build, tests, and affected-package lint |
| Exported API, entry point, or release tag | Update from the target branch, then run `rush clean && rush build && rush extract-api`; review `common/api` changes |
| Published package | Run `rush change` and commit the generated change file |
| External dependency manifest | Run `rush check` and `rush update` |
| Documentation extract or package docs | Run the package's `rushx docs` command when available |

Do not commit `.only` tests.

### Public APIs and change entries

Check the package's API report in `common/api` before changing an exported symbol. Every new export needs an appropriate release tag. Do not break a `@public` API without a major-version migration plan. Open an [issue](https://github.com/iTwin/itwinjs-core/issues) before proposing a new public API and tag the package owners listed in [CODEOWNERS](./.github/CODEOWNERS) when possible.

Published packages use lockstep versioning. `rush change` creates entries with `"type": "none"`.

- Write a concise, user-facing `comment` when behavior, a public API, configuration, or documentation changes for consumers.
- Use an empty `comment` for test-only changes, development-dependency updates, linting fixes, and internal refactoring that does not change consumer behavior.
- Changes only to non-published packages, such as display-test-app, do not need a change entry.

For breaking API or behavior changes, and significant features, add migration guidance to `docs/changehistory/NextVersion.md`. A runtime or logical change can be breaking even when existing consumer code still compiles.

### Documentation examples

Keep examples in tested source. Put them in a package's `src/test/example-code/` directory, mark the extracted code, and include it from Markdown:

```ts
// __PUBLISH_EXTRACT_START__ SnippetName
// Example code
// __PUBLISH_EXTRACT_END__
```

```text
[[include:SnippetName]]
```

Use `rushx docs` from the package directory to build its documentation.

### Focus a test or debug a package

Check the package's `package.json` to identify Mocha or Vitest. Use the existing test scripts first. Use runner-supported filters for focused local work, but do not commit `.only` or a temporary Vitest test filter. For interactive debugging, use the launch configurations in [`.vscode/launch.json`](./.vscode/launch.json).

## Ask questions or report issues

### Discussions

Use [GitHub Discussions](https://github.com/iTwin/itwinjs-core/discussions) for questions, troubleshooting, and early design discussion. Search first, include the iTwin.js version and runtime, and keep each post to one topic.

### Issues

For reproducible bugs and actionable feature requests, [file an issue](https://github.com/iTwin/itwinjs-core/issues/new/choose). The issue forms collect the details needed to triage a bug or evaluate a feature request. Before filing, search existing issues and discussions. Follow the issue and respond when maintainers ask for clarification.

## Pull requests

All changes are reviewed through GitHub pull requests. Sign the [Bentley Contributor License Agreement](https://gist.github.com/imodeljs-admin/9a071844d3a8d420092b5cf360e978ca) when prompted by `cla-assistant`.

Include the generated API reports and Rush change files with the implementation. State the targeted validation you ran and any known baseline failures in the pull request description.

### Backports

Backport a merged `master` fix only when a supported release branch needs it before consumers can move to the next release, such as a security fix, regression, or customer-blocking defect.

After the original pull request merges, run locally this command:

```sh
gh pr comment <pr-number> --body "@Mergifyio backport release/X.X.x"
```

> Alternatively, leave a "@Mergifyio backport release/X.X.x" comment on your merged pull request through the GitHub UI.

Mergify creates the release-branch pull request. Review it, resolve any cherry-pick conflicts, and run the relevant tests against the target release branch before merging it (or let our CI run tests for you).

## Troubleshooting

### Rush commands are slow

Use `rushx` from the affected package directory for package-local build, test, lint, and documentation commands. Use root-level `rush build` when dependent packages also need to rebuild.

### Do I need to rebuild every package?

No. `rush build` builds incrementally, so it rebuilds only the packages affected by your changes. Use `rush rebuild` only when you need a full rebuild.

### A package cannot find `node_modules`

Run `rush install` after switching branches or pulling dependency changes. If the installation is stale or broken, run `rush update --purge`.

### Updating dependencies

Do not edit versions for internal monorepo dependencies. CI maintains them.

For an external dependency:

1. Update its version range in the owning `package.json`.
2. Run `rush check`.
3. Run `rush update`.
