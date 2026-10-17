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

1. Before pushing, complete the checks required by the final diff.

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

For breaking API or behavior changes, and significant features, add migration guidance to `docs/changehistory/NextVersion.md`. A runtime or logical change can be breaking even when existing consumer code still compiles. Entries go under a fixed set of sections: list them with `node .github/workflows/automation-scripts/check-nextversion.mjs --sections`, and run the script without arguments to check the file.

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

### Opt-in tests

Some tests are too slow or too repetitive to run on every build, so they are skipped unless an environment variable asks for them. A normal run reports them as pending rather than hiding them, which is the signal that one of these exists.

| Variable | Turns on | Where |
| --- | --- | --- |
| `ITWIN_INCLUDE_SCHEMASYNC_EXTENDED_TESTS` | the extended tier of the schema sync suites - further permutations of behaviour the core tier already covers | `full-stack-tests/backend/src/integration/SchemaSync*.test.ts` |
| `ITWIN_INCLUDE_SEMANTIC_REBASE_EXTENDED_TESTS` | semantic rebase permutations, stress cases, and the rebase suite repeated with semantic rebase enabled | `core/backend/src/test/hubaccess/{Rebase,SemanticRebase}.test.ts` |
| `ITWIN_INCLUDE_LARGE_DELETE_ELEMENTS_PERFTESTS` | the 1,000,000 and 1,700,000 element cases of the bulk deletion performance test | `full-stack-tests/backend/src/perftest/DeleteElements.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_DEV_TESTS` | vertical CRS enumeration, filtering, and conversion using DEV workspace resources | `full-stack-tests/backend/src/integration/VerticalCrsDev.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS` | macOS/Linux/Windows production workspace prefetch and fresh-process offline vertical CRS acceptance using OS-level network isolation | `full-stack-tests/backend/src/integration/VerticalCrsOffline.test.ts` |

Set one to `1`, `true` or `yes` and run the package's usual test script. Nothing sets them in CI today.

The offline Vertical CRS test runs on macOS, Linux, and Windows with a matching native addon for the Node.js architecture. macOS uses `sandbox-exec`; Linux requires `unshare` (util-linux), `ip` (iproute2), and permission to create unprivileged user and network namespaces. Windows uses an outbound Windows Defender Firewall block rule for a dedicated copy of Node; it requires an already elevated, policy-approved session, enabled firewall profiles permitting local rules, NetSecurity cmdlets, and a PowerShell host whose execution policy permits the helper script (see the Windows setup below). Verify Linux prerequisites with `unshare --user --map-root-user --net -- ip -j link show`; it must succeed with only the isolated loopback interface, initially down. An isolation setup failure fails the test rather than running without isolation.

From `full-stack-tests/backend`, run `rushx build`, then `ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS=1 ./node_modules/.bin/mocha lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 650000` from an ordinary online shell. It downloads both default production GCS databases into a temporary cache, verifies cold-offline failure, then checks discovery and bidirectional EGM96 conversion in a fresh network-blocked process. Linux offline workers verify a distinct network namespace, loopback-only interfaces, empty IPv4/IPv6 route tables, and a routing failure before native startup. Only the offline workers are isolated; prefetch retains network access. Worker output includes the loaded addon path and SHA-256. The cache is removed afterward.

On Windows, use an already elevated, policy-approved PowerShell session. Windows Defender Firewall must be running, all effective profiles must be enabled and allow local rules, and NetSecurity cmdlets must be available. The selected PowerShell host's execution policy must permit `src/integration/VerticalCrsOffline.windows.ps1`; if signing is required, have the helper signed through your organization's approved process. The default host is Windows PowerShell 5.1. Set `ITWIN_VERTICAL_CRS_OFFLINE_POWERSHELL` to an absolute host path to use PowerShell 7 instead; the hosts can have different execution policies. The harness does not request elevation or bypass execution policy. From `full-stack-tests/backend`:

```powershell
rushx build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$previousOptIn = $env:ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS
$previousPowerShell = $env:ITWIN_VERTICAL_CRS_OFFLINE_POWERSHELL
try {
	$env:ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS = '1'
	$env:ITWIN_VERTICAL_CRS_OFFLINE_POWERSHELL = (Get-Process -Id $PID).Path
	node ./node_modules/mocha/bin/mocha.js lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 650000
	if ($LASTEXITCODE -ne 0) { throw 'Offline acceptance failed' }
} finally {
	$env:ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS = $previousOptIn
	$env:ITWIN_VERTICAL_CRS_OFFLINE_POWERSHELL = $previousPowerShell
}
```

Windows copies the current Node executable into a unique temporary directory and applies an outbound block rule only to that copy. It verifies the copy's hash/version, effective rule, a successful production-host TCP control before blocking, matched blocked connections inside each offline worker, parent connectivity, and restored connectivity after rule removal. Reachable IPv6 endpoints are checked too; unavailable IPv6 is reported. The worker must use a daemonless workspace cache. This proves blocked direct resource egress, not isolation of loopback, delegated DNS, or separate helper processes. The rule and executable directory are owned and cleaned up by the parent; a cleanup failure fails the run. Before creating a rule, the harness prints its identity and an exact recovery command for interrupted runs. Run that command only after the test has stopped; it terminates owned workers before removing their rule and directory. The Windows parent timeout allows each bounded worker and its cleanup to finish.

The installed addon is the default. For a separately labeled local-build run, set `ITWIN_VERTICAL_CRS_OFFLINE_ADDON` to the absolute `imodeljs.node` path with its matching platform libraries/assets alongside it, then restore the prior environment value afterward. This does not replace installed dependencies. To validate cleanup after an intentional worker failure, temporarily set `ITWIN_VERTICAL_CRS_OFFLINE_FAIL_PHASE` to `cold-offline`; the worker fails after proving network denial and before native startup. Expect a failing test, restored connectivity, and no remaining owned rule/directory/cache. Restore the variable afterward. Windows acceptance, including failure cleanup, must be run on an approved host; compilation alone is not acceptance. Changes to shared worker lifecycle also require Linux and macOS runtime reruns.

Adding another: read it once at module scope and pick `it` or `it.skip` from it, so the block is skipped when the file loads and its setup never runs. `extendedIt` in `SchemaSyncTestUtils.ts` is the pattern. Name it `ITWIN_INCLUDE_<AREA>_<KIND>` and add a row above, so the set stays findable.

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
