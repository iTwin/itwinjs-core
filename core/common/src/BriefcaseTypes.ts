/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { GuidString } from "@itwin/core-bentley";
import { ChangesetIdWithIndex, ChangesetIndexOrId, LocalFileName } from "./ChangesetProps";
import { OpenDbKey } from "./IModel";
import { IModelVersionProps } from "./IModelVersion";

/** The Id assigned to a briefcase by iModelHub, or [[BriefcaseIdValue.Unassigned]] .
 * @public
 * @extensions
 */
export type BriefcaseId = number;

/** Values of [[BriefcaseId]] that have special meaning.
 * @public
 * @extensions
 */
export enum BriefcaseIdValue {
  /** Indicates an invalid/illegal BriefcaseId */
  Illegal = 0xffffffff,

  /** BriefcaseIds must be less than this value */
  Max = 1 << 24,

  /** All valid iModelHub issued BriefcaseIds will be equal or higher than this */
  FirstValid = 2,

  /** All valid iModelHub issued BriefcaseIds will be equal or lower than this */
  LastValid = BriefcaseIdValue.Max - 11,

  /**
   * The briefcase has not been assigned a unique Id by iModelHub. Only briefcases that have been assigned a unique BriefcaseId may create changesets,
   * because BriefcaseId is used to create unique ElementIds for new elements.
   *
   * The `Unassigned` briefcaseId is used for several purposes:
   *  - **Snapshots**. Snapshot files are immutable copies of an iModel for archival or data exchange purposes. They can neither generate nor accept new changesets.
   *  - **Checkpoints**. Checkpoints are Snapshots that represent a specific version on an iModel's timeline.
   *  - **PullOnly**. A local briefcase file that may be used to "slide" along a timeline by applying incoming changesets.
   * They are always opened readonly except to apply changesets.
   *  - **Standalone**. Standalone iModels are local files that are not connected to iModelHub, and therefore cannot accept or create changesets.
   */
  Unassigned = 0,
}

/** Whether a briefcase is editable or may only accept incoming changesets from iModelHub
 * @public
 * @extensions
 */
export enum SyncMode {
  /** Use a fixed version (i.e. a checkpoint). See [CheckpointManager]($backend) for preferred approach to using checkpoint files. */
  FixedVersion = 1,
  /** A briefcase that can be edited. A unique briefcaseId must be assigned by iModelHub. */
  PullAndPush = 2,
  /** use [BriefcaseIdValue.Unassigned](%backend). This makes a briefcase that can accept changesets from iModelHub but can never create changesets. */
  PullOnly = 3,
}

/**
 * Options to open a previously downloaded briefcase
 * @public
 */
export interface OpenBriefcaseOptions {
  /** open briefcase Readonly */
  readonly openAsReadOnly?: boolean;
}

/**
 * Properties that specify a briefcase within the local briefcase cache.
 * @see BriefcaseManager.getFileName
 * @public
 */
export interface BriefcaseProps {
  /** Id of the iModel */
  readonly iModelId: GuidString;

  /** BriefcaseId of the briefcase */
  readonly briefcaseId: BriefcaseId;
}

/** Properties for opening a local briefcase file via [BriefcaseDb.open]($backend)
 * @public
 */
export interface OpenBriefcaseProps extends OpenDbKey {
  /** the full path to the briefcase file  */
  readonly fileName: LocalFileName;
  /**
   * If true, open the briefcase readonly.
   * @note Readonly connections always hold a read transaction against the briefcase. That can cause the WAL file size to grow
   * unbounded if changes happen while they're open (see [Checkpoint starvation](https://www.sqlite.org/wal.html#avoiding_excessively_large_wal_files))
   * It is a good idea to close the readonly connection *before* closing the writeable connection so the WAL file will be deleted.
   */
  readonly readonly?: boolean;
  /** If true, open the briefcase readonly and monitor it for changes originating from another connection.
   * When such changes are detected, the default txn will be restarted.
   * The restart occurs only after the next iteration of the backend event loop, and will generate events that reflect the changes from the other connection.
   * This can be useful in contexts where the read-only connection is displaying a view of the contents of the briefcase while another, non-interactive program
   * is adding txns to the briefcase. It may not be reliable if the writable connection is undoing or redoing txns.
   * @note This cannot be used with cloud-based briefcases.
   */
  readonly watchForChanges?: boolean;
}

/** Properties of a local briefcase file, returned by [BriefcaseManager.getCachedBriefcases]($backend) and [BriefcaseManager.downloadBriefcase]($backend)
 * @public
 * @extensions
 */
export interface LocalBriefcaseProps {
  /** Full path of local file. */
  readonly fileName: LocalFileName;

  /** The iTwin containing the iModel. */
  readonly iTwinId: GuidString;

  /** The iModelId. */
  readonly iModelId: GuidString;

  /** The briefcaseId. */
  readonly briefcaseId: BriefcaseId;

