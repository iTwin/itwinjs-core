/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { PresentationRuleBase } from "../PresentationRule";
import { CheckBoxRule } from "./CheckBoxRule";
import { GroupingRule } from "./GroupingRule";
import { ImageIdOverride } from "./ImageIdOverride";
import { InstanceLabelOverride } from "./InstanceLabelOverride";
import { LabelOverride } from "./LabelOverride";
import { SortingRule } from "./SortingRule";
import { StyleOverride } from "./StyleOverride";

/** Base interface for customization rules [[CustomizationRule]] */
// tslint:disable-next-line:no-empty-interface
export interface CustomizationRuleBase extends PresentationRuleBase {
}

/** Base interface for conditional customization rules. */
export interface ConditionalCustomizationRuleBase extends CustomizationRuleBase {
  /** Condition which must be met in order to execute the rule. */
  condition?: string;
}

/**
 * Customization rules allow customizing each node or content item separately.
 * Most of the rules have a `condition` property which uses [ECExpressions]($docs/learning/customization/ECExpressions.md)
 * for conditional rule filtering.
 *
 * **Nested customization rules:**
 *
 * All customization rules can also be nested in navigation rules.
 * This means that they're applied only for nodes created by those rules.
 *
 * **Customization rule priorities:**
 *
 * Customization rules have a `priority` attribute which defines the order in which they're applied. If priorities match,
 * rules engine looks at the nesting level - the deeper the rule is nested, the higher is its `priority`.
 * If the nesting levels also match, the rule defined first wins.
 */
export declare type CustomizationRule = InstanceLabelOverride |
  CheckBoxRule |
  GroupingRule |
  ImageIdOverride |
  LabelOverride |
  SortingRule |
  StyleOverride;
