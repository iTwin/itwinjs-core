/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RequiredSchemaSpecification } from "../SchemasSpecification";
import { ChildNodeSpecification } from "./ChildNodeSpecification";

/**
 * This is a sub-rule which shares *placement attributes* and
 * [nested customization rules]($docs/presentation/hierarchies/ChildNodeRule.md#attribute-customizationrules)
 * of the hierarchy rule. This means the attributes of hierarchy rule are still in effect and the sub-rules
 * can add additional condition of their own.
 *
 * @see [Sub-conditions reference documentation section]($docs/presentation/hierarchies/ChildNodeRule.md#attribute-subconditions)
 * @public
 */
export interface SubCondition {
  /**
   * Defines a condition which needs to be met in order for the rule to be used. The condition is an
   * [ECExpression]($docs/presentation/hierarchies/ECExpressions.md#rule-condition) which has to evaluate
   * to a boolean value.
   */
  condition?: string;

  /**
   * Specifications that define [ECSchema requirements]($docs/presentation/RequiredSchemaSpecification.md) for
   * the rule to take effect.
   */
  requiredSchemas?: RequiredSchemaSpecification[];

  /**
   * A list of nested sub-rules which share *placement attributes* of this sub-condition. This means the
   * attributes of this sub-condition are still in effect and the sub-rules can add additional condition
   * of their own.
   */
  subConditions?: SubCondition[];

  /** A list of hierarchy specifications that define what nodes are going to be returned. */
  specifications?: ChildNodeSpecification[];
}
