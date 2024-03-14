/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { CustomizationRule } from "../customization/CustomizationRule";
import { RuleBase } from "../Rule";
import { ChildNodeRule } from "./ChildNodeRule";
import { ChildNodeSpecification } from "./ChildNodeSpecification";
import { RootNodeRule } from "./RootNodeRule";
import { SubCondition } from "./SubCondition";

/**
 * Base class for all [[NavigationRule]] implementations.
 *
 * @see [Hierarchies reference documentation page]($docs/presentation/hierarchies/index.md)
 * @public
 */
export interface NavigationRuleBase extends RuleBase {
  /**
   * Defines a condition which needs to be met in order for the rule to be used. The condition is an
   * [ECExpression]($docs/presentation/hierarchies/ECExpressions.md#rule-condition) which has to evaluate
   * to a boolean value.
   */
  condition?: string;

  /**
   * A list of hierarchy specifications that define what nodes are going to be returned.
   */
  specifications?: ChildNodeSpecification[];

  /**
   * A list of [customization rules]($docs/presentation/hierarchies/index.md#hierarchy-customization) that
   * apply only to nodes produced by this rule.
   */
  customizationRules?: CustomizationRule[];

  /**
   * A list of sub-rules which share *placement attributes* and
   * [nested customization rules]($docs/presentation/hierarchies/ChildNodeRule.md#attribute-customizationrules)
   * of the hierarchy rule. This means the attributes of hierarchy rule are still in effect and the sub-rules
   * can add additional condition of their own.
   */
  subConditions?: SubCondition[];

  /**
   * Stop processing rules that have lower priority. Used in cases when recursion suppression is needed.
   */
  stopFurtherProcessing?: boolean;
}

/**
 * Navigation rules are used to define hierarchies displayed in tree components.
 *
 * @see [Hierarchies reference documentation page]($docs/presentation/hierarchies/index.md)
 * @public
 */
export type NavigationRule = RootNodeRule | ChildNodeRule;
