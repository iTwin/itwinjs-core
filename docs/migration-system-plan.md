# Application Migration System (Channel-Integrated)

## TL;DR

Implement a formal `Migration` interface and runtime system in `core/backend` that is integrated into the existing `ChannelControl` system. Each migration is scoped to a specific channel. Applied migration state (IDs + details) is stored on the `ChannelRootAspect`'s `jsonProperties`. When a migration runs, the system internally calls `upgradeChannel` to bump the channel's semantic version before executing the migration logic.

The system hooks into the existing `pullAndApplyChangesets` / `RebaseManager` flow, adding awareness of specially-tagged "migration changesets" and a per-migration reverse-apply-reinstate-migrateLocalChanges cycle.

---

## Key Architecture Decisions

- **Channel-scoped**: Migrations are managed per-channel.
- **Storage on ChannelRootAspect**: Applied migration records (`{id, details, appliedAt}[]`) live in the `ChannelRootAspect`'s `jsonProperties` of the channel root element. This data is pushed with the migration changeset so all briefcases see it.
- **upgradeChannel integration**: When running a migration, the system calls `upgradeChannel` internally first to bump the channel's `Version` property (using `MigrationCompatibility` to determine major/minor/patch bump). Then `migrate()` is called.
- **Registration on ChannelControl**: Migrations are registered via `ChannelControl.registerMigration(migration)`.

---

## Steps

### Phase 1: Define Core Types

1. **Add `Migration` interface and supporting types** in `core/backend/src/Migration.ts`
   - `Migration` interface: `id: string`, `compatibility: MigrationCompatibility`, `migrate(iModel)`, `migrateLocalChanges(iModel, details, changes)`
   - `MigrationCompatibility` enum: `None` (major bump), `ReadOnly` (minor bump), `ReadWrite` (patch bump)
   - `MigrationDetails` type alias (JSON-serializable or undefined)
   - `ReinstatedChanges` interface: element IDs that were inserted/updated/deleted in reinstated local changesets

### Phase 2: Extend ChannelControl with Migration Registration ✅

2. **Add migration methods to `ChannelControl` interface** in `core/backend/src/ChannelControl.ts` ✅
   - `registerMigration(migration: Migration): void` — register a migration for a channel at app startup (added to interface as part of Phase 3 cleanup)
   - `getAppliedMigrations(channelKey: ChannelKey): MigrationRecord[]` — queries ChannelRootAspect jsonProperties
   - `getPendingMigrations(channelKey: ChannelKey): Migration[]` — registered but not yet applied

3. **Implement in `ChannelAdmin`** (`core/backend/src/internal/ChannelAdmin.ts`)
   - Storage convention: applied migration state lives in `ChannelRootAspect.jsonProperties.migrations: Array<{id: string, details?: any, appliedAt: string}>` (the `jsonProperties` field already exists on aspects via `EntityProps`; the newer BisCore schema already has a `Version` property on `ChannelRootAspect`)
   - Store registered migrations in a `Map<ChannelKey, Migration[]>`
   - `getAppliedMigrations`: query `SELECT JsonProperties FROM bis:ChannelRootAspect WHERE Owner=?`, parse the migrations array
   - `getPendingMigrations`: diff registered vs applied
   - Internal helper: `recordMigration(channelKey, migrationId, details)` — updates the ChannelRootAspect's jsonProperties
   - Internal helper: `bumpChannelVersion(channelKey, compatibility)` — computes new semver from current `Version` + `MigrationCompatibility`, calls existing `upgradeChannel` path

### Phase 3: Modify the Pull Flow ✅

4. **Modify `BriefcaseManager.pullAndApplyChangesets`** to detect migration changesets ✅
   - **No new `ChangesetType`**: Migration changesets are pushed as `ChangesetType.Regular`. There is no change to the `ChangesetType` enum, avoiding backward compatibility issues with the hub and older clients.
   - **Identification approach** (structured description is necessary but not sufficient):
     - When pushing a migration changeset, the system always writes a structured `description` prefix: `[migration:channel=<channelKey>;id=<migrationId>]` followed by a human-readable description.
     - **Absence of prefix = definitely not a migration**: If a changeset description does not start with `[migration:`, it can be safely skipped with no further checks.
     - **Presence of prefix = candidate, requires confirmation**: A user could theoretically type this prefix in a regular push description, so the description alone is not proof. After applying the changeset, confirm by checking that `ChannelRootAspect.jsonProperties.migrations[]` actually has a new entry matching the claimed channel + migration ID.
   - **Backward compatibility**: Older clients see these as `ChangesetType.Regular` changesets and apply them normally. They won't invoke `migrateLocalChanges`, but they won't crash either. The migration records still land in the ChannelRootAspect, so a subsequent app update can detect already-applied migrations.
   - For each changeset in the pull batch:
     a. Does `changeset.description` start with `[migration:`? If no, apply normally and continue.
     b. If yes, parse channel + migration ID from the prefix. Apply the changeset, then verify the corresponding entry exists in `ChannelRootAspect.jsonProperties.migrations[]`.
     c. If confirmed as a migration, determine disposition:
        - Channel not registered locally: continue normally (unrelated channel)
        - Channel registered but migration ID not registered: throw "application update required"
        - Channel registered and migration IS registered: invoke the special reinstatement cycle (step 5)

