/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { NavigationRuleBase } from "./NavigationRule";
import { RuleTypes, ConditionContainer } from "../Rule";

/**
 * Child node rules define nodes that are displayed at
 * each child hierarchy level.
 */
export interface ChildNodeRule extends NavigationRuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ChildNodes;
}
