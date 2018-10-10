/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64 } from "@bentley/bentleyjs-core";

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

  /** Id64 value */
  Id64 = "id64",

  /** Array of Id64 values */
  Id64Array = "id64[]",

}

/**
 * Union of all supported variable value types
 * @hidden
 */
export type VariableValue = boolean | string | number | number[] | Id64 | Id64[];
/** @hidden */
export type VariableValueJSON = boolean | string | string[] | number | number[];

/** @hidden */
export interface RulesetVariablesState { [rulesetId: string]: Array<[string, VariableValueTypes, VariableValue]>; }

/** @hidden */
export namespace RulesetVariablesState {
  export const STATE_ID = "ruleset variables";
}
