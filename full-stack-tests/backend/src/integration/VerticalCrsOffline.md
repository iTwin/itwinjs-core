# Vertical CRS Testing

## Vertical CRS resource regression

The Vertical CRS resource-unavailability regression is opt-in locally and enabled in the four Node 24 renderer/architecture lanes of `common/config/azure-pipelines/integration-validation.yaml`. It is skipped by default in other pipelines, including PR validation and native/internal builds, and in the weekly Node 20/22 compatibility lanes. It requires the local Azurite blob service and a matching native addon; it does not access production workspace resources. For a focused run from `full-stack-tests/backend`, run `rushx build`, start `rushx azurite:setup` in another terminal, then run `ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS=1 ./node_modules/.bin/mocha lib/cjs/integration/VerticalCrsOffline.test.js --no-config --timeout 1850000`. In PowerShell, set `$env:ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS = '1'` before the Mocha command and restore its previous value afterward. The normal integration test script and CI already start Azurite.

The test uploads a [fixed workspace fixture](./fixtures/README.md) containing EGM96/WGS84 definitions, horizontal dictionaries, and a real EGM96 grid into a unique public Azurite container. A fresh worker anonymously prefetches the workspace through the native stack. The parent deletes the container while Azurite remains running, then starts fresh workers with the same endpoint/container identities: the populated cache must support enumeration and bidirectional EGM96 conversion; an independent empty cache must fail dictionary access. Local GCS fallback is disabled and caches are daemonless. The upload cache is separate from the reader caches. Temporary files and the test-owned container are cleaned up after success or failure. This exercises the native resource/cache integration on each enabled platform, not complete network isolation or unchanged production settings. Production acceptance remains a separate [manual test](#manual-vertical-crs-offline-acceptance).

## Manual Vertical CRS offline acceptance

Run locally from `full-stack-tests/backend`, not through a remote connection. Run `rushx build` first. Create fresh empty directories at `$HOME/vertical-crs-acceptance/populated` and `$HOME/vertical-crs-acceptance/empty`, or substitute your own absolute paths below. Unset `ITWIN_VERTICAL_CRS_RESOURCE_ENDPOINT` if it is set.

**AI assistants do not work while the machine is offline.** Read all steps before disconnecting and complete them without assistant help. See [acceptance details](#vertical-crs-offline-acceptance-details) for run requirements and background.

### Prefetch Online

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

### Verify the Populated Cache Offline

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

### Verify the Empty Cache Offline

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

## Vertical CRS offline acceptance details

### When to Run

Run this manual acceptance test when changing native GCS resource loading, production GCS workspace settings or published resources, prefetching, workspace cache identity/location, or durable cache reopening. Also run it for native-addon updates affecting those paths and changes to this test's worker lifecycle. It is not required for unrelated changes. The change author owns arranging the runs and recording the results; reviewers should check that evidence before merging. For production resource publications, the publisher owns the equivalent validation before rollout. Run on every affected supported platform; changes to shared loading/cache behavior or worker lifecycle require Windows, macOS, and Linux runs. Record any missing platform run as an outstanding validation requirement, not a pass.

### Coverage

Each invocation runs one operation in a fresh process using stock production workspace settings and a native addon matching the Node.js architecture and containing the vertical CRS changes under test. The populated cache is retained between prefetch and offline verification; the empty cache must not be used for prefetch. Local GCS fallback is disabled and workspace caches must be daemonless in every operation. The assertions verify dictionary discovery/filtering and bidirectional grid-backed EGM96 conversion, or the specific dictionary-unavailable error for the empty-cache operation.

The test does not change or verify machine connectivity. The operator is responsible for disconnecting and restoring all network paths. The empty-cache control detects some setup errors, not every possible connectivity path; a pass is not proof of complete network isolation. Disconnecting networking can interrupt remote sessions and other applications. Each operation has a ten-minute Mocha timeout. Cache cleanup and network restoration are operator responsibilities.

The unattended resource regression remains independent of this procedure and continues to use its own local endpoint. Builds and automated resource-regression results alone are not production offline acceptance.

### Evidence and Cleanup

Retain the terminal output and record the OS version, architecture, disconnect/reconnect times, Node version, native package version, loaded addon path and SHA-256, and each operation's pass/fail result in the PR or resource-publication record. The worker logs addon details; record OS version and connectivity changes yourself.

After all test processes exit, remove only the cache directories created for this run. Never remove a cache while a test process is running. Restore any environment variables you changed, or close the dedicated terminal. For a rerun, start with fresh populated and empty caches and repeat all three operations.

### AI Assistant Handoff

AI assistants used for this workflow require network access. Assistants must not launch or supervise this test through their tools. While the machine is online, provide the complete commands, expected results, cancellation steps, and manual network-restoration instructions, then end the assistant turn. The operator runs the commands independently and returns to the assistant only after networking is restored. Assistants must wait for that confirmation before resuming tool calls.

### Native Addon

The installed addon is the default. For a separately labeled local-build run, set `ITWIN_VERTICAL_CRS_OFFLINE_ADDON` to the absolute `imodeljs.node` path with its matching platform libraries/assets alongside it, then restore the prior environment value afterward. This does not replace installed dependencies. Native addon build instructions are outside the scope of this document.
