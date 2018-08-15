/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ContentSpecificationBase } from "./ContentSpecification";
import { RuleSpecificationTypes } from "../RuleSpecification";
import { MultiSchemaClassesSpecification } from "../ClassSpecifications";

/**
 * Returns ECInstance(s) of specified classes.
 *
 * **Note**: this specification doesn't rely on selection. It always returns instances no matter
 * what the selection is, so pre-filtering should be done in [[ContentRule]] condition and [[instanceFilter]].
 */
export interface ContentInstancesOfSpecificClassesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses;

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
