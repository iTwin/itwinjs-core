/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module BeSQLite
 */

export enum DbChangeStage {
  Old = 0,
  New = 1
}

export enum DbValueType {
  IntegerVal = 1,
  FloatVal = 2,
  TextVal = 3,
  BlobVal = 4,
  NullVal = 5
}

/** Cause of conflict when applying a changeset. */
export enum DbConflictCause {
  Data = 1,
  NotFound = 2,
  Conflict = 3,
  Constraint = 4,
  ForeignKey = 5,
}

export enum DbConflictResolution {
  /** Skip incoming change */
  Skip = 0,
  /** Replace local row with incoming changed row */
  Replace = 1,
  /** Abort apply changeset */
  Abort = 2,
}

