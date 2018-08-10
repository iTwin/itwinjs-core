/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleTypes, RuleBase } from "../Rule";
import { SingleSchemaClassSpecification } from "../ClassSpecifications";

/**
 * Rule to override labels for instances of specific ECClasses.
 *
 * **Important:** Prefer this rule over [[LabelOverride]] when possible as it
 * has better performance.
 */
export interface InstanceLabelOverride extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.InstanceLabelOverride;

  /**
   * Specification of the ECClass to apply this rule to.
   */
  class: SingleSchemaClassSpecification;

  /**
   * Names of properties which should be used as instance label. The
   * first property that has a value is used as the actual label.
   */
  propertyNames: string[];
}
