/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RootNodeRule } from "./hierarchy/RootNodeRule";
import { ChildNodeRule } from "./hierarchy/ChildNodeRule";
import { ContentRule } from "./content/ContentRule";
import { PresentationRuleBase } from "./PresentationRule";

/** Base interface for rules which have condition which needs to be met in order to execute it. */
export interface ConditionalPresentationRuleBase extends PresentationRuleBase {
  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition is an ECExpression,
   * which can use a [limited set of symbols]($docs/learning/customization.md#rule-condition). By default is set to empty string.
   */
  condition?: string;
}

/** Rules which have condition which needs to be met in order to execute it. */
export declare type ConditionalPresentationRule = ChildNodeRule | RootNodeRule | ContentRule;
