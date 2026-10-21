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

### Vertical CRS resource regression

The Vertical CRS resource-unavailability regression is opt-in locally and enabled in the four Node 24 renderer/architecture lanes of `common/config/azure-pipelines/integration-validation.yaml`. It is skipped by default in other pipelines, including PR validation and native/internal builds, and in the weekly Node 20/22 compatibility lanes. It needs online access during prefetch and a matching native addon, but no elevation, network isolation tools, or operator prompts. For a focused run from `full-stack-tests/backend`, run `rushx build`, then `ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS=1 ./node_modules/.bin/mocha lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 1850000`. In PowerShell, set `$env:ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS = '1'` before the Mocha command and restore its previous value afterward.

Its test-owned endpoint is a loopback HTTP server forwarding real workspace requests to the production HTTPS service. The test changes the configured workspace endpoint, explicitly prefetches both databases through the native stack, then closes the server and its connections. Fresh workers retain the same endpoint/container identities: the populated cache must support enumeration and bidirectional EGM96 conversion; an independent empty cache must fail dictionary access. Local GCS fallback is disabled and caches are daemonless. Temporary caches and the server are cleaned up after success or failure. The parent automatically supplies the endpoint and cache locations to workers through internal environment variables. This validates resource-unavailability behavior and cache persistence, not complete network isolation or unchanged production settings. Production-isolation acceptance remains separately opt-in as described below.

### Opt-in tests

Some tests are too slow or too repetitive to run on every build, so they are skipped unless an environment variable asks for them. A normal run reports them as pending rather than hiding them, which is the signal that one of these exists.

| Variable | Turns on | Where |
| --- | --- | --- |
| `ITWIN_INCLUDE_SCHEMASYNC_EXTENDED_TESTS` | the extended tier of the schema sync suites - further permutations of behaviour the core tier already covers | `full-stack-tests/backend/src/integration/SchemaSync*.test.ts` |
| `ITWIN_INCLUDE_SEMANTIC_REBASE_EXTENDED_TESTS` | semantic rebase permutations, stress cases, and the rebase suite repeated with semantic rebase enabled | `core/backend/src/test/hubaccess/{Rebase,SemanticRebase}.test.ts` |
| `ITWIN_INCLUDE_LARGE_DELETE_ELEMENTS_PERFTESTS` | the 1,000,000 and 1,700,000 element cases of the bulk deletion performance test | `full-stack-tests/backend/src/perftest/DeleteElements.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_DEV_TESTS` | vertical CRS enumeration, filtering, and conversion using DEV workspace resources | `full-stack-tests/backend/src/integration/VerticalCrsDev.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS` | native prefetch and fresh-process cache regression with a test-owned local resource endpoint | `full-stack-tests/backend/src/integration/VerticalCrsOffline.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS` | macOS/Linux production workspace prefetch and fresh-process offline vertical CRS acceptance using OS-level network isolation | `full-stack-tests/backend/src/integration/VerticalCrsOffline.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_INTERACTIVE_TESTS` | Windows operator-confirmed offline acceptance against unmodified production settings, requiring local interactive input and manual network disconnection | `full-stack-tests/backend/src/integration/VerticalCrsOffline.test.ts` |

Set one to `1`, `true` or `yes` and run the package's usual test script. CI enables selected suites through pipeline or job variables; the resource regression is enabled only in the Node 24 renderer/architecture jobs described above.

The automated offline Vertical CRS acceptance runs on macOS and Linux with a matching native addon for the Node.js architecture. macOS uses `sandbox-exec`; Linux requires `unshare` (util-linux), `ip` (iproute2), and permission to create unprivileged user and network namespaces. Verify Linux prerequisites with `unshare --user --map-root-user --net -- ip -j link show`; it must succeed with only the isolated loopback interface, initially down. An isolation setup failure fails the test rather than running without isolation. Windows uses the separate interactive acceptance described below; the automated opt-in does not enable it.

