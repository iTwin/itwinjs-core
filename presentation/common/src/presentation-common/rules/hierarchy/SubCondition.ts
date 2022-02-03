/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { ConditionContainer } from "../Rule";
import type { RequiredSchemaSpecification } from "../SchemasSpecification";
import type { ChildNodeSpecification } from "./ChildNodeSpecification";

/**
 * Defines child node specifications which should only be handled when a condition
 * is satisfied.
 *
 * @public
 */
export interface SubCondition extends ConditionContainer {
  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Hierarchies/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * Schema requirements for this rule. The rule is not used if the requirements are not met.
   * @beta
   */
  requiredSchemas?: RequiredSchemaSpecification[];

  /** Nested sub-conditions */
  subConditions?: SubCondition[];

  /** Child node specifications which are used if condition is satisfied */
  specifications?: ChildNodeSpecification[];
}
