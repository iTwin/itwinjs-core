/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleTypes, RuleBase, ConditionContainer } from "../Rule";
import { SingleSchemaClassSpecification } from "../ClassSpecifications";

/**
 * Grouping rule is an advanced way to configure node grouping.
 *
 * It allows to define these types of groupings:
 * - Group by base class.
 * - Group by any property of the instance by a common value or a range of values.
 * - Group multiple instances with the same label in to one ECInstance node. This can be used in cases when these
 * instances represent the same object for the user.
 *
 * The rule works in conjunction with other grouping options available in navigation specifications [[ChildNodeSpecification]]:
 * `groupByClass` and `groupByLabel`. The grouping hierarchy looks like this:
 * - Base ECClass grouping node (specified by base class grouping specification [[ClassGroup]])
 *   - ECClass grouping node (specified by `groupByClass` property)
 *     - ECProperty grouping node 1 (specified by 1st [[PropertyGroup]])
 *       - ECProperty grouping node 2 (specified by 2nd [[PropertyGroup]])
 *         - ECProperty grouping node n (specified by n-th [[PropertyGroup]])
 *           - Display label grouping node (specified by `groupByLabel` property)
 *             - ECInstance nodes (may be grouped under a single node by [[SameLabelInstanceGroup]])
 */
export interface GroupingRule extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.Grouping;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/learning/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/learning/customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /** Specification of ECClass which should be grouped using this rule */
  class: SingleSchemaClassSpecification;

  /** Specifications of grouping which should be applied to maching ECInstances */
  groups: GroupingSpecification[];
}

/** Grouping rule specifications */
export declare type GroupingSpecification = ClassGroup | PropertyGroup | SameLabelInstanceGroup;

/** Available types of [[GroupingSpecification]] */
export const enum GroupingSpecificationTypes {
  Class = "Class",
  Property = "Property",
  SameLabelInstance = "SameLabelInstance",
}

/** Base interface for all [[GroupingSpecification]] implementations */
export interface GroupingSpecificationBase {
  /** Type of the subclass */
  specType: GroupingSpecificationTypes;
}

/** Allows grouping ECInstance nodes by their base class. */
export interface ClassGroup extends GroupingSpecificationBase {
  /** Used for serializing to JSON. */
  specType: GroupingSpecificationTypes.Class;

  /** Should the grouping node be created if there is only one item in that group. */
  createGroupForSingleItem?: boolean;

  /** Specification of the base ECClass to group by. Defaults to rule's class. */
  baseClass?: SingleSchemaClassSpecification;
}

/**
 * Allows grouping multiple instances with the same label into one ECInstance node.
 * It can be used in cases when these instances represent the same object for the user.
 *
 * When multiple instances are grouped, an ECInstance node is created instead of a
 * grouping node and the ECInstance key for the node is assigned to key of one of grouped
 * instances.
 */
export interface SameLabelInstanceGroup extends GroupingSpecificationBase {
  /** Used for serializing to JSON. */
  specType: GroupingSpecificationTypes.SameLabelInstance;
}

/**
 * Allows grouping by property of the instance
 * by a common value or by range of values.
 */
export interface PropertyGroup extends GroupingSpecificationBase {
  /** Used for serializing to JSON. */
  specType: GroupingSpecificationTypes.Property;

  /**
   * Name of the ECProperty which is used for grouping.
   *
   * @minLength 1
   */
  propertyName: string;

  /**
   * ID of an image to use for the grouping node
   *
   * @minLength 1
   */
  imageId?: string;

  /** Should the grouping node be created if there is only one item in that group */
  createGroupForSingleItem?: boolean;

  /** Should a separate grouping node be created for nodes whose grouping value is not set. Defaults to `true`. */
  createGroupForUnspecifiedValues?: boolean;

  /**
   * Should the instances be grouped on display label or the grouping property value.
   * Defaults to [[PropertyGroupingValue.DisplayLabel]].
   *
   * **Note:** Grouping by property value is required if the display label is
   * overridden to display grouped instances count.
   *
   * **Warning:** Grouping by label and sorting by property value is not possible.
   */
  groupingValue?: PropertyGroupingValue;

  /**
   * Should the nodes be sorted by display label or the grouping property value. In most
   * cases the result is the same, unless [[LabelOverride]] rule is used to change the display label.
   * Defaults to [[PropertyGroupingValue.DisplayLabel]].
   *
   * **Note:** Sorting by property value only makes sense when instances are grouped by
   * property value as well.
   *
   * **Warning:** Grouping by label and sorting by property value is not possible.
   */
  sortingValue?: PropertyGroupingValue;

  /** Ranges into which the grouping values are divided */
  ranges?: PropertyRangeGroupSpecification[];
}

/**
 * Used in [[PropertyGroup]] to specify the type of value to use
 * for grouping and sorting
 */
export const enum PropertyGroupingValue {
  /** By property value */
  PropertyValue = "PropertyValue",

  /** By display label */
  DisplayLabel = "DisplayLabel",
}

/** Describes a grouping range */
export interface PropertyRangeGroupSpecification {
  /**
   * ID of an image to use for the grouping node. Defaults to [[PropertyGroup.imageId]] specified in [[PropertyGroup]].
   *
   * @minLength 1
   */
  imageId?: string;

  /**
   * Grouping node label. May be [localized]($docs/learning/Localization.md).
   * Defaults to `{from value} - {to value}`
   *
   * @minLength 1
   */
  label?: string;

  /**
   * Value that defines the range start (inclusive)
   *
   * @minLength 1
   */
  fromValue: string;

  /**
   * Value that defines the range end (inclusive)
   *
   * @minLength 1
   */
  toValue: string;
}
