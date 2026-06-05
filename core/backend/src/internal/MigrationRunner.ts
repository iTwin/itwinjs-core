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
 * 1. Pulls the latest changesets from iModel Hub. The [[Phase 3]] pull flow detects any migration
 *    changesets pushed by other briefcases and calls `migrateLocalChanges` as needed.
 * 2. If all registered migrations have now been applied (by another briefcase), stops early.
 * 3. Reverses any local changes, runs each pending `Migration.migrate()` in indirect mode (bypassing
 *    lock checks), and immediately pushes each migration as its own changeset.
 * 4. If a push fails with `PullIsRequired` (another briefcase pushed first), discards the pending
 *    migration work, reinstates local changes, and retries from step 1.
 * 5. After all migrations are pushed, reinstates local changes and calls `migrateLocalChanges()`
 *    for each applied migration to reconcile the user's local work with the post-migration state.
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

    const appliedMigrations: Array<{ migration: Migration; details: MigrationDetails | undefined }> = [];
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
        appliedMigrations.push({ migration, details });
        Logger.logInfo(loggerCategory, `Migration "${migration.id}" pushed successfully.`);
      } catch (err: any) {
        if (err.errorNumber === IModelHubStatus.PullIsRequired) {
          Logger.logInfo(loggerCategory, `Push race detected for migration "${migration.id}". Discarding migration work and retrying.`);
          // Discard the migration pending txn. The stage remains "Merging" and the user's
          // reversed txns are still in the native rebase stack — resume() below will reinstate them.
          nativeDb.discardLocalChanges();
          raceDetected = true;
          break;
        }

        // Unexpected error: clean up and propagate after reinstating user changes.
        Logger.logError(loggerCategory, `Unexpected error pushing migration "${migration.id}": ${(err as Error).message}`);
        nativeDb.discardLocalChanges();
        unexpectedError = err;
        break;
      }
    }

    // Reinstate local changes. This runs the rebase loop, applying the user's reversed txns
    // on top of the current post-migration iModel state. Local changes win on conflict.
    Logger.logInfo(loggerCategory, `Reinstating local changes after migration cycle.`);
    await db.txns.rebaser.resume();

    if (unexpectedError !== undefined)
      throw unexpectedError;

    // For each successfully applied migration, call migrateLocalChanges() to reconcile the
    // user's reinstated local changes with the post-migration state.
    for (const { migration, details } of appliedMigrations) {
      Logger.logInfo(loggerCategory, `Running migrateLocalChanges for migration "${migration.id}".`);
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
    }

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
