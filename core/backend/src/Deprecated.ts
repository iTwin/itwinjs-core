/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

// This enum should not have been exported from this package. It has been moved to imodeljs-common and deprecated here.
// It is in this file to maintain backwards compatibility for imports from imodeljs-backend, but so it won't be used by code in imodeljs-backend.

/**
 * @public
 * @deprecated use [BriefcaseIdValue]($common) from `@bentley/imodeljs-common`. It will be removed in 3.0
 */
export enum BriefcaseIdValue {
  /** Indicates an invalid/illegal BriefcaseId */
  Illegal = 0xffffffff,

  /** BriefcaseIds must be less than this value */
  Max = 1 << 24,

  /** All valid iModelHub issued BriefcaseIds will be equal or higher than this */
  FirstValid = 2,

  /** All valid iModelHub issued BriefcaseIds will be equal or lower than this */
  LastValid = BriefcaseIdValue.Max - 11, // eslint-disable-line deprecation/deprecation

  /** A Standalone copy of an iModel. Standalone files may accept changesets, but can never create new changesets.
   * Checkpoints are Standalone files that may not accept any new changesets after they are created.
   */
  Standalone = 0,

  /**
   * @internal
   * @deprecated use Standalone
   */
  DeprecatedStandalone = 1,
}

