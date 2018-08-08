/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

/**
 * Interface for a manager that allows setting and accessing ruleset variables.
 */
export interface IRulesetVariablesManager {
  /**
   * Retrieves `string` variable value.
   * Returns empty string if variable does not exist or does not convert to string.
   */
  getString(variableId: string): Promise<string>;
  /**
   * Sets `string` variable value
   */
  setString(variableId: string, value: string): Promise<void>;

  /**
   * Retrieves `boolean` variable value.
   * Returns `false` if variable does not exist or does not convert to boolean.
   */
  getBool(variableId: string): Promise<boolean>;
  /**
   * Sets `boolean` variable value
   */
  setBool(variableId: string, value: boolean): Promise<void>;

  /**
   * Retrieves `number` variable value.
   * Returns `0` if variable does not exist or does not convert to integer.
   */
  getInt(variableId: string): Promise<number>;
  /**
   * Sets `number` variable value
   */
  setInt(variableId: string, value: number): Promise<void>;

  /**
   * Retrieves `number[]` variable value.
   * Returns empty array if variable does not exist or does not convert to integer array.
   */
  getInts(variableId: string): Promise<number[]>;
  /**
   * Sets `number[]` variable value
   */
  setInts(variableId: string, value: number[]): Promise<void>;

  /**
   * Retrieves `Id64` variable value.
   * Returns invalid Id64 if variable does not exist or does not convert to Id64.
   */
  getId64(variableId: string): Promise<Id64>;
  /**
   * Sets `Id64` variable value
   */
  setId64(variableId: string, value: Id64): Promise<void>;

  /**
   * Retrieves `Id64[]` variable value.
   * Returns empty array if variable does not exist or does not convert to Id64 array.
   */
  getId64s(variableId: string): Promise<Id64[]>;
  /**
   * Sets `Id64[]` variable value
   */
  setId64s(variableId: string, value: Id64[]): Promise<void>;
}
