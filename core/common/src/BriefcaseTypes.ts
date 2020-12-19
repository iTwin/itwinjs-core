/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { GuidString } from "@bentley/bentleyjs-core";
import { IModelEncryptionProps, OpenDbKey } from "./IModel";
import { IModelVersionProps } from "./IModelVersion";

/**
 * Status of downloading a briefcase
 * @internal
 */
export enum DownloadBriefcaseStatus {
  NotStarted,
  Initializing,
  QueryCheckpointService,
  DownloadingCheckpoint,
  DownloadingChangeSets,
  ApplyingChangeSets,
  Complete,
  Error,
}

/** Operations allowed when synchronizing changes between the Briefcase and iModelHub
 * @public
 */
export enum SyncMode { FixedVersion = 1, PullAndPush = 2, PullOnly = 3 }

/**
 * Options to open a previously downloaded briefcase
 * @beta
 */
export interface OpenBriefcaseOptions {
  /** open briefcase Readonly */
  openAsReadOnly?: boolean;
}

/**
 * Properties that specify a briefcase within the local briefcase cache.
 * @see BriefcaseManager.getFileName
 * @beta
 */
export interface BriefcaseProps {
  /** Id of the iModel */
  iModelId: GuidString;

  /** BriefcaseId of the briefcase */
  briefcaseId: number;
}

/** Properties for opening a local briefcase file via [BriefcaseDb.open]($backend)
 * @beta
 */
export interface OpenBriefcaseProps extends IModelEncryptionProps, OpenDbKey {
  /** the full path to the briefcase file  */
  fileName: string;
  /** If true, open the briefcase readonly */
  readonly?: boolean;
  /** parameter to control upgrading the briefcase before opening. */
  upgrade?: UpgradeOptions;
}

/** Properties of a local briefcase file, returned by [BriefcaseManager.getCachedBriefcases]($backend)
 * @beta
 */
export interface LocalBriefcaseProps {
  /** full path of local file to store briefcase. If undefined, it will be inferred via `BriefcaseManager.getFilename(props)` */
  fileName: string;

  /** Context (Project or Asset) that the iModel belongs to */
  contextId: GuidString;

  /** The iModelId for the briefcase. */
  iModelId: GuidString;

  /** The briefcaseId of the briefcase */
  briefcaseId: number;

  /** The changesetId of the briefcase */
  changesetId: GuidString;
}

/** Properties for downloading a briefcase to a local file, from iModelHub.
 * @beta
 */
export interface RequestNewBriefcaseProps {
  /** Context (Project or Asset) that the iModel belongs to. */
  contextId: GuidString;

  /** The iModelId for the new briefcase. */
  iModelId: GuidString;

  /** Full path of local file to store the briefcase. If undefined, a file will be created in the briefcase cache, and this member will be filled with the full path to the file.
   * Callers can use this to open the briefcase after the download completes.
   * @note this member is both an input and an output.
   */
  fileName?: string;

  /** The BriefcaseId of the newly downloaded briefcase. If undefined, a new BriefcaseId will be acquired from iModelHub before the download, and is returned in this member.
   * @note this member is both an input and an output.
   *
   */
  briefcaseId?: number;

  /** Id of the change set of the new briefcase. If undefined, use latest. */
  asOf?: IModelVersionProps;
}

/**
 * Manages the download of a briefcase
 * @beta
 */
export interface BriefcaseDownloader {
  /** Id of the briefcase being downloaded */
  briefcaseId: number;

  /** the name of the local file for the briefcase */
  fileName: string;

  /** Promise that resolves when the download completes. await this to complete the download */
  downloadPromise: Promise<void>;

  /** Request cancellation of the download */
  requestCancel: () => Promise<boolean>;
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
  domain?: DomainOptions;

  /** Options that control whether a profile upgrade should be performed when opening a file */
  profile?: ProfileOptions;
}
