/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64String } from "@bentley/bentleyjs-core";

/**
 * Possible variable value types
 * @internal
 */
export enum VariableValueTypes {
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
 * @internal
 */
export type VariableValue = boolean | string | number | number[] | Id64String[];
/** @internal */
export type VariableValueJSON = boolean | string | string[] | number | number[];

/** @internal */
export interface RulesetVariablesState { [rulesetId: string]: Array<[string, VariableValueTypes, VariableValue]>; }

/** @internal */
export namespace RulesetVariablesState {
  export const STATE_ID = "ruleset variables";
}
