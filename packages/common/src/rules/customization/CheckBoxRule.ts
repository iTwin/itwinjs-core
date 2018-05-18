/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ConditionalCustomizationRuleBase } from "./CustomizationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/**
 * CheckBoxRule is a rule that allows to configure check boxes for certain nodes.
 *
 * Is also allows binding check box state with boolean properties by setting propertyName option.
 * If propertyName is not set, then defaultValue is used for default check box state.
 */
export interface CheckBoxRule extends ConditionalCustomizationRuleBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.CheckBoxRule;

  /** Bool type ECProperty name which is bound with the check box state. By default is set to empty string. */
  propertyName?: string;

  /** Identifies whether the property value should be inversed for the check box state. By default is set to false. */
  useInversedPropertyValue?: boolean;

  /** Default value to use for the check box state. By default is set to false. */
  defaultValue?: boolean;

  /**
   * Indicates whether check box is enabled or disabled.
   *
   * **Note:** Only makes sense when not bound to an ECProperty.
   */
  isEnabled?: string;
}
