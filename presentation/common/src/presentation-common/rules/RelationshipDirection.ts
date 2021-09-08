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
  /**
   * Relationship should be followed in both directions.
   * @deprecated Using both sides direction should be unnecessary when using [[RelationshipPathSpecification]]. Will be removed in iModel.js 3.0
   */
  Both = "Both",
  /** Relationship should be followed only in forward direction. */
  Forward = "Forward",
  /** Relationship should be followed only in backward direction. */
  Backward = "Backward",
}
