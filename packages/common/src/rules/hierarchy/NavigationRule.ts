/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecification } from "./ChildNodeSpecification";
import { RuleBase } from "../Rule";
import { CustomizationRule } from "../customization/CustomizationRule";
import { SubCondition } from "./SubCondition";
import { RootNodeRule } from "./RootNodeRule";
import { ChildNodeRule } from "./ChildNodeRule";

/** Base class for all [[NavigationRule]] implementations. */
export interface NavigationRuleBase extends RuleBase {
  /**
   * Specifications that define what content the rule returns.
   */
  specifications?: ChildNodeSpecification[];

  /**
   * Customization rules that are applied for the content returned by
   * this rule.
   */
  customizationRules?: CustomizationRule[];

  /**
   * Specifies child node rules which are only used when specific condition
   * is satisfied.
   */
  subConditions?: SubCondition[];

  /**
   * Stop processing rules that have lower priority. Used in cases when recursion
   * suppression is needed.
   *
   * **Note:** If this flag is set, [[specifications]] and [[subConditions]] are not processed.
   */
  stopFurtherProcessing?: boolean;
}

/**
 * Navigation rules define the hierarchy that's created for navigation controls.
 */
export type NavigationRule = RootNodeRule | ChildNodeRule;
