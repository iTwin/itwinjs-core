/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ConditionContainer, RuleTypes } from "../Rule";
import { NavigationRuleBase } from "./NavigationRule";

/**
 * Child node rules define nodes that are displayed at
 * each child hierarchy level.
 *
 * @see [More details]($docs/presentation/Hierarchies/ChildNodeRule.md)
 * @public
 */
export interface ChildNodeRule extends NavigationRuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ChildNodes;
}
