/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { SingleSchemaClassSpecification } from "../ClassSpecifications";
import { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

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
 *
 * @see [More details]($docs/presentation/Hierarchies/GroupingRule.md)
 * @public
 */
export interface GroupingRule extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.Grouping;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Hierarchies/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /** Specification of ECClass which should be grouped using this rule */
  class: SingleSchemaClassSpecification;

  /** Specifications of grouping which should be applied to matching ECInstances */
  groups: GroupingSpecification[];
}

/**
 * Grouping rule specifications
 * @public
 */
export declare type GroupingSpecification = ClassGroup | PropertyGroup | SameLabelInstanceGroup;

/**
 * Available types of [[GroupingSpecification]]
 * @public
 */
export enum GroupingSpecificationTypes {
  Class = "Class",
  Property = "Property",
  SameLabelInstance = "SameLabelInstance",
}

/**
 * Base interface for all [[GroupingSpecification]] implementations. Not
 * meant to be used directly, see `GroupingSpecification`.
 *
 * @public
 */
export interface GroupingSpecificationBase {
  /** Type of the subclass */
  specType: GroupingSpecificationTypes;
}

/**
 * Allows grouping ECInstance nodes by their base class.
 * @public
 */
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
 *
 * @public
 */
export interface SameLabelInstanceGroup extends GroupingSpecificationBase {
  /** Used for serializing to JSON. */
  specType: GroupingSpecificationTypes.SameLabelInstance;
  /**
   * Stage of hierarchy creation at which the rule is applied.
   * Defaults to [[SameLabelInstanceGroupApplicationStage.Query]].
   */
  applicationStage?: SameLabelInstanceGroupApplicationStage;
}

/**
 * Specifies hierarchy creation stages used to apply [[SameLabelInstanceGroup]] grouping.
 * @public
 */
export enum SameLabelInstanceGroupApplicationStage {
  /** Apply grouping at query stage. */
  Query = "Query",

  /**
   * Apply grouping at post-processing stage.
   *
   * This allows grouping nodes created by different hierarchy specifications at
   * a higher performance cost as it requires loading the whole hierarchy level before
   * returning even the first node - avoid using with large numbers of nodes.
   */
  PostProcess = "PostProcess",
}

/**
 * Allows grouping by property of the instance
 * by a common value or by range of values.
 *
 * @public
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

  /**
   * Should a separate grouping node be created for nodes whose grouping value is not
   * set or is an empty string.
   *
   * Defaults to `true`.
   */
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
 *
 * @public
 */
export enum PropertyGroupingValue {
  /** By property value */
  PropertyValue = "PropertyValue",

  /** By display label */
  DisplayLabel = "DisplayLabel",
}

/**
 * Describes a grouping range
 * @public
 */
export interface PropertyRangeGroupSpecification {
  /**
   * ID of an image to use for the grouping node. Defaults to [[PropertyGroup.imageId]] specified in [[PropertyGroup]].
   *
   * @minLength 1
   */
  imageId?: string;

  /**
   * Grouping node label. May be [localized]($docs/presentation/Advanced/Localization.md).
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