5. **Implement migration-aware reinstatement** (new internal helper) ✅
   - Called from within the changeset-application loop when a known migration changeset is encountered
   - Steps (local changes were already reversed at the start of pullAndApplyChangesets):
     1. Apply the migration changeset normally
     2. After all changesets are applied: during the rebase phase, when reinstating local txns, call `migrateLocalChanges` for any migrations that were encountered
     3. Capture the migrated local changes as the new Txn
   - **Alternative** (per the proposal's more granular approach): stop the changeset loop at migration changeset, reinstate local, call migrateLocalChanges, reverse again, continue applying remaining changesets. More complex but handles cascading conflicts. *Needs native layer assessment.*
   - **Implemented approach**: simpler deferral — `migrateLocalChanges` is called after all changesets are applied and `resume()`/`resumeSemantic()` completes. `ReinstatedChanges` is a stub with empty sets (Phase 5 will populate it).

### Phase 4: Apply Pending Migrations on Open ✅

6. **Hook into `BriefcaseDb` open flow** to check for pending migrations ✅
   - After `BriefcaseDb.open` completes, check `channels.getAllPendingMigrations()` for all registered channels
   - Only triggers when the briefcase is opened ReadWrite with a hub-connected `briefcaseId`
   - If pending migrations exist: calls `applyAndPushPendingMigrations(db)` from the new `MigrationRunner.ts` module

7. **Implement `applyAndPushPendingMigrations(db)`** (in `core/backend/src/internal/MigrationRunner.ts`) ✅
   1. Pull latest changes — Phase 3 pull flow handles any migration changesets from other briefcases
   2. Re-check pending via `channels.getAllPendingMigrations()`. If none remain, STOP.
   3. Set up pull-merge rebase context: `notifyPullMergeBegin`, reverse local changes via `pullMergeReverseLocalChanges`
   4. For each pending migration (in registration order):
      a. Bump channel version via `channels[_bumpChannelVersion]` (using `migration.compatibility`)
      b. Call `migration.migrate(db)` inside `withIndirectTxnModeAsync` (bypasses lock/channel checks)
      c. Record migration via `channels[_recordMigration]`
      d. Save changes with structured description `[migration:channel=<key>;id=<id>] ...`
      e. Push immediately via `BriefcaseManager.pushChanges` (now `@internal public`):
         - On `PullIsRequired` (race) or unexpected error: discard migration txn, break
      f. **Per-migration reinstatement cycle** (same as Phase 3 pull flow):
         - Call `rebaser.intermediateResume()` to reinstate local changes on top of the post-migration state
         - Call `migration.migrateLocalChanges(db, details, reinstatedChanges)` — sees iModel state right after THIS migration only
         - Save the migrateLocalChanges results
         - Re-reverse local changes to prepare for the next migration
   5. Final reinstatement: call `rebaser.resume()` to reinstate local changes, save ("Merge."), and fire `notifyPullMergeEnd`
      - Also covers race/error cases where local changes were re-reversed before the break
   6. If race detected: loop back (up to 5 retries) for the next attempt

### Phase 5: Build `ReinstatedChanges` Tracking

8. **Implement `ReinstatedChanges`**
    - After reinstating local changes, use changeset reader / native APIs to enumerate changed element IDs
    - Categorize by operation (insert/update/delete) and by EC class
    - Pass to `migrateLocalChanges`

### Phase 6: Integration and Safety ✅

9. **Lock bypass for `migrate()`** ✅
    - Uses `withIndirectTxnModeAsync` in `MigrationRunner.ts` so `migrate()` bypasses channel lock and version checks (indirect mode is whitelisted in `_verifyChannel`)
    - `migrateLocalChanges()` runs in normal mode (user's locks already held)

10. **Retry logic for push-race** ✅
    - `applyAndPushPendingMigrations` retries up to 5 times (matching `pullMergePush`) when push fails with `PullIsRequired`
    - On race: discards migration pending txn, reinstates local changes, loops back to pull step

11. **Channel version reads for compatibility checks** ✅
    - **New `ChannelControlError` keys**: `"version-blocked"` (major version too new — all access should be blocked) and `"version-read-only"` (minor version too new — writes blocked) added to `core/common/src/ITwinCoreErrors.ts`
    - **New `getChannelVersionCompatibility(channelKey)` method** on `ChannelControl` interface — returns `"ok" | "read-only" | "blocked"` based on comparing the channel's current stored semver against the version that would result from applying all registered migrations from `"0.0.0"`
    - **Write-time enforcement in `_verifyChannel`**: before confirming an allowed channel as writable, `computeVersionAccess` is called; throws `"version-blocked"` or `"version-read-only"` as appropriate
    - **Cache invalidation**: `_bumpChannelVersion` now clears `_allowedModels` so that any cached write-access decisions are re-evaluated after a migration bumps the version
    - **Version algorithm**: simulates all registered migrations for a channel in registration order (starting from `"0.0.0"`) to compute the expected version; if the actual stored version exceeds the expected by major → blocked, by minor → read-only, by patch only → ok
    - **Unit tests** added in `core/backend/src/test/standalone/Migration.test.ts`

### Phase 7: Testing

12. **Unit tests** in `core/backend/src/test/`
    - Registration and ordering via ChannelControl
    - Applied/pending migration queries from ChannelRootAspect jsonProperties
    - Version bumping logic (compatibility to semver)

13. **Integration tests** in `full-stack-tests/`
    - Multi-briefcase: one applies migration + pushes, other pulls and runs migrateLocalChanges
    - Race condition: two briefcases apply simultaneously, one wins, other retries
    - "App too old" detection
    - Local changes preserved through cycle
    - Channel version compatibility enforcement (read-only, blocked, etc.)

---

## Relevant Files

- `core/common/src/ChangesetProps.ts` — reference only (no changes needed; migration changesets use `ChangesetType.Regular`)
- `core/common/src/ElementProps.ts` — `ChannelRootAspectProps` (already has `owner`; newer BisCore adds `Version`)
- `core/common/src/TxnProps.ts` — reference for `TxnProps`, `SaveChangesArgs`
- `core/backend/src/ChannelControl.ts` — add `registerMigrations`, `getAppliedMigrations`, `getPendingMigrations` to interface
- `core/backend/src/internal/ChannelAdmin.ts` — implement migration registration, state reads/writes on ChannelRootAspect, version bumping, apply-and-push logic
- `core/backend/src/BriefcaseManager.ts` — modify `pullAndApplyChangesets()` to detect and handle migration changesets
- `core/backend/src/TxnManager.ts` — `RebaseManager.resume()` as template; may need hooks for post-reinstatement migration callbacks
- `core/backend/src/IModelDb.ts` — hook BriefcaseDb.open to trigger pending-migration check
- `core/backend/src/Migration.ts` (NEW) — `Migration` interface, `MigrationCompatibility` enum, `MigrationDetails`, `ReinstatedChanges`
- `core/backend/src/internal/MigrationRunner.ts` (NEW) — internal orchestration of apply/push/reinstate cycle

## Verification

1. `rush build` passes
2. `rush extract-api` shows new `@alpha` additions to `ChannelControl` + new `Migration.ts` exports
3. Unit tests: registration, state queries from jsonProperties, version bump calculations
4. Integration tests: full multi-briefcase cycle, race handling, compatibility enforcement
5. `rush lint` passes
6. Manual: two-briefcase test confirming only one pushes and other reconciles correctly

## Decisions

- **API stability**: `@beta` for all new APIs (Migration, MigrationCompatibility, new ChannelControl methods)
- **No separate MigrationManager**: Migrations live on `ChannelControl` since they're inherently channel-scoped
- **Storage**: `ChannelRootAspect.jsonProperties.migrations[]` for pushed state; briefcase-local values for in-progress state
- **upgradeChannel call**: System calls upgradeChannel internally before each `migrate()`. The compatibility enum determines the semver bump.
- **Scope**: Platform infrastructure only. Application migrations are out of scope.
- **No new `ChangesetType`**: Migration changesets are pushed as `Regular`. Identification uses a structured description prefix as a fast hint, with `ChannelRootAspect.jsonProperties.migrations[]` as the authoritative source. This avoids backward compatibility issues with the hub and older clients.

## Further Considerations

1. **Native layer**: The per-migration-changeset reverse-reinstate cycle may require new native APIs or refactoring of the current "all-at-once" rebase flow. If native changes are blocked, an alternative is to defer migrateLocalChanges to after all changesets are applied (simpler but less correct for cascading conflicts).

2. **Schema changes in migrations**: If `migrate()` also imports schemas, the changeset should be pushed as `ChangesetType.Schema` (the description hint still identifies it as a migration). The pull flow already handles schema changesets specially (cache clearing); the migration detection logic runs independently of `changesType`.

3. **Shared channel migrations**: The shared channel's "root" is the root subject (`IModel.rootSubjectId`). Storing migration records in its ChannelRootAspect requires the aspect to exist (it may need to be created for the shared channel, or use the root subject's own jsonProperties instead).