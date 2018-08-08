/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

/** Utility functions for converting from JSON objects, with default values. */
export namespace JsonUtils {
  /** Get a value as a boolean.
   * @param json the input JSON object
   * @param defaultVal default value if json cannot be converted to boolean
   * @returns the value of json as a boolean, or default value
   */
  export function asBool(json: any, defaultVal = false): boolean { return isNullOrUndefined(json) ? defaultVal : !!json; }
  /** Get a value as an integer.
   * @param json the input JSON object
   * @param defaultVal default value if json cannot be converted to integer
   * @returns the value of json as an integer, or default value
   */
  export function asInt(json: any, defaultVal = 0): number { return (typeof json === "number") ? Math.trunc(json) : defaultVal; }
  /** Get a value as a double.
   * @param json the input JSON object
   * @param defaultVal default value if json cannot be converted to double
   * @returns the value of json as a double, or default value
   */
  export function asDouble(json: any, defaultVal = 0): number { return (typeof json === "number") ? json : defaultVal; }
  /** Get a value as a string.
   * @param json the input JSON object
   * @param defaultVal default value if json cannot be converted to string
   * @returns the value of json as a string, or default value
   */
  export function asString(json: any, defaultVal = ""): string { return isNullOrUndefined(json) ? defaultVal : json.toString(); }

  /** Get a value as an array.
   * @param json the input JSON object
   * @returns the input JSON object if it is an array, otherwise undefined
   */
  export function asArray(json: any): any { return Array.isArray(json) ? json : undefined; }

  /** Get a value as an object.
   * @param json the input JSON object
   * @returns the input JSON object if it is an object, otherwise undefined
   */
  export function asObject(json: any): any { return "object" === typeof json ? json : undefined; }

  /** Set or remove a number on a json object, given a key name, a value, and a default value. Sets `json[key] = val` if val is *not* equal to the default,
   * otherwise `delete json[key]`. This is used to omit values from JSON strings that are of known defaults.
   * @param json the JSON object to affect
   * @param key the name of the member to set or remove
   * @param val the value to set
   * @param defaultVal the default value.
   */
  export function setOrRemoveNumber(json: any, key: string, val: number, defaultVal: number) { if (val === defaultVal) delete json[key]; else json[key] = val; }

  /** Set or remove a boolean on a json object, given a key name, a value, and a default value. Sets `json[key] = val` if val is *not* equal to the default,
   * otherwise `delete json[key]`. This is used to omit values from JSON strings that are of known defaults.
   * @param json the JSON object to affect
   * @param key the name of the member to set or remove
   * @param val the value to set
   * @param defaultVal the default value.
   */
  export function setOrRemoveBoolean(json: any, key: string, val: boolean, defaultVal: boolean) { if (val === defaultVal) delete json[key]; else json[key] = val; }

  function isNullOrUndefined(json: any): boolean { return null === json || undefined === json; }

  /**
   * Convert the input object into a "pure" JavaScript object, with only instances of "object" or primitives in the returned value.
   * Works recursively for object members, and over arrays entries. Calls "toJSON" on any members that implement it.
   */
  export function toObject(val: any): any {
    if (typeof val === "boolean" || typeof val === "number" || typeof val === "string")
      return val;

    if (typeof val !== "object")
      return undefined;

    // See if the object has toJSON() function defined.
    if (typeof val.toJSON !== "undefined")
      return toObject(val.toJSON());

    // if it's an array, convert each member.
    if (Array.isArray(val)) {
      const arr = new Array(val.length);
      val.forEach((el, i) => { arr[i] = toObject(el); });
      return arr;
    }

    // Convert each property
    const out: any = {};
    Object.getOwnPropertyNames(val).forEach((prop) => {
      const transformVal = toObject(val[prop]);
      if (transformVal !== undefined)
        out[prop] = transformVal;
    });

    return out;
  }

}
