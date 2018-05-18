/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ConditionalCustomizationRuleBase } from "./CustomizationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/**
 * LabelOverride is a rule that allows to override default label and description (tooltip) and dynamically define them
 * for a particular node based on the context.
 */
export interface LabelOverride extends ConditionalCustomizationRuleBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.LabelOverride;

  /**
   * Defines the label that should be used for nodes that meet the condition. This is an ECExpression, so label can be
   * defined/formatted dynamically based on the context - for example ECInstance property value. May be
   * [localized]($docs/learning/Localization.md).
   */
  label?: string;

  /**
   * Defines the description (tooltip) that should be used for nodes that meet the condition. This is an ECExpression,
   * so description can be defined/formatted dynamically based on the context - for example
   * ECInstance property value. May be [localized]($docs/learning/Localization.md).
   */
  description?: string;
}
