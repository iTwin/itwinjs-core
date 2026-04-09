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
 * Child node rules are used to define child nodes in a hierarchy.
 *
 * @see [Child node rule reference documentation page]($docs/presentation/hierarchies/ChildNodeRule.md)
 * @public
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export interface ChildNodeRule extends NavigationRuleBase {
  /** Used for serializing to JSON. */
  ruleType: "ChildNodes";
}