  /** The current changesetId.
   * @note ChangeSet Ids are string hash values based on the ChangeSet's content and parent.
   */
  readonly changeset: ChangesetIdWithIndex;

  /** Size of the briefcase file in bytes  */
  readonly fileSize: number;
}

/** Properties for downloading a briefcase to a local file, from iModelHub.
 * @public
 * @extensions
 */
export interface RequestNewBriefcaseProps {
  /** iTwin that the iModel belongs to. */
  readonly iTwinId: GuidString;

  /** The iModelId for the new briefcase. */
  readonly iModelId: GuidString;

  /** Full path of local file to store the briefcase. If undefined, a file will be created in the briefcase cache, and this member will be filled with the full path to the file.
   * Callers can use this to open the briefcase after the download completes.
   * @note this member is both an input and an output.
   */
  readonly fileName?: LocalFileName;

  /**
   * The BriefcaseId for the new briefcase. If undefined, a new BriefcaseId will be acquired from iModelHub before the download, and is returned in this member.
   * @note To download a briefcase that can accept but not create new changesets (sometimes referred to as "pull only" briefcases), set this value to [[BriefcaseIdValue.Unassigned]].
   * After downloading, you can merely delete unassigned briefcase files when they are no longer needed. Assigned BriefcaseIds should be released (via [BriefcaseManager.releaseBriefcase]($backend) )
   * when you are done with them.
   * @note this member is both an input and an output.
   *
   */
  briefcaseId?: BriefcaseId;

  /** Id of the change set of the new briefcase. If undefined, use latest. */
  asOf?: IModelVersionProps;
}

/**
 * Arguments to open a Checkpoint directly from its cloud container
 * @beta
 */
export interface OpenCheckpointArgs {
  readonly iTwinId: GuidString;

  /** Id of the iModel */
  readonly iModelId: GuidString;

  /** changeset for the checkpoint. If undefined, attempt to open the checkpoint for the latest changeset. */
  readonly changeset?: ChangesetIndexOrId;
}

/**
 * Manages the download of a briefcase
 * @public
 */
export interface BriefcaseDownloader {
  /** Id of the briefcase being downloaded */
  readonly briefcaseId: BriefcaseId;

  /** the name of the local file for the briefcase */
  readonly fileName: LocalFileName;

  /** Promise that resolves when the download completes. await this to complete the download */
  readonly downloadPromise: Promise<void>;

  /** Request cancellation of the download */
  readonly requestCancel: () => Promise<boolean>;
}

/** Option to control the validation and upgrade of domain schemas in the Db
 * @beta
 */
export enum DomainOptions {
  /** Domain schemas will be validated for any required upgrades. Any errors will be reported back, and cause the application to fail opening the Db */
  CheckRequiredUpgrades = 0,

  /** Domain schemas will be validated for any required or optional upgrades. Any errors will be reported back, and cause the application to fail opening the Db */
  CheckRecommendedUpgrades = 1,

  /** Domain schemas will be upgraded if necessary. However, only compatible schema upgrades will be allowed - these are typically additions of classes, properties, and changes to custom attributes */
  Upgrade = 2,

  /** Domain schemas will neither be validated nor be upgraded. Used only internally */
  SkipCheck = 3,
}

/** Options that control whether a profile upgrade should be performed when opening a Db
 * @beta
 */
export enum ProfileOptions {
  /** No profile upgrade will be performed. If a profile upgrade was required, opening the file will fail */
  None = 0,

  /** Profile upgrade will be performed if necessary */
  Upgrade = 1,
}

/** Arguments to validate and update the profile and domain schemas when opening a Db
 * @beta
 */
export interface UpgradeOptions {
  /** Option to control the validation and upgrade of domain schemas in the Db */
  readonly domain?: DomainOptions;

  /** Options that control whether a profile upgrade should be performed when opening a file */
  readonly profile?: ProfileOptions;

  /** Options that will allow data transform during Profile/Domain schema upgrade */
  readonly schemaLockHeld?: boolean;
}

/**
 * The state of the schemas in the Db compared with what the current version of the software expects
 * Note: The state may vary depending on whether the Db is to be opened ReadOnly or ReadWrite.
 * @public
 */
export enum SchemaState {
  /** The schemas in the Db are up-to-date, and do not need to be upgraded before opening it with the current version of the software */
  UpToDate,

  /** It's required that the schemas in the Db be upgraded before it can be opened with the current version of the software.
   * This may happen in read-write scenarios where the application requires a newer version of the schemas to be in place before
   * it can write data based on that new schema.
   */
  UpgradeRequired,

  /** It's recommended, but not necessary that the schemas in the Db be upgraded before opening it with the current version of the software */
  UpgradeRecommended,

  /** The schemas in the Db are too old to be opened by the current version of the software. Upgrade using the API is not possible. */
  TooOld,

  /** The schemas in the Db are too new to be opened by the current version of the software */
  TooNew,
}
