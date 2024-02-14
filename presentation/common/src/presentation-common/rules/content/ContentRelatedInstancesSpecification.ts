/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RepeatableRelationshipPathSpecification } from "../RelationshipPathSpecification";
import { ContentSpecificationBase } from "./ContentSpecification";

/**
 * Returns content for instances related to the selected (input) instances.
 *
 * @see [Content related instances specification reference documentation page]($docs/presentation/content/ContentRelatedInstances.md)
 * @public
 */
export interface ContentRelatedInstancesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: "ContentRelatedInstances";

  /**
   * Specifies a chain of [relationship path specifications]($docs/presentation/RepeatableRelationshipPathSpecification.md) that
   * forms a path from an input instance to the output instances. When this array is empty, the specification produces no results.
   */
  relationshipPaths: RepeatableRelationshipPathSpecification[];

  /**
   * Specifies an [ECExpression]($docs/presentation/content/ECExpressions.md#instance-filter) for filtering instances
   * of ECClasses targeted through the [[relationshipPaths]] attribute.
   */
  instanceFilter?: string;
}
