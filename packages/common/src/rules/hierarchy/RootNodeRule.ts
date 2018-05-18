/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { NavigationRule } from "./NavigationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/** Root node rules define the nodes that are displayed at the root hierarchy level. */
export interface RootNodeRule extends NavigationRule {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.RootNodeRule;

  /** If this flag is set, nodes created by this rule will be automatically expanded. By default is set to false. */
  autoExpand?: boolean;
}
