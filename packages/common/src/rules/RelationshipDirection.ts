/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

export enum RelationshipDirection {
  /** Follows relationships in both directions (default). */
  Both = "Both",
  /** Follows only Forward relationships. */
  Forward = "Forward",
  /** Follows only Backward relationships. */
  Backward = "Backward",
}
