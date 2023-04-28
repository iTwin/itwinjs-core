/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { NavigationRuleBase } from "./NavigationRule";

/**
 * Root node rules are used to define nodes that are displayed at the root hierarchy level.
 *
 * @see [Root node rule reference documentation page]($docs/presentation/hierarchies/RootNodeRule.md)
 * @public
 */
export interface RootNodeRule extends NavigationRuleBase {
  /** Used for serializing to JSON. */
  ruleType: "RootNodes";

  /** Tells the library to assign produced nodes a flag, indicating that they should be automatically expanded. */
  autoExpand?: boolean;
}
