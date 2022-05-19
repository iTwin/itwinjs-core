/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyDescription } from "@itwin/appui-abstract";

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
  const typename = property.typename.toLowerCase();

  if (typename === "boolean") {
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

  if (typename === "double"
    || typename === "int"
    || typename === "long") {
    return [
      ...operators,
      FilterRuleOperator.Greater,
      FilterRuleOperator.GreaterOrEqual,
      FilterRuleOperator.Less,
      FilterRuleOperator.LessOrEqual,
    ];
  }

  if (typename === "string") {
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
      return "Is True";
    case FilterRuleOperator.IsFalse:
      return "Is False";
    case FilterRuleOperator.IsEqual:
      return "Equal";
    case FilterRuleOperator.IsNotEqual:
      return "Not Equal";
    case FilterRuleOperator.Greater:
      return ">";
    case FilterRuleOperator.GreaterOrEqual:
      return ">=";
    case FilterRuleOperator.Less:
      return "<";
    case FilterRuleOperator.LessOrEqual:
      return "<=";
    case FilterRuleOperator.Like:
      return "Contains";
    case FilterRuleOperator.IsNull:
      return "Is Null";
    case FilterRuleOperator.IsNotNull:
      return "Is Not Null";
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
