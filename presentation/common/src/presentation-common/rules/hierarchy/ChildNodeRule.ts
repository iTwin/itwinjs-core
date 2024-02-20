/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { NavigationRuleBase } from "./NavigationRule";

/**
 * Child node rules are used to define child nodes in a hierarchy.
 *
 * @see [Child node rule reference documentation page]($docs/presentation/hierarchies/ChildNodeRule.md)
 * @public
 */
export interface ChildNodeRule extends NavigationRuleBase {
  /** Used for serializing to JSON. */
  ruleType: "ChildNodes";
}
