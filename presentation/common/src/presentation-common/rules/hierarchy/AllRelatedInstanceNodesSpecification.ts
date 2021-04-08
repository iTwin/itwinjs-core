/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RelationshipDirection } from "../RelationshipDirection";
import { SchemasSpecification } from "../SchemasSpecification";
import { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

/**
 * Creates nodes for all related instances for parent ECInstance node.
 *
 * **Precondition:** can be used only if parent node is ECInstance node. If there is
 * no immediate parent instance node it will go up until it finds one.
 *
 * @public
 * @deprecated Use [[RelatedInstanceNodesSpecification]]. Will be removed in iModel.js 3.0
 */
export interface DEPRECATED_AllRelatedInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer { // eslint-disable-line @typescript-eslint/naming-convention
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.DEPRECATED_AllRelatedInstanceNodes;

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
