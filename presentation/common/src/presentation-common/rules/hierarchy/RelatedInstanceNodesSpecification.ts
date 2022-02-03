/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { RepeatableRelationshipPathSpecification } from "../RelationshipPathSpecification";
import type { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

/**
 * Creates nodes for related instances of specified ECClasses.
 *
 * **Precondition:** can be used only if parent node is ECInstance
 * node. If there is no immediate parent instance node it will go up until it finds one.
 *
 * @see [More details]($docs/presentation/Hierarchies/RelatedInstanceNodes.md)
 * @public
 */
export interface RelatedInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.RelatedInstanceNodes;

  /**
   * Relationship paths from parent node instance class to child node instances' class.
   */
  relationshipPaths: RepeatableRelationshipPathSpecification[];

  /**
   * Condition for filtering instances targeted by specified relationship paths.
   *
   * **See:** [ECExpressions Available in InstanceFilter]($docs/presentation/Hierarchies/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;
}
