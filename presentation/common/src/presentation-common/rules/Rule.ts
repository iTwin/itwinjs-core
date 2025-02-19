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
 * Base interface for all [[Rule]] implementations.
 * @public
 */
export interface RuleBase {
  /**
   * Used for serializing to JSON.
   * @see RuleTypes
   */
  ruleType: `${RuleTypes}`;

  /**
   * Defines the order in which rules are handled, higher number means the rule is handled first. If priorities are
   * equal, the rules are handled in the order they're defined.
   *
   * @type integer
   */
  priority?: number;

  /**
   * Tells the library that the rule should only be handled if no other rule of the same type was handled previously (based on rule
   * priorities and definition order). This allows adding fallback rules which can be overriden by higher-priority rules.
   */
  onlyIfNotHandled?: boolean;

  /**
   * A list of [ECSchema requirements]($docs/presentation/RequiredSchemaSpecification.md) that need to be met for the rule to be used.
   */
  requiredSchemas?: RequiredSchemaSpecification[];
}

/**
 * A union of all presentation rule types.
 * @public
 */
export declare type Rule = CustomizationRule | NavigationRule | ContentRule | ContentModifier | DefaultPropertyCategoryOverride;

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
