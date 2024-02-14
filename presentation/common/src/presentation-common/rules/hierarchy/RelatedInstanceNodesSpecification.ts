/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RepeatableRelationshipPathSpecification } from "../RelationshipPathSpecification";
import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

/**
 * Produces ECInstance nodes that are related to some source ECInstance. The source instance is determined
 * by traversing the hierarchy upwards until an ECInstance node is encountered.
 *
 * @see [Related instance nodes specification reference documentation page]($docs/presentation/hierarchies/RelatedInstanceNodes.md)
 * @public
 */
export interface RelatedInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: "RelatedInstanceNodes";

  /**
   * Specifies a chain of [relationship path specifications]($docs/presentation/RepeatableRelationshipPathSpecification.md)
   * that forms a path from a source instance to the output instances. When this array is empty, the specification produces
   * no results.
   */
  relationshipPaths: RepeatableRelationshipPathSpecification[];

  /**
   * Specifies an [ECExpression]($docs/presentation/hierarchies/ECExpressions.md#instance-filter) for filtering
   * instances of ECClasses targeted through the [[relationshipPaths]] attribute.
   */
  instanceFilter?: string;
}
