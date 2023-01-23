/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyFilterBuilder
 */

import { PropertyDescription, StandardTypeNames } from "@itwin/appui-abstract";
import { UiComponents } from "../UiComponents";

/**
 * Logical operator for joining rules.
 * @beta
 */
export enum PropertyFilterRuleGroupOperator {
  And,
  Or,
}

/**
 * Operators for comparing property value in rule.
 * @beta
 */
export enum PropertyFilterRuleOperator {
  IsTrue,
  IsFalse,

  IsEqual,
  IsNotEqual,

  Greater,
  GreaterOrEqual,
  Less,
  LessOrEqual,

  Like,

  IsNull,
  IsNotNull,
}

/**
 * Function that returns set of available operator based on property type.
 * @beta
 */
export function getPropertyFilterOperators(property: PropertyDescription) {
  const typename = property.typename;

  if (typename === StandardTypeNames.Bool || typename === StandardTypeNames.Boolean) {
    return [
      PropertyFilterRuleOperator.IsTrue,
      PropertyFilterRuleOperator.IsFalse,
    ];
  }

  const operators = [
    PropertyFilterRuleOperator.IsEqual,
    PropertyFilterRuleOperator.IsNotEqual,
    PropertyFilterRuleOperator.IsNull,
    PropertyFilterRuleOperator.IsNotNull,
  ];

  if (typename === StandardTypeNames.Number
    || typename === StandardTypeNames.Int
    || typename === StandardTypeNames.Integer
    || typename === StandardTypeNames.Double
    || typename === StandardTypeNames.Float
    || typename === StandardTypeNames.Hex
    || typename === StandardTypeNames.Hexadecimal
    || typename === StandardTypeNames.ShortDate
    || typename === StandardTypeNames.DateTime) {
    return [
      ...operators,
      PropertyFilterRuleOperator.Greater,
      PropertyFilterRuleOperator.GreaterOrEqual,
      PropertyFilterRuleOperator.Less,
      PropertyFilterRuleOperator.LessOrEqual,
    ];
  }

  if (typename === StandardTypeNames.String || typename === StandardTypeNames.Text) {
    return [
      ...operators,
      PropertyFilterRuleOperator.Like,
    ];
  }

  return operators;
}

/* istanbul ignore next */
/**
 * Function that returns display label for rule operator.
 * @beta
 */
export function getPropertyFilterOperatorLabel(operator: PropertyFilterRuleOperator) {
  switch (operator) {
    case PropertyFilterRuleOperator.IsTrue:
      return UiComponents.translate("filterBuilder.operators.isTrue");
    case PropertyFilterRuleOperator.IsFalse:
      return UiComponents.translate("filterBuilder.operators.isFalse");
    case PropertyFilterRuleOperator.IsEqual:
      return UiComponents.translate("filterBuilder.operators.equal");
    case PropertyFilterRuleOperator.IsNotEqual:
      return UiComponents.translate("filterBuilder.operators.notEqual");
    case PropertyFilterRuleOperator.Greater:
      return ">";
    case PropertyFilterRuleOperator.GreaterOrEqual:
      return ">=";
    case PropertyFilterRuleOperator.Less:
      return "<";
    case PropertyFilterRuleOperator.LessOrEqual:
      return "<=";
    case PropertyFilterRuleOperator.Like:
      return UiComponents.translate("filterBuilder.operators.contains");
    case PropertyFilterRuleOperator.IsNull:
      return UiComponents.translate("filterBuilder.operators.isNull");
    case PropertyFilterRuleOperator.IsNotNull:
      return UiComponents.translate("filterBuilder.operators.isNotNull");
  }
}

/**
 * Function that checks if supplied operator is unary.
 * @beta
 */
export function isUnaryPropertyFilterOperator(operator: PropertyFilterRuleOperator) {
  switch (operator) {
    case PropertyFilterRuleOperator.IsTrue:
    case PropertyFilterRuleOperator.IsFalse:
    case PropertyFilterRuleOperator.IsNull:
    case PropertyFilterRuleOperator.IsNotNull:
      return true;
  }
  return false;
}
