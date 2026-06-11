/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import type { Id64String } from "@itwin/core-bentley";
import type { BriefcaseDb } from "./IModelDb";
import type { ChannelKey } from "./ChannelControl";

/** Indicates how the channel's read/write compatibility is affected by running a [[Migration]].
 * @beta
 */
export enum MigrationCompatibility {
  /**
   * After applying this migration, older applications that work with the migrated Editing Channel
   * but are not aware of this migration may not access the channel at all because it will no
   * longer make sense to them.
   *
   * This corresponds to a bump of the "read compatibility" (major version) component of the
   * channel's semantic version.
   */
  None,

  /**
   * After applying this migration, older applications that work with the migrated Editing Channel
   * but are not aware of this migration may _read_ the channel data, but they may not _write_ to
   * it. The data will continue to make sense to older applications, but they cannot edit it
   * without introducing problems.
   *
   * This corresponds to a bump of the "write compatibility" (minor version) component of the
   * channel's semantic version.
   */
  ReadOnly,

  /**
   * After applying this migration, older applications that work with the migrated Editing Channel
   * but are not aware of this migration may both read and write the channel data. Only migrations
   * that have a no-op implementation of `migrateLocalChanges` should ever use this compatibility
   * mode.
   *
   * This corresponds to a bump of the "minor increment" (patch version) component of the
   * channel's semantic version.
   */
  ReadWrite,
}

/** A JSON-serializable value returned by [[Migration.migrate]] and stored alongside the migration's
 * completion record in the iModel. This value is later passed to [[Migration.migrateLocalChanges]]
 * so that it can understand what the migration did without re-examining the iModel.
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MigrationDetails = any;

/** Describes the elements that were inserted, updated, or deleted in reinstated local changesets.
 * This is passed to [[Migration.migrateLocalChanges]] so it can adjust the user's local changes
 * to be compatible with the post-migration state.
 * @beta
 */
export interface ReinstatedChanges {
  /** Element IDs that were inserted in the reinstated local changes. */
  readonly inserted: ReadonlySet<Id64String>;
  /** Element IDs that were updated in the reinstated local changes. */
  readonly updated: ReadonlySet<Id64String>;
  /** Element IDs that were deleted in the reinstated local changes. */
  readonly deleted: ReadonlySet<Id64String>;
}

/** A record of a [[Migration]] that has been applied to an iModel.
 * Applied migration records are stored in the channel root element's `jsonProperties.migrations` array
 * and are pushed as part of the migration changeset so all briefcases see them.
 * @see [[ChannelControl.getAppliedMigrations]]
 * @beta
 */
export interface MigrationRecord {
  /** The unique identifier of the applied migration. */
  readonly id: string;
  /** The value returned by [[Migration.migrate]], if any. */
  readonly details: MigrationDetails | undefined;
  /** ISO 8601 timestamp of when the migration was applied. */
  readonly appliedAt: string;
}

/** Defines a channel-scoped data migration that can be applied to a [[BriefcaseDb]].
 *
 * Migrations are registered at startup and applied, when necessary, in the order in which they
 * are registered. The [[migrate]] method runs exactly once per iModel on a clean baseline (local
 * changes reversed). The [[migrateLocalChanges]] method runs once for each user whose local
 * changes are reinstated after the migration has already been applied.
 *
 * @see [Application Updates]($docs/learning/backend/ApplicationUpdates.md) for an overview of the migration system.
 * @beta
 */
export interface Migration {
  /** Unique identifier for this migration. Must be stable across application versions. */
  readonly id: string;

  /** The key of the Editing Channel that this migration modifies. */
  readonly channelKey: ChannelKey;

  /** Indicates the backward-compatibility of the Editing Channel after applying this migration. */
  readonly compatibility: MigrationCompatibility;

  /**
   * Runs exactly once per iModel, on a clean baseline (local changes have been reversed).
   * May return a JSON-serializable details value that is stored in the iModel alongside
   * the migration's completion record.
   *
   * During execution, locks are neither required nor honored — the migration changeset is
   * pushed immediately and atomically.
   *
   * @param iModel The briefcase database to migrate.
   * @returns An optional JSON-serializable value describing what the migration did. This value
   *   is persisted and later passed to [[migrateLocalChanges]].
   */
  migrate(iModel: BriefcaseDb): Promise<MigrationDetails | undefined>;

  /**
   * Runs after local changes are reinstated on a post-migration iModel.
   * Called zero or more times — once for each user whose local changes are applied
   * after this migration has already run.
   *
   * The implementation should adjust any reinstated local changes that are incompatible with
   * the post-migration state. The resulting modifications are captured as a new local Txn.
   *
   * @param iModel The briefcase database with reinstated local changes.
   * @param details The value returned by [[migrate]], or `undefined` if it returned nothing.
   * @param changes The complete set of element IDs that changed in the reinstated local changesets.
   */
  migrateLocalChanges(
    iModel: BriefcaseDb,
    details: MigrationDetails | undefined,
    changes: ReinstatedChanges,
  ): Promise<void>;
}
