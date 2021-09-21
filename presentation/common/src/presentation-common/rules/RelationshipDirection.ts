/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * Defines direction of a relationship that should be followed
 * @public
 */
export enum RelationshipDirection {
  /** Relationship should be followed only in forward direction. */
  Forward = "Forward",
  /** Relationship should be followed only in backward direction. */
  Backward = "Backward",
}
