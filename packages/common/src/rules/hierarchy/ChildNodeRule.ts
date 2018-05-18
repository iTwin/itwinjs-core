/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { NavigationRule } from "./NavigationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/** Child node rules define the nodes that are displayed at each hierarchy level. */
export interface ChildNodeRule extends NavigationRule {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.ChildNodeRule;
}
