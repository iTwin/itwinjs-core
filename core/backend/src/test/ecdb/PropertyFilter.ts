/**
 * Logical operator for joining rules.
 * @beta
 */
export enum PropertyFilterRuleGroupOperator {
  And = "and",
  Or = "or"
}
/**
* Operators for comparing property value in [[PropertyFilterRule]].
* @beta
*/
export enum PropertyFilterRuleOperator {
  IsTrue = "is-true",
  IsFalse = "is-false",
  IsEqual = "is-equal",
  IsNotEqual = "is-not-equal",
  Greater = "greater",
  GreaterOrEqual = "greater-or-equal",
  Less = "less",
  LessOrEqual = "less-or-equal",
  Like = "like",
  IsNull = "is-null",
  IsNotNull = "is-not-null"
}
