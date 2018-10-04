/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { NavigationRuleBase } from "./NavigationRule";
import { RuleTypes } from "../Rule";

/**
 * Root node rules define the nodes that are displayed
 * at the root hierarchy level.
 */
export interface RootNodeRule extends NavigationRuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.RootNodes;

  /** Automatically expand nodes created by this rule. */
  autoExpand?: boolean;
}
