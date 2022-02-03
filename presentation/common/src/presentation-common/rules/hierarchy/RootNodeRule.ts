/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { RuleTypes } from "../Rule";
import type { NavigationRuleBase } from "./NavigationRule";

/**
 * Root node rules define the nodes that are displayed
 * at the root hierarchy level.
 *
 * @see [More details]($docs/presentation/Hierarchies/RootNodeRule.md)
 * @public
 */
export interface RootNodeRule extends NavigationRuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.RootNodes;

  /** Automatically expand nodes created by this rule. */
  autoExpand?: boolean;
}
