/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ConditionalPresentationRule } from "./ConditionalPresentationRule";
import { CustomizationRule } from "./customization/CustomizationRule";

/** Base interface for presentation rules [[PresentationRule]] */
export interface PresentationRuleBase {
  /** Defines the order in which presentation rules will be evaluated and executed. By default is set to 1000. */
  priority?: number;

  /**
   * Indicates whether this rule should be ignored if there is already existing rule with a higher priority.
   * By default is set to false.
   */
  onlyIfNotHandled?: boolean;
}

/**
 * Presentation rules allow to configure how the hierarchy and content are displayed.
 *
 * They use existing ECExpressions engine for condition evaluation and can be persisted into XML file.
 * They are not platform dependent.
 */
export declare type PresentationRule = CustomizationRule | ConditionalPresentationRule;

/** Used for serializing array of [[PresentationRule]] to JSON. */
export enum PresentationRuleTypes {
  CheckBoxRule = "CheckBox",
  ChildNodeRule = "ChildNode",
  ContentRule = "Content",
  GroupingRule = "Grouping",
  ImageIdOverride = "ImageId",
  InstanceLabelOverride = "InstanceLabel",
  LabelOverride = "Label",
  RootNodeRule = "RootNode",
  SortingRule = "Sorting",
  StyleOverride = "Style",
}
