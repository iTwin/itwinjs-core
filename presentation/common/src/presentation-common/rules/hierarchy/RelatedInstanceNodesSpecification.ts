/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { MultiSchemaClassesSpecification } from "../ClassSpecifications";
import { RelationshipDirection } from "../RelationshipDirection";
import { RepeatableRelationshipPathSpecification } from "../RelationshipPathSpecification";
import { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

/**
 * Creates nodes for related instances of specified ECClasses.
 *
 * **Precondition:** can be used only if parent node is ECInstance
 * node. If there is no immediate parent instance node it will go up until it finds one.
 *
 * @see [More details]($docs/learning/presentation/Hierarchies/RelatedInstanceNodes.md)
 * @public
 */
export type RelatedInstanceNodesSpecification = DEPRECATED_RelatedInstanceNodesSpecification | RelatedInstanceNodesSpecificationNew; // eslint-disable-line deprecation/deprecation

/**
 * @public
 * @deprecated Use [[RelatedInstanceNodesSpecificationNew]]. Will be removed in iModel.js 3.0
 */
export interface DEPRECATED_RelatedInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer { // eslint-disable-line @typescript-eslint/naming-convention
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.RelatedInstanceNodes;

  /**
   * Direction that will be followed in the relationship select criteria.
   * Defaults to [[RelationshipDirection.Both]].
   */
  requiredDirection?: RelationshipDirection;

  /**
   * Relationships that should be followed when gathering content.
   * Optional if [[relatedClasses]] is specified.
   */
  relationships?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Related classes whose instances should be returned as content.
   * Optional if [[relationships]] is specified.
   */
  relatedClasses?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Names of ECSchemas used to look up relationships and classes when [[relationships]]
   * or [[relatedClasses]] are not specified.
   */
  supportedSchemas?: string[];

  /**
   * Skips defined level of related items and shows next level related items.
   *
   * **Example:** lets say we have relationship hierarchy A->B->C, but we want
   * to show A->C. In this case we need to set this property to 1 - the engine will
   * query all direct relationships and all nested relationships and only nested
   * ones will be used to create content.
   *
   * Defaults to `0`.
   *
   * @type integer
   * @minimum 0
   */
  skipRelatedLevel?: number;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:** [ECExpressions Available in InstanceFilter]($docs/learning/presentation/Hierarchies/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;
}

/**
 * @public
 */
export interface RelatedInstanceNodesSpecificationNew extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.RelatedInstanceNodes;

  /**
   * Relationship paths from parent node instance class to child node instances' class.
   */
  relationshipPaths: RepeatableRelationshipPathSpecification[];

  /**
   * Condition for filtering instances targeted by specified relationship paths.
   *
   * **See:** [ECExpressions Available in InstanceFilter]($docs/learning/presentation/Hierarchies/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;
}
