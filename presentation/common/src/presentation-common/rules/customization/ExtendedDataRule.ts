/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RuleBase } from "../Rule";

/**
 * Extended data rule is used to inject some arbitrary data into presentation data objects (nodes, content records).
 *
 * @see [Extended data rule reference documentation page]($docs/presentation/customization/ExtendedDataRule.md)
 * @public
 */
export interface ExtendedDataRule extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "ExtendedData";

  /**
   * Defines a condition which needs to be met in order for the rule to be used. The condition
   * is an [ECExpression]($docs/presentation/customization/ECExpressions.md#rule-condition) which has
   * to evaluate to a boolean value.
   */
  condition?: string;

  /**
   * A map of [ECExpressions]($docs/presentation/customization/ECExpressions.md#rule-condition) whose
   * evaluation results are used as extended data values.
   */
  items: { [key: string]: string };
}
