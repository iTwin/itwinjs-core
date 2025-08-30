/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module PresentationRules
 */

import { NavigationRuleBase } from "./NavigationRule.js";

/**
 * Root node rules are used to define nodes that are displayed at the root hierarchy level.
 *
 * @see [Root node rule reference documentation page]($docs/presentation/hierarchies/RootNodeRule.md)
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export interface RootNodeRule extends NavigationRuleBase {
  /** Used for serializing to JSON. */
  ruleType: "RootNodes";

  /** Tells the library to assign produced nodes a flag, indicating that they should be automatically expanded. */
  autoExpand?: boolean;
}
