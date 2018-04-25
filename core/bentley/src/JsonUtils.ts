/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

export class JsonUtils {
  public static asBool(json: any, defaultVal: boolean = false): boolean { return (json == null) ? defaultVal : !!json; }
  public static asInt(json: any, defaultVal: number = 0): number { return (typeof json === "number") ? Math.trunc(json) : defaultVal; }
  public static asDouble(json: any, defaultVal: number = 0): number { return (typeof json === "number") ? json : defaultVal; }
  public static asString(json: any, defaultVal: string = ""): string { return (json == null) ? defaultVal : json.toString(); }

  public static setOrRemoveNumber(json: any, key: string, val: number, defaultVal: number) { if (val === defaultVal) delete json[key]; else json[key] = val; }
  public static setOrRemoveBoolean(json: any, key: string, val: boolean, defaultVal: boolean) { if (val === defaultVal) delete json[key]; else json[key] = val; }
}
