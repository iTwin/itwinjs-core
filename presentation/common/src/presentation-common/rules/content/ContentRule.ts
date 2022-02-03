/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { ConditionContainer, RuleBase, RuleTypes } from "../Rule";
import type { ContentSpecification } from "./ContentSpecification";

/**
 * Defines content that's displayed in content controls (table view,
 * property pane, etc.) and the content that's selected in
 * [unified selection]($docs/presentation/unified-selection/index.md) controls
 *
 * @see [More details]($docs/presentation/Content/ContentRule.md)
 * @public
 */
export interface ContentRule extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.Content;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Content/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /** Specifications that define content returned by the rule */
  specifications: ContentSpecification[];
}
