/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RepeatableRelationshipPathSpecification } from "../RelationshipPathSpecification";
import { ContentSpecificationBase, ContentSpecificationTypes } from "./ContentSpecification";

/**
 * Creates content for ECInstance(s) related to current selection.
 *
 * **Note:** Use [[ContentRule.condition]] to apply specification on correct selection.
 *
 * @see [More details]($docs/presentation/Content/ContentRelatedInstances.md)
 * @public
 */
export interface ContentRelatedInstancesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: ContentSpecificationTypes.ContentRelatedInstances;

  /**
   * Relationship paths from input (selected) instance class to content class.
   */
  relationshipPaths: RepeatableRelationshipPathSpecification[];

  /**
   * Condition for filtering instances targeted by specified relationship paths.
   *
   * **See:** [ECExpressions available in instance filter]($docs/presentation/Content/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;
}
