/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/**
 * Presentation rules support variables that allow having additional customization of the hierarchy
 * and content based on variables whose values can change during application session.
 *
 * There are [special ECExpression symbols]($docs/learning/content/ECExpressions.md#ruleset-variables-user-settings)
 * that can be used to access variables by their ID, so rule conditions can check for a value and change
 * the behavior. It allows showing / hiding some nodes in the hierarchy, change the grouping, etc.
 */
export interface VariablesGroup {
  /**
   * Group label to display in the UI.
   * May be [localized]($docs/learning/Localization.md).
   */
  label: string;

  /** Grouped variables */
  vars: Variable[];

  /** Nested variable groups. */
  nestedGroups?: VariablesGroup[];
}

/** Available value types of user-controllable variables */
export const enum VariableValueType {
  /** Bool value, that uses Yes / No strings in the UI */
  YesNo = "YesNo",

  /** Bool value, that uses Show / Hide strings in the UI */
  ShowHide = "ShowHide",

  /** Any string value */
  String = "StringValue",

  /** Any integer value */
  Int = "IntValue",
}

/** Definition for single user-controllable variable */
export interface Variable {
  /** Id of the variable */
  id: string;

  /**
   * Label of the variable that is shown in the UI.
   * May be [localized]($docs/learning/Localization.md).
   */
  label: string;

  /** Defines value type. Defaults to [[VariableValueType.YesNo]]. */
  type?: VariableValueType;

  /** Default value. */
  defaultValue?: string;
}
