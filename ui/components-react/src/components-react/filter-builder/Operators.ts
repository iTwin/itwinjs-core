/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyDescription, StandardTypeNames } from "@itwin/appui-abstract";
import { UiComponents } from "../UiComponents";

/** @alpha */
export enum FilterRuleGroupOperator {
  And,
  Or,
}

/** @alpha */
export enum FilterRuleOperator {
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

/** @alpha */
export function getAvailableOperators(property: PropertyDescription) {
  const typename = property.typename;

  if (typename === StandardTypeNames.Bool || typename === StandardTypeNames.Boolean) {
    return [
      FilterRuleOperator.IsTrue,
      FilterRuleOperator.IsFalse,
    ];
  }

  const operators = [
    FilterRuleOperator.IsEqual,
    FilterRuleOperator.IsNotEqual,
    FilterRuleOperator.IsNull,
    FilterRuleOperator.IsNotNull,
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
      FilterRuleOperator.Greater,
      FilterRuleOperator.GreaterOrEqual,
      FilterRuleOperator.Less,
      FilterRuleOperator.LessOrEqual,
    ];
  }

  if (typename === StandardTypeNames.String || typename === StandardTypeNames.Text) {
    return [
      ...operators,
      FilterRuleOperator.Like,
    ];
  }

  return operators;
}

/* istanbul ignore next */
/** @alpha */
export function getFilterRuleOperatorLabel(operator: FilterRuleOperator) {
  switch(operator) {
    case FilterRuleOperator.IsTrue:
      return UiComponents.translate("filterBuilder.operators.isTrue");
    case FilterRuleOperator.IsFalse:
      return UiComponents.translate("filterBuilder.operators.isFalse");
    case FilterRuleOperator.IsEqual:
      return UiComponents.translate("filterBuilder.operators.equal");
    case FilterRuleOperator.IsNotEqual:
      return UiComponents.translate("filterBuilder.operators.notEqual");
    case FilterRuleOperator.Greater:
      return ">";
    case FilterRuleOperator.GreaterOrEqual:
      return ">=";
    case FilterRuleOperator.Less:
      return "<";
    case FilterRuleOperator.LessOrEqual:
      return "<=";
    case FilterRuleOperator.Like:
      return UiComponents.translate("filterBuilder.operators.contains");
    case FilterRuleOperator.IsNull:
      return UiComponents.translate("filterBuilder.operators.isNull");
    case FilterRuleOperator.IsNotNull:
      return UiComponents.translate("filterBuilder.operators.isNotNull");
  }
}

/** @alpha */
export function filterRuleOperatorNeedsValue(operator: FilterRuleOperator) {
  switch (operator) {
    case FilterRuleOperator.IsTrue:
    case FilterRuleOperator.IsFalse:
    case FilterRuleOperator.IsNull:
    case FilterRuleOperator.IsNotNull:
      return false;
  }
  return true;
}
