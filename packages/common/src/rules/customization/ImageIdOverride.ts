/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ConditionalCustomizationRuleBase } from "./CustomizationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/**
 * ImageIdOverride is a rule that allows to override default icon and dynamically define an icon for a particular
 * node based on the context.
 */
export interface ImageIdOverride extends ConditionalCustomizationRuleBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.ImageIdOverride;

  /**
   * Defines an ImageId that should be used for nodes that met the condition. This is an ECExpression,
   * so imageId can be defined/formated dynamically based on the context - for example ECInstance property value.
   */
  imageIdExpression?: string;
}
