/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ConditionalPresentationRuleBase } from "../ConditionalPresentationRule";
import { ContentSpecification } from "./ContentSpecification";
import { PresentationRuleTypes } from "../PresentationRule";

/**
 * Content rules define the content that's displayed in content controls (Table view, Property Pane) and the content
 * that's selected in [unified selection]($docs/learning/unified-selection/index.md) controls
 */
export interface ContentRule extends ConditionalPresentationRuleBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.ContentRule;

  /** Rule specifications define what content the rule results in. */
  specifications?: ContentSpecification[];
}
