# Rush build cache: audit and trusted writers

This is the rollout guide for [backlog issue #2548, workstream 3](https://github.com/iTwin/itwinjs-backlog/issues/2548). The repository changes prepare Windows, macOS, and Linux writers. An Azure DevOps resource owner must complete the credential setup before merging. YAML conditions and `RUSH_BUILD_CACHE_WRITE_ALLOWED=0` are not security boundaries.

## Audit findings

The audit used the checked-out configuration and read-only Azure DevOps and Azure Storage queries on November 2, 2026. No remote configuration was changed.

- `templates/core-build.yaml` is called by `jobs/fast-ci.yaml`, hosted `ci.yaml`, and `jobs/regression-testing.yaml`. Only fast CI opts into writing. Hosted, regression, documentation, and integration builds remain readers. GitHub Actions does not configure this Azure cache.
- Previously, the helper allowed Linux `IndividualCI` and `Manual` runs without checking the source branch. The unused `shouldWriteToCache` pipeline variable did not constrain it.
- Variable group **Rush Build Cache SAS Token** (ID `2196`) contains the secret `RushBuildCacheSAS`. Its authorized pipeline IDs were `4300`, `4301`, `6798`, `7436`, `8110`, `8289`, and `9162`. The resource checks API returned no checks. The secret value, SAS permissions, expiry, and uses outside this repository were not inspected.
- The existing `itwinbuildcache/itwincache` container has no public access. A private container does not prevent an authorized PR job from reading its contents.
- `buildCacheEnabled: false` is overridden by `RUSH_BUILD_CACHE_ENABLED=1` in CI. `[os]-[arch]-[hash]` separates platform and architecture, but does not include Node. Rush 5.182.1 supports `cacheHashSalt` and `RUSH_BUILD_CACHE_OVERRIDE_JSON`; the helper uses those to add the exact running Node version without modifying tracked configuration at runtime.
- Rush hashes project/dependency inputs and dependency versions. TypeScript, bundler, Electron, and the published native package versions are dependency inputs. Untracked `IMODELJS_NATIVE_OVERRIDE` artifacts are not equivalent to their path strings: both reads and writes are disabled when an override or `nativePrVal` is present. Node-compatibility integration lanes still disable caching to prove a fresh build.
- `full-stack-tests/core`, `core/electron`, and `core/i18n` embed the job environment through webpack `DefinePlugin` during `build`. Both display apps use Vite's `IMJS_` environment prefix. These five builds produce bundles under `lib`, so their build operations are excluded from caching, not merely rebundled after a restore. Keep the existing `webpack:test` steps for current-job test configuration. Other unit-test bundles made later by `webpack:test` are not new cache entries for `build`.
- Compiled library output and bundled source maps can contain checkout paths. OS/architecture separation does not prove checkout-location portability. Hosted-agent and different-workspace validation remain rollout requirements.

### Observed master builds

These are build-task elapsed times, not total pipeline or queue-inclusive times. They are baseline observations, not estimates of savings.

| Build | Linux x64 | macOS | Windows |
| --- | --- | --- | --- |
| [5908122](https://dev.azure.com/bentleycs/iModelTechnologies/_build/results?buildId=5908122) | 1.23 min | 1.23 min | 2.42 min |
| [5923708](https://dev.azure.com/bentleycs/iModelTechnologies/_build/results?buildId=5923708) | 1.31 min | 1.18 min | 2.32 min |

For `5923708`, Rush reported 31 operations restored on Linux x64, 26 successful, and 2 no-op. macOS and Windows each reported 57 successful and 2 no-op, with no restored operations and 56 cache-miss messages. Linux ARM64 also restored operations and uploaded entries. No workspace-skip summary was reported in these build tasks. This does not rule out other writers or retained local caches elsewhere.

To reproduce, use the timeline to find each platform's `rush build` task, then inspect its log. Do not copy SAS credentials or environment dumps into audit evidence.

```sh
az devops invoke --org https://dev.azure.com/bentleycs \
  --area build --resource timeline \
  --route-parameters project=iModelTechnologies buildId=5923708
# Replace LOG_ID with a rush build task's log.id from the timeline.
az devops invoke --org https://dev.azure.com/bentleycs \
  --area build --resource logs \
  --route-parameters project=iModelTechnologies buildId=5923708 logId=LOG_ID
```

## Provision credentials and resource checks

Do not merge the writer-group reference until these steps are complete. Changes to live credentials require coordination with the owners of all seven authorized pipelines and any external template consumers.

1. Create a new private container named `itwincache-v2` in `itwinbuildcache`. Do not copy entries from `itwincache`: old entries may include environment-injected bundles or output from previously unrestricted writers. A salt change alone does not revoke access to old blobs.
2. Create separate, short-lived, HTTPS-only, container-scoped SAS credentials for the new container. Prefer user-delegation SAS credentials. The reader needs **read only** (`r`). The writer needs **read, create, and write** (`rcw`), with no delete, list, account-key, or container-management permission. Record expiry and rotation ownership outside the repository. Never paste the credentials into YAML, logs, or this guide.
3. Replace `RushBuildCacheSAS` in **Rush Build Cache SAS Token** with the new read-only credential. Preserve reader pipeline authorizations. Inventory definition-level variables, agent environment variables, local Rush credentials, and other groups for old write credentials. Retire or revoke old write grants after coordinating their consumers; deleting or replacing a variable does not revoke an already issued SAS. Review historical bundles and rotate affected application secrets if an exposure is confirmed.
4. Create **Rush Build Cache Writer SAS Token** with one secret, `RushBuildCacheWriteSAS`. Disable open access and authorize only fast-CI pipeline `4300` (**iTwin.js**). Limit group administration and pipeline-definition administration to the CI owners. Do not grant the pipeline build identity permission to edit checks or variable groups.
5. On the writer group, open **Approvals and checks** and add **Branch control**. Allow only `refs/heads/master` and the explicitly approved `refs/heads/release/...` branches. Require branch protection and fail when protection cannot be determined. Confirm the GitHub protection status is recognized. Keep this release list synchronized with protected release branches; a `release/` name alone is not proof of protection.
6. Verify that PR and arbitrary-ref runs cannot consume the writer group even if their YAML is modified to request it. Normal PR/manual builds, including manual master builds, omit the group and use the read-only credential. Do not approve a resource authorization request from an untrusted run. Keep the existing fork-secret and self-hosted-agent restrictions.

[Azure resource checks](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/approvals?view=azure-devops) are administered outside YAML and execute before a consuming stage starts. Branch control establishes the trust boundary; the CI-reason filter is in the protected pipeline YAML and helper. Branch control alone does not prohibit a manual run of trusted master code from accessing a group if a future protected YAML change requests it. If organizational policy requires independent reason enforcement too, add a server-side check of the authoritative build record before authorizing the group. If the protected-branch checks cannot be enforced, keep the writer group unauthorized; do not fall back to the old write-capable shared SAS.

## Validate the rollout

Run the local policy tests:

```sh
node --test common/scripts/test/set-rush-write-cache-variables.test.js
```

The tests cover all three OS names, protected-ref patterns, CI/manual/PR reasons, missing metadata, fork rejection, native overrides, exact Node-version isolation, and secret-bearing build exclusions. They do not prove Azure resource authorization or storage permissions.

Before enabling general cache reads, verify:

- A read-only SAS cannot create or overwrite a disposable blob, even with `RUSH_BUILD_CACHE_WRITE_ALLOWED=1`. Test in an isolated validation container, not against production entries. Never log the SAS URL.
- A test PR and an arbitrary-ref manual run that request the writer group fail resource checks before any job receives the credential. A normal manual run on master omits the writer group and remains read-only. Capture the rejected resource checks, not just the helper's output.
- Trusted master/release CI writes entries on Linux x64/ARM64, Windows, and macOS. A second clean checkout on each platform restores library operations. Keep test suites, results, mobile jobs, and blocking gates unchanged.
- Restored output works on another checkout path/agent. Changes to source, transitive dependencies, lockfile/toolchain versions, Node patch versions, or OS/architecture do not replay incompatible output. Native-under-test lanes show caching disabled. The five environment-dependent build operations always execute and never upload their bundles.
- Changing test-user configuration regenerates bundles from the current job. Verify configured exclusions and scan a controlled sample of new cache archives for known test sentinel values before making the reader token available to fork jobs. Do not use real secrets as sentinels.
- Compare at least ten representative successful runs after rollout with a comparable baseline. Record cache-restored/executed operations, misses/uploads, build-task duration, queue-inclusive pipeline p50/p90, agent-minutes, and reruns. Cold-cache population and Node-version changes can initially increase work. Do not attribute total pipeline improvements to caching from these two baseline builds.

The new container, credential rotation/revocation, resource checks, storage-negative tests, platform portability tests, and post-change measurements are operator rollout work, not completed by the repository changes.

## Roll back

Revoke the writer group's pipeline authorization first to stop new writes server-side. Remove the writer-group inclusion and opt-in from `jobs/fast-ci.yaml` together so normal builds continue as readers. If cache contents are suspect, set `rushBuildCacheEnabled: 0` in affected template callers while investigating. Keep the read-only credential and never restore the legacy write-capable shared credential. Do not return to the old container without a separate contents and access review.
