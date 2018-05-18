/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecification } from "./ChildNodeSpecification";
import { ConditionalPresentationRuleBase } from "../ConditionalPresentationRule";
import { CustomizationRule } from "../customization/CustomizationRule";
import { SubCondition } from "./SubCondition";

/**
 * Navigation rules define the hierarchy that's created for navigation controls.
 * There are 2 types of rules:
 * - [[RootNodeRule]] defines the nodes at the root hierarchy level.
 * - [[ChildNodeRule]] defines the nodes at all other hierarchy levels.
 *
 * Each rule can define any number of specifications [[ChildNodeSpecification]].
 *
 * Navigation rules also support [nested rules]($docs/learning/hierarchies/Terminology.md#nested-rules)
 * and [[RelatedInstanceSpecification]].
 */
export interface NavigationRule extends ConditionalPresentationRuleBase {
  subConditions?: SubCondition[];
  specifications?: ChildNodeSpecification[];
  customizationRules?: CustomizationRule[];

  /**
   * If this flag is set PresentationRulesProcessor will stop processing rules that are lower priority. This really
   * helps in cases when recursion suppression is needed.
   *
   * **Note:** If this flag is set, [[specifications]] and
   * [[subConditions]] will not be processed.
   */
  stopFurtherProcessing?: boolean;
}
