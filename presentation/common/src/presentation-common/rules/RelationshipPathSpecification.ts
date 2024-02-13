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
 * Specification of a single step in [[RelationshipPathSpecification]].
 *
 * @see [Relationship path specification reference documentation page]($docs/presentation/RelationshipPathSpecification.md)
 * @public
 */
export interface RelationshipStepSpecification {
  /** This attribute specifies the ECRelationship that should be used to traverse to target class. */
  relationship: SingleSchemaClassSpecification;

  /**
   * This attribute specifies the direction in which the [[relationship]] should be followed.
   * @see RelationshipDirection
   */
  direction: `${RelationshipDirection}`;

  /**
   * This attribute may be used to specialize the target of the relationship.
   */
  targetClass?: SingleSchemaClassSpecification;
}

/**
 * Specification of a single step in [[RepeatableRelationshipPathSpecification]].
 *
 * @see [Repeatable relationship path specification reference documentation page]($docs/presentation/RepeatableRelationshipPathSpecification.md)
 * @public
 */
export interface RepeatableRelationshipStepSpecification extends RelationshipStepSpecification {
  /**
   * When a number is specified, the relationship is traversed recursively the specified number of times.
   *
   * When it is set to a special value `"*"`, the same relationship is traversed recursively unbounded number
   * of times, starting from zero (the relationship is not followed). On each traversal iteration, Presentation
   * rules engine accumulates all indirectly related ECInstances as defined by the remaining relationship path.
   */
  count?: number | "*";
}

/**
 * Relationship path specification is used to define a relationship path to an ECClass.
 *
 * @see [Relationship path specification reference documentation page]($docs/presentation/RelationshipPathSpecification.md)
 * @public
 */
export type RelationshipPathSpecification = RelationshipStepSpecification | RelationshipStepSpecification[];

/**
 * This specification declares a step in a relationship path between a source and target ECInstances. A step
 * can optionally be repeated a number of times to traverse the same relationship recursively. Multiple
 * specifications of this type can be chained together to express complex indirect relationships.
 *
 * @see [Repeatable relationship path specification reference documentation page]($docs/presentation/RepeatableRelationshipPathSpecification.md)
 * @public
 */
export type RepeatableRelationshipPathSpecification = RepeatableRelationshipStepSpecification | RepeatableRelationshipStepSpecification[];
