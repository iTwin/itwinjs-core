/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Id64String } from "@bentley/bentleyjs-core";

/**
 * Possible variable value types
 * @public
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
 * @public
 */
export type VariableValue = boolean | string | number | number[] | Id64String[];

/**
 * JSON representation of [[VariableValue]]
 * @public
 */
export type VariableValueJSON = boolean | string | string[] | number | number[];

/**
 * Data structure for representing ruleset variable.
 * @public
 */
export interface RulesetVariable {
  id: string;
  type: VariableValueTypes;
  value: VariableValue;
}

/**
 * JSON representation of [[RulesetVariable]].
 * @public
 */
export interface RulesetVariableJSON {
  id: string;
  type: VariableValueTypes;
  value: VariableValueJSON;
}
