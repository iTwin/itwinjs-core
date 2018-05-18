/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ConditionalCustomizationRuleBase } from "./CustomizationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/**
 * StyleOverride is a rule that allows to override default node style and dynamically define a foreground/background
 * colors and a font style for a particular node based on the context.
 */
export interface StyleOverride extends ConditionalCustomizationRuleBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.StyleOverride;

  /** Defines the foreground color that should be used for nodes that meet the condition. */
  foreColor?: string;

  /** Defines the background color that should be used for nodes that meet the condition. */
  backColor?: string;

  /** Defines the font style that should be used for nodes that meet the condition. */
  fontStyle?: string;
}
