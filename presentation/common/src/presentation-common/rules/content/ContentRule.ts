/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RuleBase } from "../Rule";
import { ContentSpecification } from "./ContentSpecification";

/**
 * Content rules are used to define content that is displayed for specific type of [input]($docs/presentation/content/Terminology.md#input-instance).
 * Input consists of either ECInstances or [nodes]($docs/presentation/hierarchies/Terminology.md#node) and to make things
 * simpler everything is considered a [node]($docs/presentation/hierarchies/Terminology.md#node) - instances get converted to
 * *ECInstance nodes* (thus the `SelectedNode` symbol in [`condition` ECExpression]($docs/presentation/content/ECExpressions.md#rule-condition)).
 *
 * @see [Content rule reference documentation page]($docs/presentation/content/ContentRule.md)
 * @public
 */
export interface ContentRule extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "Content";

  /**
   * Defines a condition which needs to be met in order for the rule to be used. The condition is an
   * [ECExpression]($docs/presentation/content/ECExpressions.md#rule-condition) which has to evaluate to
   * a boolean value.
   */
  condition?: string;

  /**
   * A list of content specifications that define what content is going to be returned. This is the most
   * important attribute which is responsible for defining what instances' properties are included in the
   * returned content.
   */
  specifications: ContentSpecification[];
}
