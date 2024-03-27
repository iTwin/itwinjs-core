/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { SingleSchemaClassSpecification } from "../ClassSpecifications";
import { RuleBase } from "../Rule";

/**
 * Grouping rules provide advanced ways to group instances when creating hierarchies.
 *
 * @see [Grouping rule reference documentation page]($docs/presentation/hierarchies/GroupingRule.md)
 * @public
 */
export interface GroupingRule extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "Grouping";

  /**
   * An [ECExpression]($docs/presentation/hierarchies/ECExpressions.md#rule-condition) that results in
   * a boolean value. If specified,  the grouping rule applies only to instance nodes that cause the condition
   * to evaluate to `true`.
   */
  condition?: string;

  /** Specification of ECClass which should be grouped using this rule. */
  class: SingleSchemaClassSpecification;

  /**
   * Specifies a list of [grouping specifications]($docs/presentation/hierarchies/GroupingRule.md#grouping-specifications)
   * which describe the kind of grouping that should be applied.
   */
  groups: GroupingSpecification[];
}

/**
 * Grouping rule specifications.
 * @public
 */
export declare type GroupingSpecification = ClassGroup | PropertyGroup | SameLabelInstanceGroup;

/**
 * Available types of [[GroupingSpecification]].
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
  /**
   * Type of the subclass
   * @see GroupingSpecificationTypes
   */
  specType: `${GroupingSpecificationTypes}`;
}

/**
 * Base class grouping allows grouping ECInstance nodes by their base class (as opposed to the hierarchy
 * specifications' `groupByClass` attribute, which always groups by direct class).
 *
 * @see [Base class grouping documentation section]($docs/presentation/hierarchies/GroupingRule.md#base-class-grouping)
 * @public
 */
export interface ClassGroup extends GroupingSpecificationBase {
  /** Used for serializing to JSON. */
  specType: "Class";

  /** Specifies whether a grouping node should be created if there is only one item in that group. */
  createGroupForSingleItem?: boolean;

  /**
   * Specification of the base ECClass to group by. If specified, allows grouping by a subclass of the class
   * specified by rule's `class` attribute.
   */
  baseClass?: SingleSchemaClassSpecification;
}

/**
 * Allows grouping multiple instances with the same label into one ECInstances type of node. Similar to display label grouping,
 * but instead of showing a grouping node with multiple grouped ECInstance nodes, it shows a single ECInstances node which represents
 * multiple ECInstances.
 *
 * @see [Same label instance grouping documentation section]($docs/presentation/hierarchies/GroupingRule.md#same-label-instance-grouping)
 * @public
 */
export interface SameLabelInstanceGroup extends GroupingSpecificationBase {
  /** Used for serializing to JSON. */
  specType: "SameLabelInstance";

  /**
   * Grouping nodes by label is an expensive operation because it requires the whole hierarchy level to be created before even the first
   * grouped node can be produced. To alleviate the performance impact when this specification is used, two `applicationStage` settings have been introduced:
   *
   * - `"Query"` groups instances during ECSql query, which can often make use of database indices and is generally fairly quick. It is chosen
   *   as the default option, however, it fails to produce grouping nodes when certain ruleset specifications are involved.
   *
   * - `"PostProcess"` groups instances after the whole hierarchy level is built. It incurs a large performance penalty, but it will
   *   produce the expected result in all cases.
   *
   * @see SameLabelInstanceGroupApplicationStage
   */
  applicationStage?: `${SameLabelInstanceGroupApplicationStage}`;
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
 * Property grouping allows grouping by a property of the instance by value or by given ranges of values.
 *
 * @see [Property grouping documentation section]($docs/presentation/hierarchies/GroupingRule.md#property-grouping)
 * @public
 */
export interface PropertyGroup extends GroupingSpecificationBase {
  /** Used for serializing to JSON. */
  specType: "Property";

  /**
   * Name of the ECProperty which is used for grouping. The property must exist on the ECClass specified by the
   * rule's `class` attribute and it must be of either a primitive or a navigation type.
   *
   * @minLength 1
   */
  propertyName: string;

  /**
   * Specifies grouping node's image ID. If set, the ID is assigned to [[Node.imageId]] and
   * it's up to the UI component to decide what to do with it.
   *
   * @minLength 1
   */
  imageId?: string;

  /** Specifies whether a grouping node should be created if there is only one item in that group. */
  createGroupForSingleItem?: boolean;

  /**
   * Should a separate grouping node be created for nodes whose grouping value is not set or is set to an empty string.
   */
  createGroupForUnspecifiedValues?: boolean;

  /**
   * Specifies whether instances should be grouped using property's display or raw value.
   *
   * @see PropertyGroupingValue
   * @deprecated in 3.x. Display value should always be used for grouping.
   */
  groupingValue?: `${PropertyGroupingValue}`; // eslint-disable-line deprecation/deprecation

  /**
   * Specifies whether nodes should be sorted by their display label or the grouping property's value. In most cases the result
   * is the same, unless a [label override rule]($docs/presentation/customization/LabelOverride.md) is used to change node's display label.
   *
   * @see PropertyGroupingValue
   * @deprecated in 3.x. Property grouping nodes should always be sorted by display label.
   */
  sortingValue?: `${PropertyGroupingValue}`; // eslint-disable-line deprecation/deprecation

  /** Ranges into which the grouping values are divided. Instances are grouped by value if no ranges are specified. */
  ranges?: PropertyRangeGroupSpecification[];
}

/**
 * Used in [[PropertyGroup]] to specify the type of value to use
 * for grouping and sorting
 *
 * @public
 * @deprecated in 3.x. The attributes using this enum are deprecated.
 */
export enum PropertyGroupingValue {
  /** By property value */
  PropertyValue = "PropertyValue",

  /** By display label */
  DisplayLabel = "DisplayLabel",
}

/**
 * Describes a grouping range.
 *
 * @see [Property range group specification documentation section]($docs/presentation/hierarchies/GroupingRule.md#attribute-ranges)
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
   * Grouping node label. May be [localized]($docs/presentation/advanced/Localization.md).
   * Defaults to `{from value} - {to value}`.
   *
   * @minLength 1
   */
  label?: string;

  /**
   * Value that defines the range start (inclusive).
   *
   * @minLength 1
   */
  fromValue: string;

  /**
   * Value that defines the range end (inclusive).
   *
   * @minLength 1
   */
  toValue: string;
}
