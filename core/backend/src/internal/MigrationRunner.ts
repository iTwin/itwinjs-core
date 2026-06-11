/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { IModelHubStatus, IModelStatus, Logger } from "@itwin/core-bentley";
import { IModelError, TxnProps } from "@itwin/core-common";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { BriefcaseManager } from "../BriefcaseManager";
import { BriefcaseDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";
import { Migration, MigrationDetails, ReinstatedChanges } from "../Migration";
import { _bumpChannelVersion, _implicitTxn, _nativeDb, _recordMigration } from "./Symbols";

const loggerCategory = BackendLoggerCategory.IModelDb;

/** Maximum number of times to retry the migration apply-and-push cycle when a push race is detected. */
const maxRetries = 5;

/**
 * Applies all pending migrations to the given briefcase and pushes each one to iModel Hub.
 *
 * Called automatically from [[BriefcaseDb.open]] when there are registered migrations that have
 * not yet been applied to this iModel. The algorithm:
 *
 * 1. Pull the latest changesets. The Phase 3 pull flow handles any migration changesets already
 *    pushed by other briefcases, calling `migrateLocalChanges` for each one as needed.
 * 2. If all registered migrations have now been applied (by another briefcase), stop early.
 * 3. Reverse local changes and enter the pull-merge rebase context.
 * 4. For each pending migration in registration order:
 *    a. Run `migrate()` in indirect mode (bypasses lock/channel checks) and save the changeset.
 *    b. Push immediately. On `PullIsRequired` (race) or unexpected error, discard the migration
 *       txn and break. Local changes remain reversed in the native rebase stack.
 *    c. **Per-migration reinstatement cycle**: call `intermediateResume()` to reinstate local
 *       changes on top of the just-pushed migration state, then call `migrateLocalChanges()` so
 *       this migration can reconcile the user's work with its specific post-migration state.
 *       Save, then re-reverse local changes to prepare for the next migration.
 * 5. Final `resume()`: reinstates local changes on top of the fully-migrated iModel, saves
 *    ("Merge."), and fires `notifyPullMergeEnd`. Also covers the break cases from step 4b,
 *    where local changes were already re-reversed before the loop exited.
 * 6. If a race was detected, loop back (up to 5 retries) from step 1.
 *
 * The per-migration reinstatement in step 4c mirrors the Phase 3 pull flow: each
 * `migrateLocalChanges` call sees the iModel in the state immediately after its own migration
 * was applied — not after any later migration has also run.
 *
 * @internal
 */
export async function applyAndPushPendingMigrations(db: BriefcaseDb): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const accessToken = await IModelHost.getAccessToken();

    // Step 1: Pull the latest changesets. The Phase 3 pull flow handles any migration changesets
    // pushed by other briefcases, invoking migrateLocalChanges for each one.
    Logger.logInfo(loggerCategory, `Migration open check: pulling latest changes (attempt ${attempt + 1}/${maxRetries})`);
    await BriefcaseManager.pullAndApplyChangesets(db, { accessToken });

    // Step 2: Check whether there are still pending migrations after the pull.
    const pending = db.channels.getAllPendingMigrations();
    if (pending.length === 0) {
      Logger.logInfo(loggerCategory, "No pending migrations after pull. Migration check complete.");
      return;
    }

    Logger.logInfo(loggerCategory, `Found ${pending.length} pending migration(s). Starting apply-and-push cycle.`);

    // Step 3: Enter the pull-merge rebase context so the user's local changes can be safely
    // reversed and later reinstated around the migration work.
    const nativeDb = db[_nativeDb];
    db.txns.rebaser.notifyPullMergeBegin(db.changeset);
    db.txns.rebaser.notifyReverseLocalChangesBegin();
    const reversedTxns = nativeDb.pullMergeReverseLocalChanges(false);
    const reversedTxnProps = reversedTxns
      .map((txn) => db.txns.getTxnProps(txn))
      .filter((p): p is TxnProps => p !== undefined);
    db.txns.rebaser.notifyReverseLocalChangesEnd(reversedTxnProps);
    Logger.logInfo(loggerCategory, `Reversed ${reversedTxns.length} local change(s) before migration apply.`);

    let raceDetected = false;
    let unexpectedError: unknown;

    for (const migration of pending) {
      Logger.logInfo(loggerCategory, `Applying migration "${migration.id}" for channel "${migration.channelKey}".`);

      // Apply the migration in indirect mode so it bypasses channel lock checks, as specified
      // in the Migration interface contract: locks are neither required nor honored.
      let details: MigrationDetails | undefined;
      await db.txns.withIndirectTxnModeAsync(async () => {
        const txn = db[_implicitTxn];
        db.channels[_bumpChannelVersion](txn, migration.channelKey, migration.compatibility);
        details = await migration.migrate(db);
        db.channels[_recordMigration](txn, migration.channelKey, migration.id, details);
      });

      const description = `[migration:channel=${migration.channelKey};id=${migration.id}] Apply migration "${migration.id}"`;
      nativeDb.saveChanges(description);
      Logger.logInfo(loggerCategory, `Migration "${migration.id}" changes saved. Pushing immediately.`);

      // Push the migration immediately without pulling first. If another briefcase wins the race
      // (hub returns PullIsRequired), we discard the migration work and restart the outer loop.
      try {
        await BriefcaseManager.pushChanges(db, { accessToken, description, retainLocks: true });
        Logger.logInfo(loggerCategory, `Migration "${migration.id}" pushed successfully.`);
      } catch (err: any) {
        nativeDb.discardLocalChanges();
        if (err.errorNumber === IModelHubStatus.PullIsRequired) {
          Logger.logInfo(loggerCategory, `Push race detected for migration "${migration.id}". Discarding and retrying.`);
          raceDetected = true;
        } else {
          Logger.logError(loggerCategory, `Unexpected error pushing migration "${migration.id}": ${(err as Error).message}`);
          unexpectedError = err;
        }
        // In both cases the migration txn is discarded. Local changes remain reversed in the
        // native rebase stack — resume() below will reinstate them.
        break;
      }

      // Per-migration reinstatement cycle, matching the Phase 3 pull flow:
      //   1. Reinstate local changes on top of the just-pushed migration state.
      //   2. Call migrateLocalChanges so this migration can reconcile the user's work.
      //   3. Re-reverse local changes to prepare for the next migration.
      // This ensures migrateLocalChanges sees the iModel in the state right after THIS
      // migration was applied — not after some later migration has also been applied.
      Logger.logInfo(loggerCategory, `Running per-migration reinstatement for migration "${migration.id}".`);
      await db.txns.rebaser.intermediateResume();

      const record = db.channels.getAppliedMigrations(migration.channelKey).find((r) => r.id === migration.id);
      // NOTE (Phase 5): ReinstatedChanges is currently a stub with empty sets.
      // Phase 5 will populate it by reading reinstated txns via the changeset reader.
      const reinstatedChanges: ReinstatedChanges = {
        inserted: new Set<string>(),
        updated: new Set<string>(),
        deleted: new Set<string>(),
      };
      await migration.migrateLocalChanges(db, record?.details ?? details, reinstatedChanges);
      nativeDb.saveChanges(`migrateLocalChanges:${migration.id}`);
      Logger.logInfo(loggerCategory, `migrateLocalChanges complete for migration "${migration.id}".`);

      // Re-reverse local changes to prepare for the next migration (or for the final resume).
      db.txns.rebaser.notifyReverseLocalChangesBegin();
      const reReversedTxns = nativeDb.pullMergeReverseLocalChanges(false);
      const reReversedTxnProps = reReversedTxns
        .map((txn) => db.txns.getTxnProps(txn))
        .filter((p): p is TxnProps => p !== undefined);
      db.txns.rebaser.notifyReverseLocalChangesEnd(reReversedTxnProps);
      Logger.logInfo(loggerCategory, `Re-reversed ${reReversedTxns.length} local change(s) after migration "${migration.id}".`);
    }

    // Final reinstatement: reinstates local changes (including all migrateLocalChanges results)
    // on top of the final post-migration iModel state. Saves and fires notifyPullMergeEnd.
    // Also handles the race/error cases, where local changes were re-reversed before the break.
    Logger.logInfo(loggerCategory, "Final reinstatement after migration cycle.");
    await db.txns.rebaser.resume();

    if (unexpectedError !== undefined)
      throw unexpectedError;

    if (!raceDetected) {
      Logger.logInfo(loggerCategory, "All pending migrations applied successfully.");
      return;
    }

    // Race detected: loop back to retry from the pull step.
  }

  throw new IModelError(
    IModelStatus.BadRequest,
    `Failed to apply pending migrations after ${maxRetries} attempts. The iModel may be under heavy concurrent use.`,
  );
}
