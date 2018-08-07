/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleTypes, RuleBase, ConditionContainer } from "../Rule";
import { ContentSpecification } from "./ContentSpecification";

/**
 * Defines content that's displayed in content controls (table view,
 * property pane, etc.) and the content that's selected in
 * [unified selection]($docs/learning/unified-selection/index.md) controls
 */
export interface ContentRule extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.Content;

  /** Specifications that define content returned by the rule */
  specifications: ContentSpecification[];
}
