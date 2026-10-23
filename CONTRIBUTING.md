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
| GCS resource loading, production workspace settings/resources, prefetching, durable cache behavior, or a native-addon update affecting these paths | Run [manual Vertical CRS offline acceptance](#manual-vertical-crs-offline-acceptance) on the affected supported platforms and record results in the PR |

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

The Vertical CRS resource-unavailability regression is opt-in locally and enabled in the four Node 24 renderer/architecture lanes of `common/config/azure-pipelines/integration-validation.yaml`. It is skipped by default in other pipelines, including PR validation and native/internal builds, and in the weekly Node 20/22 compatibility lanes. It requires the local Azurite blob service and a matching native addon; it does not access production workspace resources. For a focused run from `full-stack-tests/backend`, run `rushx build`, start `rushx azurite:setup` in another terminal, then run `ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS=1 ./node_modules/.bin/mocha lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 1850000`. In PowerShell, set `$env:ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS = '1'` before the Mocha command and restore its previous value afterward. The normal integration test script and CI already start Azurite.

The test uploads a [fixed workspace fixture](./full-stack-tests/backend/src/integration/fixtures/README.md) containing EGM96/WGS84 definitions, horizontal dictionaries, and a real EGM96 grid into a unique public Azurite container. A fresh worker anonymously prefetches the workspace through the native stack. The parent deletes the container while Azurite remains running, then starts fresh workers with the same endpoint/container identities: the populated cache must support enumeration and bidirectional EGM96 conversion; an independent empty cache must fail dictionary access. Local GCS fallback is disabled and caches are daemonless. The upload cache is separate from the reader caches. Temporary files and the test-owned container are cleaned up after success or failure. This exercises the native resource/cache integration on each enabled platform, not complete network isolation or unchanged production settings. Production acceptance remains a separate [manual test](#manual-vertical-crs-offline-acceptance).

### Opt-in tests

Some tests are too slow or too repetitive to run on every build, so they are skipped unless an environment variable asks for them. A normal run reports them as pending rather than hiding them, which is the signal that one of these exists.

| Variable | Turns on | Where |
| --- | --- | --- |
| `ITWIN_INCLUDE_SCHEMASYNC_EXTENDED_TESTS` | the extended tier of the schema sync suites - further permutations of behaviour the core tier already covers | `full-stack-tests/backend/src/integration/SchemaSync*.test.ts` |
| `ITWIN_INCLUDE_SEMANTIC_REBASE_EXTENDED_TESTS` | semantic rebase permutations, stress cases, and the rebase suite repeated with semantic rebase enabled | `core/backend/src/test/hubaccess/{Rebase,SemanticRebase}.test.ts` |
| `ITWIN_INCLUDE_LARGE_DELETE_ELEMENTS_PERFTESTS` | the 1,000,000 and 1,700,000 element cases of the bulk deletion performance test | `full-stack-tests/backend/src/perftest/DeleteElements.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_DEV_TESTS` | vertical CRS enumeration, filtering, and conversion using DEV workspace resources | `full-stack-tests/backend/src/integration/VerticalCrsDev.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS` | native prefetch and fresh-process cache regression with a test-owned local resource endpoint | `full-stack-tests/backend/src/integration/VerticalCrsOffline.test.ts` |
| `ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS` | one manual production acceptance operation selected by `ITWIN_VERTICAL_CRS_OFFLINE_PHASE`, using the dedicated cache in `ITWIN_VERTICAL_CRS_OFFLINE_CACHE`; follow the procedure below | `full-stack-tests/backend/src/integration/VerticalCrsOffline.test.ts` |

Set one to `1`, `true` or `yes` and run the package's usual test script. CI enables selected suites through pipeline or job variables; the resource regression is enabled only in the Node 24 renderer/architecture jobs described above.

Adding another: read it once at module scope and pick `it` or `it.skip` from it, so the block is skipped when the file loads and its setup never runs. `extendedIt` in `SchemaSyncTestUtils.ts` is the pattern. Name it `ITWIN_INCLUDE_<AREA>_<KIND>` and add a row above, so the set stays findable.

### Manual Vertical CRS offline acceptance

Run locally from `full-stack-tests/backend`, not through a remote connection. Run `rushx build` first. Create fresh empty directories at `$HOME/vertical-crs-acceptance/populated` and `$HOME/vertical-crs-acceptance/empty`, or substitute your own absolute paths below. Unset `ITWIN_VERTICAL_CRS_RESOURCE_ENDPOINT` if it is set.

**AI assistants do not work while the machine is offline.** Read all steps before disconnecting and complete them without assistant help. See [acceptance details](#vertical-crs-offline-acceptance-details) for run requirements and background.

#### Prefetch Online

While online, prefetch production resources into the populated cache.

POSIX shell:

```sh
ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS=1 ITWIN_VERTICAL_CRS_OFFLINE_PHASE=prefetch ITWIN_VERTICAL_CRS_OFFLINE_CACHE="$HOME/vertical-crs-acceptance/populated" node ./node_modules/mocha/bin/mocha.js lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 600000
```

PowerShell:

```powershell
$env:ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS = '1'
$env:ITWIN_VERTICAL_CRS_OFFLINE_PHASE = 'prefetch'
$env:ITWIN_VERTICAL_CRS_OFFLINE_CACHE = "$HOME/vertical-crs-acceptance/populated"
node ./node_modules/mocha/bin/mocha.js lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 600000
```

Expected: `1 passing`, exit status `0`, both databases fully cached, dictionary discovery, and successful forward/reverse EGM96 conversion. Stop if this fails; otherwise keep both cache directories for the next steps.

#### Verify the Populated Cache Offline

Disconnect all network paths, including VPN, Wi-Fi, Ethernet, and tethering. Run using the populated cache:

POSIX shell:

```sh
ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS=1 ITWIN_VERTICAL_CRS_OFFLINE_PHASE=offline ITWIN_VERTICAL_CRS_OFFLINE_CACHE="$HOME/vertical-crs-acceptance/populated" node ./node_modules/mocha/bin/mocha.js lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 600000
```

PowerShell:

```powershell
$env:ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS = '1'
$env:ITWIN_VERTICAL_CRS_OFFLINE_PHASE = 'offline'
$env:ITWIN_VERTICAL_CRS_OFFLINE_CACHE = "$HOME/vertical-crs-acceptance/populated"
node ./node_modules/mocha/bin/mocha.js lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 600000
```

Expected: `1 passing`, exit status `0`, dictionary discovery, and successful forward/reverse EGM96 conversion. On failure, stop and restore networking.

#### Verify the Empty Cache Offline

Stay disconnected. Run using the empty cache:

POSIX shell:

```sh
ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS=1 ITWIN_VERTICAL_CRS_OFFLINE_PHASE=cold-offline ITWIN_VERTICAL_CRS_OFFLINE_CACHE="$HOME/vertical-crs-acceptance/empty" node ./node_modules/mocha/bin/mocha.js lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 600000
```

PowerShell:

```powershell
$env:ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS = '1'
$env:ITWIN_VERTICAL_CRS_OFFLINE_PHASE = 'cold-offline'
$env:ITWIN_VERTICAL_CRS_OFFLINE_CACHE = "$HOME/vertical-crs-acceptance/empty"
node ./node_modules/mocha/bin/mocha.js lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 600000
```

Expected: `1 passing` and exit status `0`. The test asserts the expected dictionary-unavailable error (status 16427).

**Restore networking manually after completion, cancellation, or failure.** To cancel, press Ctrl+C; if the process does not exit, terminate it locally. Save the terminal output and remove this run's caches only after all test processes exit. Confirm networking is restored before returning to an assistant.

### Vertical CRS offline acceptance details

#### When to Run

Run this manual acceptance test when changing native GCS resource loading, production GCS workspace settings or published resources, prefetching, workspace cache identity/location, or durable cache reopening. Also run it for native-addon updates affecting those paths and changes to this test's worker lifecycle. It is not required for unrelated changes. The change author owns arranging the runs and recording the results; reviewers should check that evidence before merging. For production resource publications, the publisher owns the equivalent validation before rollout. Run on every affected supported platform; changes to shared loading/cache behavior or worker lifecycle require Windows, macOS, and Linux runs. Record any missing platform run as an outstanding validation requirement, not a pass.

#### Coverage

Each invocation runs one operation in a fresh process using stock production workspace settings and a native addon matching the Node.js architecture and containing the vertical CRS changes under test. The populated cache is retained between prefetch and offline verification; the empty cache must not be used for prefetch. Local GCS fallback is disabled and workspace caches must be daemonless in every operation. The assertions verify dictionary discovery/filtering and bidirectional grid-backed EGM96 conversion, or the specific dictionary-unavailable error for the empty-cache operation.

The test does not change or verify machine connectivity. The operator is responsible for disconnecting and restoring all network paths. The empty-cache control detects some setup errors, not every possible connectivity path; a pass is not proof of complete network isolation. Disconnecting networking can interrupt remote sessions and other applications. Each operation has a ten-minute Mocha timeout. Cache cleanup and network restoration are operator responsibilities.

The unattended resource regression remains independent of this procedure and continues to use its own local endpoint. Builds and automated resource-regression results alone are not production offline acceptance.

#### Evidence and Cleanup

Retain the terminal output and record the OS version, architecture, disconnect/reconnect times, Node version, native package version, loaded addon path and SHA-256, and each operation's pass/fail result in the PR or resource-publication record. The worker logs addon details; record OS version and connectivity changes yourself.

After all test processes exit, remove only the cache directories created for this run. Never remove a cache while a test process is running. Restore any environment variables you changed, or close the dedicated terminal. For a rerun, start with fresh populated and empty caches and repeat all three operations.

#### AI Assistant Handoff

AI assistants used for this workflow require network access. Assistants must not launch or supervise this test through their tools. While the machine is online, provide the complete commands, expected results, cancellation steps, and manual network-restoration instructions, then end the assistant turn. The operator runs the commands independently and returns to the assistant only after networking is restored. Assistants must wait for that confirmation before resuming tool calls.

#### Native Addon

The installed addon is the default. For a separately labeled local-build run, set `ITWIN_VERTICAL_CRS_OFFLINE_ADDON` to the absolute `imodeljs.node` path with its matching platform libraries/assets alongside it, then restore the prior environment value afterward. This does not replace installed dependencies. Native addon build instructions are outside the scope of this document.

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
