/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { SingleSchemaClassSpecification } from "./ClassSpecifications";
import { RelationshipDirection } from "./RelationshipDirection";

/**
 * Specification of a single relationship path step.
 * @public
 */
export interface RelationshipStepSpecification {
  /** Specification of the relationship to use for joining the related instance. */
  relationship: SingleSchemaClassSpecification;

  /** Relationship direction that should be followed to find the target class. */
  direction: RelationshipDirection.Forward | RelationshipDirection.Backward;

  /**
   * Specification of the target class. Either relationship's source or target class is used (based
   * on specified direction) if more specific target class is not specified by this attribute.
   */
  targetClass?: SingleSchemaClassSpecification;
}

/**
 * Specification of a single relationship path step.
 * @public
 */
export interface RepeatableRelationshipStepSpecification extends RelationshipStepSpecification {
  /**
   * Number of relationship steps that should be taken. Special `*` value means that
   * relationship is traversed recursively and all matching instances are accumulated.
   * Defaults to `1`.
   */
  count?: number | "*";
}

/**
 * Specification of a relationship path.
 *
 * @see [More details]($docs/presentation/Common-Rules/RelationshipPathSpecification.md)
 * @public
 */
export type RelationshipPathSpecification = RelationshipStepSpecification | RelationshipStepSpecification[];

/**
 * Specification of a repeatable relationship path.
 *
 * @see [More details]($docs/presentation/Common-Rules/RelationshipPathSpecification.md)
 * @public
 */
export type RepeatableRelationshipPathSpecification = RepeatableRelationshipStepSpecification | RepeatableRelationshipStepSpecification[];
