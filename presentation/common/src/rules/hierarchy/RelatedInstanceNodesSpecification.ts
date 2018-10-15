/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";
import { RuleSpecificationTypes } from "../RuleSpecification";
import { RelationshipDirection } from "../RelationshipDirection";
import { MultiSchemaClassesSpecification } from "../ClassSpecifications";

/**
 * Returns related instance nodes of specified related ECClasses.
 *
 * **Precondition:** can be used only if parent node is ECInstance
 * node. If there is no immediate parent instance node it will go up until it finds one.
 */
export interface RelatedInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes.RelatedInstanceNodes;

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
   * **See:** [ECExpressions Available in InstanceFilter]($docs/learning/hierarchies/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;
}
