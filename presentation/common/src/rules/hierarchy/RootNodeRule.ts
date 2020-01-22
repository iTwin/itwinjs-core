/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { NavigationRuleBase } from "./NavigationRule";
import { RuleTypes } from "../Rule";

/**
 * Root node rules define the nodes that are displayed
 * at the root hierarchy level.
 *
 * @public
 */
export interface RootNodeRule extends NavigationRuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.RootNodes;

  /** Automatically expand nodes created by this rule. */
  autoExpand?: boolean;
}
