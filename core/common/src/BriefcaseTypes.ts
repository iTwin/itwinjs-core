/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { GuidString } from "@bentley/bentleyjs-core";

/** Operations allowed when synchronizing changes between the Briefcase and iModelHub
 * @public
 * @deprecated
 */
export enum SyncMode { FixedVersion = 1, PullAndPush = 2, PullOnly = 3 }

export interface BriefcaseKey {
  /** Id of the iModel */
  iModelId: GuidString;

  /** briefcase Id */
  briefcaseId: number;
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
