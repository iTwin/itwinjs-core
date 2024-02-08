/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/**
 * Generic instance filter that has all the necessary information to build filtering query.
 * @beta
 */
export interface GenericInstanceFilter {
  /** Single filter rule or multiple rules joined by logical operator. */
  rules: GenericInstanceFilterRule | GenericInstanceFilterRuleGroup;
  /**
   * Information about related instances that has access to the properties used in filter.
   * These can be used to create `JOIN` clause when building `ECSQL` query. Each related property
   * used in rule will have [[GenericInstanceFilterRule.sourceAlias]] that matches [[GenericInstanceFilterRelatedInstanceDescription.alias]].
   * If more than one property of the same related instance is used, they will share the same alias.
   */
  relatedInstances: GenericInstanceFilterRelatedInstanceDescription[];
  /**
   * List of class names whose properties are used in rules. Might be used to find common base class when building
   * filter for instances of different classes.
   */
  propertyClassNames: string[];
  /**
   * List of class names which will be used for additionally only querying instances of specific classes.
   */
  filteredClassNames?: string[];
}

/**
 * Type definition that describes operators supported by [[GenericInstanceFilterRule]].
 * @beta
 */
export type GenericInstanceFilterRuleOperator =
  | "is-equal"
  | "is-not-equal"
  | "is-null"
  | "is-not-null"
  | "is-true"
  | "is-false"
  | "less"
  | "less-or-equal"
  | "greater"
  | "greater-or-equal"
  | "like";

/**
 * Type definition that describes value of [[GenericInstanceFilterRule]].
 * @beta
 */
export interface GenericInstanceFilterRuleValue {
  displayValue: string;
  rawValue: GenericInstanceFilterRuleValue.Values;
}

/** @beta */
export namespace GenericInstanceFilterRuleValue {
  export interface Point2d {
    x: number;
    y: number;
  }
  export interface Point3d {
    x: number;
    y: number;
    z: number;
  }
  export interface InstanceKey {
    id: string;
    className: string;
  }
  /** Checks if supplied value is [[GenericInstanceFilterRuleValue.Point2d]] like. Returns `true` for `Point2d` and [[GenericInstanceFilterRuleValue.Point3d]]. */
  export function isPoint2d(value: GenericInstanceFilterRuleValue.Values): value is GenericInstanceFilterRuleValue.Point2d {
    return (value as GenericInstanceFilterRuleValue.Point2d).x !== undefined && (value as GenericInstanceFilterRuleValue.Point2d).y !== undefined;
  }
  /** Checks if supplied value is [[GenericInstanceFilterRuleValue.Point3d]] like. */
  export function isPoint3d(value: GenericInstanceFilterRuleValue.Values): value is GenericInstanceFilterRuleValue.Point3d {
    return isPoint2d(value) && (value as GenericInstanceFilterRuleValue.Point3d).z !== undefined;
  }
  /** Checks if supplied value is [[GenericInstanceFilterRuleValue.InstanceKey]] like. */
  export function isInstanceKey(value: GenericInstanceFilterRuleValue.Values): value is GenericInstanceFilterRuleValue.InstanceKey {
    return (value as GenericInstanceFilterRuleValue.InstanceKey) !== undefined && (value as GenericInstanceFilterRuleValue.InstanceKey).className !== undefined;
  }
  export type Values =
    | string
    | number
    | boolean
    | Date
    | GenericInstanceFilterRuleValue.Point2d
    | GenericInstanceFilterRuleValue.Point3d
    | GenericInstanceFilterRuleValue.InstanceKey;
}

/**
 * Defines single filter rule.
 * @beta
 */
export interface GenericInstanceFilterRule {
  /**
   * Alias of the source to access this property. For related properties `sourceAlias` should match
   * [[GenericInstanceFilterRelatedInstanceDescription.alias]] of one [[GenericInstanceFilter.relatedInstances]].
   */
  sourceAlias: string;
  /**
   * Property name for accessing property value.
   */
  propertyName: string;
  /**
   * Comparison operator that should be used to compare property value.
   */
  operator: GenericInstanceFilterRuleOperator;
  /**
   * Value to which property values is compared to. For unary operators value is `undefined`.
   */
  value?: GenericInstanceFilterRuleValue;
  /**
   * Type name of the property.
   */
  propertyTypeName: string;
}

/**
 * Type definition that describes operators supported by [[GenericInstanceFilterRuleGroup]].
 * @beta
 */
export type GenericInstanceFilterRuleGroupOperator = "and" | "or";

/**
 * Group of filter rules joined by logical operator.
 * @beta
 */
export interface GenericInstanceFilterRuleGroup {
  /**
   * Operator that should be used to join rules.
   */
  operator: GenericInstanceFilterRuleGroupOperator;
  /**
   * List of rules or rule groups that should be joined by `operator`.
   */
  rules: Array<GenericInstanceFilterRule | GenericInstanceFilterRuleGroup>;
}

/**
 * Describes related instance whose property was used in the filter.
 * @beta
 */
export interface GenericInstanceFilterRelatedInstanceDescription {
  /**
   * Describes path that should be used to reach related instance from the source.
   */
  path: GenericInstanceFilterRelationshipStep[];
  /**
   * Related instance alias. This alias match [[GenericInstanceFilterRule.sourceAlias]] in all filter rules where
   * properties of this related instance is used.
   */
  alias: string;
}

/**
 * Describes single step between source class and target class.
 * @beta
 */
export interface GenericInstanceFilterRelationshipStep {
  /** Full class name of the source class, e.g. `BisCore:Element`. */
  sourceClassName: string;
  /** Full class name of the target class, e.g. `BisCore:Element`. */
  targetClassName: string;
  /** Full class name of the relationship class that should be used to move from source to target, e.g. `BisCore:ElementOwnsChildElements`. */
  relationshipClassName: string;
  /**
   * A flag that describes if this step follows relationship class in forward or backward direction.
   * If the step follows relationship in forward direction then `sourceClassName` matches relationship's source class and `targetClassName` matches relationship's target class.
   * Otherwise, `sourceClassName` matches relationship's target class and `targetClassName` matches relationship's source class.
   */
  isForwardRelationship: boolean;
}

/** @beta */
export namespace GenericInstanceFilter {
  /**
   * Function that checks if supplied object is [[GenericInstanceFilterRuleGroup]].
   * @beta
   */
  export function isFilterRuleGroup(obj: GenericInstanceFilterRule | GenericInstanceFilterRuleGroup): obj is GenericInstanceFilterRuleGroup {
    return (obj as GenericInstanceFilterRuleGroup).rules !== undefined;
  }
}
