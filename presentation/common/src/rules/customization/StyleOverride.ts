/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleTypes, RuleBase, ConditionContainer } from "../Rule";

/** Available font styles */
export const enum FontStyle {
  Bold = "Bold",
  Italic = "Italic",
  ItalicBold = "Italic,Bold",
  Regular = "Regular",
}

/**
 * Rule to override default node style and dynamically define a foreground/background
 * colors and a font style for a particular nodes.
 */
export interface StyleOverride extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.StyleOverride;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/learning/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/learning/customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * Foreground color that should be used for node. Supports on of the following formats:
   * - color name (`Red`, `Blue`, etc.)
   * - `rgb(255, 255, 255)`
   * - `#0F0F0F`
   *
   * @pattern ^(\w+|rgb\(\d{1,3}, *\d{1,3}, *\d{1,3}\)|#[0-9a-fA-F]{6})$
   */
  foreColor?: string;

  /**
   * Background color that should be used for node. Supports on of the following formats:
   * - color name (`Red`, `Blue`, etc.)
   * - `rgb(255, 255, 255)`
   * - `#0F0F0F`
   *
   * @pattern ^(\w+|rgb\(\d{1,3}, *\d{1,3}, *\d{1,3}\)|#[0-9a-fA-F]{6})$
   */
  backColor?: string;

  /**
   * Font style that should be used for nodes that meet the condition.
   * Defaults to [[FontStyle.Regular]].
   */
  fontStyle?: FontStyle;
}
