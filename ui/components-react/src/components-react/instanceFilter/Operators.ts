/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyDescription } from "@itwin/appui-abstract";

/** @alpha */
export enum FilterRuleGroupOperator {
  And = "AND",
  Or = "OR"
}

/** @alpha */
export enum FilterRuleOperator {
  IsTrue = "IS TRUE",
  IsFalse = "IS FALSE",

  IsEqual = "=",
  IsNotEqual = "<>",

  Greater = ">",
  GreaterOrEqual = ">=",
  Less = "<",
  LessOrEqual = "<=",

  Like = "LIKE",

  IsNull = "IS NULL",
  IsNotNull = "IS NOT NULL",
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

/** @alpha */
export function getFilterRuleOperatorLabel(operator: FilterRuleOperator) {
  switch(operator) {
    case FilterRuleOperator.IsTrue:
      return "IS TRUE";
    case FilterRuleOperator.IsFalse:
      return "IS FALSE";
    case FilterRuleOperator.IsEqual:
      return "EQUAL";
    case FilterRuleOperator.IsNotEqual:
      return "NOT EQUAL";
    case FilterRuleOperator.Greater:
      return ">";
    case FilterRuleOperator.GreaterOrEqual:
      return ">=";
    case FilterRuleOperator.Less:
      return "<";
    case FilterRuleOperator.LessOrEqual:
      return "<=";
    case FilterRuleOperator.Like:
      return "CONTAINS";
    case FilterRuleOperator.IsNull:
      return "IS NULL";
    case FilterRuleOperator.IsNotNull:
      return "IS NOT NULL";
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
