/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ConditionalCustomizationRuleBase } from "./CustomizationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/**
 * Grouping rule is an advanced way to configure node grouping.
 *
 * It allows to define these types of groupings:
 * - Group by base class.
 * - Group by any property of the instance by common value as well as grouping by range of values.
 * - Group multiple instances with the same label in to one ECInstance node. This can be used in cases when these
 * instances represent the same object for the user.
 *
 * GroupingRule works in conjunction with other grouping options available in navigation specifications [[ChildNodeSpecification]]:
 * GroupByClass and GroupByLabel. The grouping hierarchy looks like this:
 * - Base ECClass grouping node (specified by base class grouping specification [[ClassGroup]])
 *   - ECClass grouping node (specified by GroupByClass property)
 *     - ECProperty grouping node 1 (specified by 1nd property grouping specification [[PropertyGroup]])
 *       - ECProperty grouping node 2 (specified by 2nd property grouping specification [[PropertyGroup]])
 *         - ECProperty grouping node n (specified by n-th property grouping specification [[PropertyGroup]])
 *           - Display label grouping node (specified by groupByLabel property)
 *             - ECInstance nodes (may be grouped under a single node by same label
 *               instance group specification [[SameLabelInstanceGroupSpecification]])
 */
export interface GroupingRule extends ConditionalCustomizationRuleBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.GroupingRule;

  /** Schema name of the class which should be grouped using this grouping rule. */
  schemaName: string;

  /** Class name which should be grouped using this grouping rule. */
  className: string;

  groups?: GroupSpecification[];
}

/** Grouping rule specifications */
export declare type GroupSpecification = ClassGroup | PropertyGroup | SameLabelInstanceGroup;

/** Used for serializing array of [[GroupSpecification]] to JSON */
export enum GroupSpecificationTypes {
  ClassGroup = "Class",
  PropertyGroup = "Property",
  SameLabelInstanceGroup = "SameLabelInstance",
}

/** Base interface for group specifications [[GroupSpecification]] */
export interface GroupSpecificationBase {
  /** Type of the subclass */
  type: GroupSpecificationTypes;
}

/** This specification allows grouping ECInstance nodes by their base class. */
export interface ClassGroup extends GroupSpecificationBase {
  /** Used for serializing to JSON. */
  type: GroupSpecificationTypes.ClassGroup;

  /** Should the grouping node be created if there is only one item in that group. By default is set to false. */
  createGroupForSingleItem?: boolean;

  /** Schema name of the base ECClass. By default is set to rule's schema name. */
  schemaName?: string;

  /** Base ECClass name. By default is set to rule's class name. */
  baseClassName?: string;
}

/**
 * This specification allows grouping multiple instances with the same label into one ECInstance node.
 * It can be used in cases when these instances represent the same object for the user.
 */
export interface SameLabelInstanceGroup extends GroupSpecificationBase {
  /** Used for serializing to JSON. */
  type: GroupSpecificationTypes.SameLabelInstanceGroup;
}

/**
 * This specification allows grouping by any property of the instance
 * by common value as well as grouping by range of values.
 */
export interface PropertyGroup extends GroupSpecificationBase {
  /** Used for serializing to JSON. */
  type: GroupSpecificationTypes.PropertyGroup;

  /** ImageId to use for the grouping node. By default is set to ECProperty configured ImageId */
  imageId?: string;

  /* Should the grouping node be created if there is only one item in that group. By default is set to false */
  createGroupForSingleItem?: boolean;

  /** Should a separate grouping node be created for nodes whose grouping value is not set. By default is set to true */
  createGroupForUnspecifiedValues?: boolean;

  /** Should the instances be grouped on display label (default) or the grouping property value.
   * Grouping by property value is necessary if the display label is overridden to display grouped instances count.
   * By default is set to `DisplayLabel`.
   */
  groupingValue?: PropertyGroupingValue;

  /** Should the nodes be sorted by display label (default) or the grouping property value. In most cases the result is
   * the same, unless [[LabelOverride]] rule is used to change the display label.
   * By default is set to `DisplayLabel`.
   *
   * **Note:**
   * Sorting by property value only makes sense when instances are grouped by property value as well.
   * So grouping by label and sorting by property value is not possible.
   */
  sortingValue?: PropertyGroupingValue;

  /** Name of the ECProperty which is used for grouping. */
  propertyName: string;

  /** Ranges into which the grouping values are divided */
  ranges?: PropertyRangeGroupSpecification[];
}

/** Used in [[PropertyGroup]] to specify groupingValue and sortingValue. */
export enum PropertyGroupingValue {
  /** By property value. */
  PropertyValue = "PropertyValue",

  /** By display label. */
  DisplayLabel = "DisplayLabel",
}

/** Creates value range grouping. */
export interface PropertyRangeGroupSpecification {
  /** ImageId to use for the grouping node. By default is set to imageId specified in the PropertyGroup specification. */
  imageId?: string;

  /**
   * Grouping node label. May be [localized]($docs/learning/Localization.md).
   * By default is set to "[[fromValue]] - [[toValue]]"
   */
  label?: string;

  /** Value that defines the range start (inclusive) */
  fromValue: string;

  /** Value that defines the range end (inclusive) */
  toValue: string;
}
