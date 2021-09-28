/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { MultiSchemaClassesSpecification } from "../ClassSpecifications";
import { ContentSpecificationBase, ContentSpecificationTypes } from "./ContentSpecification";

/**
 * Creates content for ECInstance(s) of specified classes.
 *
 * **Note**: this specification doesn't rely on selection. It always returns instances no matter
 * what the selection is, so pre-filtering should be done in [[ContentRule]] condition and [[instanceFilter]].
 *
 * @see [More details]($docs/presentation/Content/ContentInstancesOfSpecificClasses.md)
 * @public
 */
export interface ContentInstancesOfSpecificClassesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses;

  /**
   * List of ECClass specifications whose ECInstances should be selected.
   */
  classes: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /** Whether to get content from instances of derived `classes`. */
  handleInstancesPolymorphically?: boolean;

  /**
   * Whether to get content from properties of derived `classes`. If `true`, properties from `classes` with no instances
   * do not appear in the result set.
   */
  handlePropertiesPolymorphically?: boolean;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:** [ECExpressions available in instance filter]($docs/presentation/Content/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;
}