From `full-stack-tests/backend`, run `rushx build`, then `ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS=1 ./node_modules/.bin/mocha lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 650000` from an ordinary online shell. It downloads both default production GCS databases into a temporary cache, verifies cold-offline failure, then checks discovery and bidirectional EGM96 conversion in a fresh network-blocked process. Linux offline workers verify a distinct network namespace, loopback-only interfaces, empty IPv4/IPv6 route tables, and a routing failure before native startup. Only the offline workers are isolated; prefetch retains network access. Worker output includes the loaded addon path and SHA-256. The cache is removed afterward.

On Windows, run **locally** in an ordinary, interactive PowerShell terminal with a Windows native addon matching the Node.js architecture and containing the vertical CRS changes under test. Disconnecting networking can interrupt remote sessions and other applications: do not run through a connection needed to control the test. No elevation, firewall rules, copied Node executable, adapter changes, PowerShell helper, or execution-policy changes are needed. Explicit opt-in with redirected stdin/stdout or with `CI` set fails before cache creation, downloads, or worker startup. From `full-stack-tests/backend`:

```powershell
rushx build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$previousOptIn = $env:ITWIN_INCLUDE_VERTICAL_CRS_INTERACTIVE_TESTS
try {
	$env:ITWIN_INCLUDE_VERTICAL_CRS_INTERACTIVE_TESTS = '1'
	node ./node_modules/mocha/bin/mocha.js lib/cjs/integration/VerticalCrsOffline.test.js --no-config
	if ($LASTEXITCODE -ne 0) { throw 'Offline acceptance failed' }
} finally {
	$env:ITWIN_INCLUDE_VERTICAL_CRS_INTERACTIVE_TESTS = $previousOptIn
}
```

Windows first downloads both default databases using stock production settings into a dedicated populated cache, verifies full block residency and conversion, and waits for that worker to exit. At the parent prompt, manually disconnect VPN, Wi-Fi, Ethernet, mobile tethering, and every other network path, then press Enter. The human wait has no assertion timeout; each worker is limited to ten minutes. Fresh workers must enumerate and filter the dictionary and perform forward/reverse EGM96 conversion with the populated cache, then report the specific dictionary-unavailable error with an independent empty cache. Both offline workers disable local GCS fallback and require daemonless workspace caches. Production endpoints and database identities remain unchanged; the unattended resource regression never prompts and continues to use its own local endpoint.

The result is labeled **operator-confirmed offline acceptance**. Enter records an operator action, not proof of complete network isolation. The empty-cache control detects some setup errors, not every possible connectivity path. Evidence includes Windows version, architecture, Node version, native package version, loaded addon path and SHA-256, timestamped operator confirmation, and each worker's assertions. Retain the terminal output as acceptance evidence.

On success, input EOF/cancellation, worker failure, or handled Ctrl+C, the parent reminds you to **restore networking manually** and removes temporary caches after worker exit. Ctrl+C terminates an active owned worker tree before cleanup. No adapters are restored automatically. Forced termination (including closing the terminal or killing the parent) cannot guarantee a final reminder or cleanup: reconnect networking yourself, stop any remaining worker processes for this run, then remove the exact temporary cache directory printed at startup. Never remove a cache while its worker is running. There are no firewall rules or copied executables to recover.

The installed addon is the default. For a separately labeled local-build run, set `ITWIN_VERTICAL_CRS_OFFLINE_ADDON` to the absolute `imodeljs.node` path with its matching platform libraries/assets alongside it, then restore the prior environment value afterward. This does not replace installed dependencies. Do not attempt a native build without the required initialized build environment. To validate worker-error cleanup, temporarily set `ITWIN_VERTICAL_CRS_OFFLINE_FAIL_PHASE` to `prefetch` (before any disconnection) or `cold-offline` (after disconnection); the selected worker deliberately fails before native startup. Expect a failing test, a restoration reminder, and no remaining owned workers/caches. Restore the variable afterward. Also exercise EOF/cancellation at the prompt and Ctrl+C during a worker. Windows acceptance and interruption validation require a Windows run; compilation alone is not acceptance. Changes to shared worker lifecycle also require Linux and macOS runtime reruns.

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
