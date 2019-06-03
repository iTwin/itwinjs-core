/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

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
   */
  arePolymorphic?: boolean;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:** [ECExpressions available in instance filter]($docs/learning/content/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;
}
