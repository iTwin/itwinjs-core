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
 * Child node rules are used to define child nodes in a hierarchy.
 *
 * @see [Child node rule reference documentation page]($docs/presentation/Hierarchies/ChildNodeRule.md)
 * @public
 */
export interface ChildNodeRule extends NavigationRuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ChildNodes;
}
