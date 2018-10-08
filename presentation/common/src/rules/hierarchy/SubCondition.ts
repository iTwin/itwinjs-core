/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecification } from "./ChildNodeSpecification";
import { ConditionContainer } from "../Rule";

/**
 * Defines child node specifications which should only be handled when a condition
 * is satisfied.
 */
export interface SubCondition extends ConditionContainer {
  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/learning/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/learning/hierarchies/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /** Nested sub-conditions */
  subConditions?: SubCondition[];

  /** Child node specifications which are used if condition is satisfied */
  specifications?: ChildNodeSpecification[];
}
