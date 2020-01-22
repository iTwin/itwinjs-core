/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ContentSpecificationBase, ContentSpecificationTypes } from "./ContentSpecification";
import { MultiSchemaClassesSpecification } from "../ClassSpecifications";

/**
 * Creates content for ECInstance(s) of specified classes.
 *
 * **Note**: this specification doesn't rely on selection. It always returns instances no matter
 * what the selection is, so pre-filtering should be done in [[ContentRule]] condition and [[instanceFilter]].
 *
 * @public
 */
export interface ContentInstancesOfSpecificClassesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses;

  /**
   * List of ECClass specifications whose ECInstances should be selected.
   */
  classes: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Should all [[classes]] be treated polymorphically.
   * @deprecated Use `handleInstancesPolymorphically`
   */
  arePolymorphic?: boolean;

  /**
   * Should instances be queried using a polymorphic query - from `classes` and all their
   * subclasses. This doesn't mean the resulting content will have all properties of the subclasses
   * though - they're only taken from base classes specified in `classes` attribute.
   */
  handleInstancesPolymorphically?: boolean;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:** [ECExpressions available in instance filter]($docs/learning/presentation/Content/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;
}
