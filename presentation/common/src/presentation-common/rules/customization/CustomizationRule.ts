/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { NodeArtifactsRule } from "../hierarchy/NodeArtifactsRule";
import type { CheckBoxRule } from "./CheckBoxRule";
import type { ExtendedDataRule } from "./ExtendedDataRule";
import type { GroupingRule } from "./GroupingRule";
import type { ImageIdOverride } from "./ImageIdOverride";
import type { InstanceLabelOverride } from "./InstanceLabelOverride";
import type { LabelOverride } from "./LabelOverride";
import type { SortingRule } from "./SortingRule";
import type { StyleOverride } from "./StyleOverride";

/**
 * Customization rules allow customizing each node or content item separately.
 * Most of the rules have a `condition` property which uses [ECExpressions]($docs/presentation/Customization/ECExpressions.md)
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
 *
 * @public
 */
export declare type CustomizationRule =
  InstanceLabelOverride |
  CheckBoxRule |
  GroupingRule |
  ImageIdOverride |
  LabelOverride | // eslint-disable-line deprecation/deprecation
  SortingRule |
  StyleOverride |
  ExtendedDataRule |
  NodeArtifactsRule;
