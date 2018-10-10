/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";
import { RuleSpecificationTypes } from "../RuleSpecification";
import { RelationshipDirection } from "../RelationshipDirection";
import { SchemasSpecification } from "../SchemasSpecification";

/**
 * Returns all related instance nodes for parent ECInstance node.
 *
 * **Precondition:** can be used only if parent node is ECInstance node. If there is
 * no immediate parent instance node it will go up until it finds one.
 */
export interface AllRelatedInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes.AllRelatedInstanceNodes;

  /**
   * Specification of schemas whose instances should be returned.
   */
  supportedSchemas?: SchemasSpecification;

  /**
   * Direction that will be followed in the relationship select criteria.
   * Defaults to [[RelationshipDirection.Both]].
   */
  requiredDirection?: RelationshipDirection;

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
}
