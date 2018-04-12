/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/**
 * Standard status code
 * This should be kept consistent with BentleyStatus defined in Bentley.h
 */
export const enum BentleyStatus {
  SUCCESS = 0x0000,
  ERROR = 0x8000,
}

/**
 * Options to process change sets
 * This should be kept consistent with RevisionProcessOption defined in DgnDomain.h
 */
export const enum ChangeSetProcessOption {
  /** ChangeSet won't be used for upgrade */
  None = 0,
  /** ChangeSet will be merged into the Db */
  Merge,
  /** ChangeSet that was previously merged will be reversed from the Db */
  Reverse,
  /** ChangeSet that was previously reversed will be reinstated into the Db */
  Reinstate,
}
