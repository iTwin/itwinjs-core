/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

/** Utility functions for converting from JSON objects, with default values. */
export class JsonUtils {
  /** Get a value as a boolean.
   * @param json the input JSON object
   * @param defaultVal default value if json cannot be converted to boolean
   * @returns the value of json as a boolean, or default value
   */
  public static asBool(json: any, defaultVal = false): boolean { return (json == null) ? defaultVal : !!json; }
  /** Get a value as an integer.
   * @param json the input JSON object
   * @param defaultVal default value if json cannot be converted to integer
   * @returns the value of json as an integer, or default value
   */
  public static asInt(json: any, defaultVal = 0): number { return (typeof json === "number") ? Math.trunc(json) : defaultVal; }
  /** Get a value as a double.
   * @param json the input JSON object
   * @param defaultVal default value if json cannot be converted to double
   * @returns the value of json as a double, or default value
   */
  public static asDouble(json: any, defaultVal = 0): number { return (typeof json === "number") ? json : defaultVal; }
  /** Get a value as a string.
   * @param json the input JSON object
   * @param defaultVal default value if json cannot be converted to string
   * @returns the value of json as a string, or default value
   */
  public static asString(json: any, defaultVal = ""): string { return (json == null) ? defaultVal : json.toString(); }

  /** Set or remove a number on a json object, given a key name, a value, and a default value. Sets `json[key] = val` if val is *not* equal to the default,
   * otherwise `delete json[key]`. This is used to omit values from JSON strings that are of known defaults.
   * @param json the JSON object to affect
   * @param key the name of the member to set or remove
   * @param val the value to set
   * @param defaultVal the default value.
   */
  public static setOrRemoveNumber(json: any, key: string, val: number, defaultVal: number) { if (val === defaultVal) delete json[key]; else json[key] = val; }

  /** Set or remove a boolean on a json object, given a key name, a value, and a default value. Sets `json[key] = val` if val is *not* equal to the default,
   * otherwise `delete json[key]`. This is used to omit values from JSON strings that are of known defaults.
   * @param json the JSON object to affect
   * @param key the name of the member to set or remove
   * @param val the value to set
   * @param defaultVal the default value.
   */
  public static setOrRemoveBoolean(json: any, key: string, val: boolean, defaultVal: boolean) { if (val === defaultVal) delete json[key]; else json[key] = val; }
}
