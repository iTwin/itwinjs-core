/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64String } from "@bentley/bentleyjs-core";

/**
 * Possible variable value types
 * @hidden
 */
export const enum VariableValueTypes {
  /** Integer value */
  Int = "int",

  /** Array of integer values */
  IntArray = "int[]",

  /** Boolean value */
  Bool = "bool",

  /** String value */
  String = "string",

  /** Id64String value */
  Id64 = "id64",

  /** Array of Id64String values */
  Id64Array = "id64[]",

}

/**
 * Union of all supported variable value types
 * @hidden
 */
export type VariableValue = boolean | string | number | number[] | Id64String[];
/** @hidden */
export type VariableValueJSON = boolean | string | string[] | number | number[];

/** @hidden */
export interface RulesetVariablesState { [rulesetId: string]: Array<[string, VariableValueTypes, VariableValue]>; }

/** @hidden */
export namespace RulesetVariablesState {
  export const STATE_ID = "ruleset variables";
}
