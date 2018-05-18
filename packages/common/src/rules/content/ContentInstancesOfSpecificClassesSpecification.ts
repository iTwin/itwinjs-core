/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ContentSpecificationBase } from "./ContentSpecification";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";

/**
 * Returns ECInstance(s) of specified classes.
 *
 * **Note**: This specification doesn't rely on selected node. It always returns instances for any selected node, so
 * pre-filtering should be done in [[ContentRule]] condition.
 */
export interface ContentInstancesOfSpecificClassesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.ContentInstancesOfSpecificClassesSpecification;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:** [ECExpressions Available in InstanceFilter]($docs/learning/content/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;

  /**
   * Comma separated names of ECClasses whose ECInstances should be selected.
   * Format: `SchemaName1:ClassName11,ClassName12;SchemaName2:ClassName21,ClassName22`
   */
  classNames: string;

  /**
   * If this option is set to true, all classes specified by classNames will be marked as polymorphic in the query.
   * By default is set to false.
   */
  arePolymorphic?: boolean;
}
