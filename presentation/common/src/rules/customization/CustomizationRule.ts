/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { CheckBoxRule } from "./CheckBoxRule";
import { GroupingRule } from "./GroupingRule";
import { ImageIdOverride } from "./ImageIdOverride";
import { InstanceLabelOverride } from "./InstanceLabelOverride";
import { LabelOverride } from "./LabelOverride";
import { SortingRule } from "./SortingRule";
import { StyleOverride } from "./StyleOverride";

/**
 * Customization rules allow customizing each node or content item separately.
 * Most of the rules have a `condition` property which uses [ECExpressions]($docs/learning/customization/ECExpressions.md)
 * for conditional rule filtering.
 *
 * **Nested customization rules:**
 *
 * Customization rules may be specified at ruleset level, in which case they're
 * applied to all content produced by the ruleset, or nested under navigation rules,
 * in which case they're applied only for nodes created by those rules.
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
