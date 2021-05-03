/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ContentRule } from "./content/ContentRule";
import { DefaultPropertyCategoryOverride } from "./content/DefaultPropertyCategoryOverride";
import { ContentModifier } from "./content/modifiers/ContentModifier";
import { CustomizationRule } from "./customization/CustomizationRule";
import { NavigationRule } from "./hierarchy/NavigationRule";
import { RequiredSchemaSpecification } from "./SchemasSpecification";

/**
 * Base interface for all [[Rule]] implementations. Not meant
 * to be used directly, see `Rule`.
 *
 * @public
 */
export interface RuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes;

  /**
   * Defines the order in which presentation rules will be evaluated and executed. Defaults to `1000`.
   *
   * @type integer
   */
  priority?: number;

  /**
   * Should this rule should be ignored if there is already an existing
   * rule with a higher priority.
   */
  onlyIfNotHandled?: boolean;

  /**
   * Schema requirements for this rule. The rule is not used if the requirements are not met.
   * @beta
   */
  requiredSchemas?: RequiredSchemaSpecification[];
}

/**
 * Presentation rules allow configuring the hierarchy and content.
 * @public
 */
export declare type Rule = CustomizationRule | NavigationRule | ContentRule | ContentModifier | DefaultPropertyCategoryOverride;

/**
 * Container of a [[condition]] property. Used for rules that support conditions. Not
 * meant to be used directly, see `Rule`.
 *
 * @public
 */
export interface ConditionContainer {
  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/learning/presentation/ECExpressions.md), which can use
   * a limited set of symbols (depends on specific `ConditionContainer`).
   */
  condition?: string;
}

/**
 * Used for serializing [[Rule]] objects to JSON.
 * @public
 */
export enum RuleTypes {
  // hierarchy rules
  RootNodes = "RootNodes",
  ChildNodes = "ChildNodes",

  // content rules
  Content = "Content",
  ContentModifier = "ContentModifier", // eslint-disable-line @typescript-eslint/no-shadow
  DefaultPropertyCategoryOverride = "DefaultPropertyCategoryOverride", // eslint-disable-line @typescript-eslint/no-shadow

  // customization rules
  Grouping = "Grouping",
  PropertySorting = "PropertySorting",
  DisabledSorting = "DisabledSorting",
  NodeArtifacts = "NodeArtifacts",
  InstanceLabelOverride = "InstanceLabelOverride",
  LabelOverride = "LabelOverride",
  CheckBox = "CheckBox",
  ImageIdOverride = "ImageIdOverride",
  StyleOverride = "StyleOverride",
  ExtendedData = "ExtendedData",
}
