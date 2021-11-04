/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import * as fs from "fs-extra";
import { parse } from "json5";
import { BeEvent, JSONSchemaType } from "@itwin/core-bentley";
import { LocalFileName } from "@itwin/core-common";

/** The type of a Setting, according to its schema
 * @beta
 */
export type SettingType = JSONSchemaType;

/**
 * The name of a Setting. SettingNames must be valid JavaScript property names, defined in a [[SettingSpec]].
 * @see [SettingName]($docs/learning/backend/Workspace#settingnames)
 * @beta
 */
export type SettingName = string;

/** The name of a [[SettingDictionary]]. `SettingDictionary`s are stored in [[Settings]] and may be removed by DictionaryName.
 * DictionaryNames must be valid JavaScript property names.
 * @beta
 */
export type DictionaryName = string;

/**
 * A function called by [[Settings.resolveSetting]] for every SettingDictionary with a Setting that matches a name. The
 * SettingDictionaries are sorted by priority and this function is called in priority order with the highest priority first.
 * When this function returns a non-undefined value, the iteration is stopped and that value is returned. In this way,
 * applications can "combine" the prioritized Setting values as appropriate. The default implementation of this function
 * used by [[Settings.getSetting]] merely returns a clone of the value the first time it is called, so the highest priority
 * value is returned.
 * @beta
 */
export type SettingResolver<T> = (val: T, dict: DictionaryName, priority: SettingsPriority) => T | undefined;

/** An entry in the array returned by [[Settings.inspectSetting]]
 * @beta
 *
 */
export interface SettingInspector<T> { value: T, dictionary: DictionaryName, priority: number }

/** An object with string-named members (as opposed to an array object).
 * @beta
 */
export interface SettingObject {
  [name: string]: SettingType;
}

/**
 * An object with Settings as its members. A SettingDictionary also has a name and generally comes from a parsed JSON file, but
 * may also be created in memory by applications
 * @beta
 */
export type SettingDictionary = SettingObject;

/**
 * Values for SettingsPriority determine the sort order for Settings. Higher values take precedence over lower values.
 * @beta
*/
export enum SettingsPriority {
  /** values supplied default-settings files */
  defaults = 100,
  /** values supplied by applications at runtime */
  application = 200,
  /** values that apply to all iTwins for an organization. */
  organization = 300,
  /** values that apply to all iModels in an iTwin. */
  iTwin = 400,
  /** values that apply to a single iModel. */
  iModel = 500,
}

/** The current set of Settings for a Workspace.
 * @beta
 */
export interface Settings {
  /** @internal */
  close(): void;

  /** Event raised whenever a SettingsDictionary is added or removed. */
  readonly onSettingsChanged: BeEvent<() => void>;

  /** Add a SettingDictionary from a local settings file. The file should be in [JSON5](https://json5.org/) format. It is read
   * and parsed and the fileName is used as the DictionaryName.
   * @param fileName the name of a local settings file of the SettingDictionary. This becomes the DictionaryName.
   * @param priority the SettingsPriority for the SettingDictionary
   * @note If the SettingDictionary was previously added, the new content overrides the old content.
   */
  addFile(fileName: LocalFileName, priority: SettingsPriority): void;

  /** Add a SettingDictionary from a JSON5 stringified string. The string is parsed and the resultant object is added as a SettingDictionary.
   * @param dictionaryName the name of the SettingDictionary
   * @param priority the SettingsPriority for the SettingDictionary
   * @param settingsJson the JSON5 stringified string to be parsed.
   * @note If the SettingDictionary was previously added, the new content overrides the old content.
   */
  addJson(dictionaryName: DictionaryName, priority: SettingsPriority, settingsJson: string): void;

  /** Add a SettingDictionary object.
   * @param dictionaryName the name of the SettingDictionary
   * @param priority the SettingsPriority for the SettingDictionary
   * @param settings the SettingDictionary object to be added.
   * @note If the SettingDictionary was previously added, the new content overrides the old content.
   */
  addDictionary(dictionaryName: DictionaryName, priority: SettingsPriority, settings: SettingDictionary): void;

  /** Remove a SettingDictionary by name. */
  dropDictionary(dictionaryName: DictionaryName): void;

  /**
   * Resolve a setting, by name, using a SettingResolver.
   * @param settingName The name of the setting to resolve
   * @param resolver function to be called for each SettingDictionary with a matching Setting. Iteration stops when it returns a non-undefined value.
   * @param defaultValue value returned if settingName is not present in any SettingDictionary or resolver never returned a value.
   * @returns the resolved setting value.
   */
  resolveSetting<T extends SettingType>(settingName: SettingName, resolver: SettingResolver<T>, defaultValue?: T): T | undefined;
  resolveSetting<T extends SettingType>(settingName: SettingName, resolver: SettingResolver<T>, defaultValue: T): T;

  /** Get the highest priority setting for a SettingName.
   * @param settingName The name of the setting
   * @param defaultValue value returned if settingName is not present in any SettingDictionary.
   * @note This method is generic on SettingType, but no type checking is actually performed at run time. So, if you
   * use this method to get a setting with an expected type, but its value is a different type, the return type of this method will be wrong.
   * You must always type check the result. Use the non-generic "get" methods (e.g. [[getString]]) if you only want the value
   * if its type is correct.
   */
  getSetting<T extends SettingType>(settingName: SettingName, defaultValue?: T): T | undefined;

  /** Get a string setting by SettingName.
   * @param settingName The name of the setting
   * @param defaultValue value returned if settingName is not present in any SettingDictionary, or if the highest priority setting is not a string.
   */
  getString(settingName: SettingName, defaultValue: string): string;
  getString(settingName: SettingName, defaultValue?: string): string | undefined;

  /** Get a boolean setting by SettingName.
  * @param settingName The name of the setting
  * @param defaultValue value returned if settingName is not present in any SettingDictionary, or if the highest priority setting is not a boolean.
  */
  getBoolean(settingName: SettingName, defaultValue: boolean): boolean;
  getBoolean(settingName: SettingName, defaultValue?: boolean): boolean | undefined;

  /** Get a number setting by SettingName.
  * @param settingName The name of the setting
  * @param defaultValue value returned if settingName is not present in any SettingDictionary, or if the highest priority setting is not a number.
  */
  getNumber(settingName: SettingName, defaultValue: number): number;
  getNumber(settingName: SettingName): number | undefined;

  /** Get an object setting by SettingName.
  * @param settingName The name of the setting
  * @param defaultValue value returned if settingName is not present in any SettingDictionary, or if the highest priority setting is not an object.
  */
  getObject(settingName: SettingName, defaultValue: SettingObject): SettingObject;
  getObject(settingName: SettingName): SettingObject | undefined;

  /** Get an array setting by SettingName.
  * @param settingName The name of the setting
  * @param defaultValue value returned if settingName is not present in any SettingDictionary, or if the highest priority setting is not an array.
  */
  getArray<T>(settingName: SettingName, defaultValue: Array<T>): Array<T>;
  getArray<T>(settingName: SettingName): Array<T> | undefined;

  /** Get an array of [[SettingInspector] objects, sorted in priority order, for all Settings that match a SettingName.
   * @note this method is mainly for debugging and diagnostics.
   */
  inspectSetting<T extends SettingType>(name: SettingName): SettingInspector<T>[];
}

/** @internal */
function deepClone<T extends SettingType>(obj: any): T {
  if (!obj || typeof obj !== "object")
    return obj;

  const result = Array.isArray(obj) ? [] : {} as any;
  Object.keys(obj).forEach((key: string) => {
    const val = obj[key];
    if (val && typeof val === "object") {
      result[key] = deepClone(val);
    } else {
      result[key] = val;
    }
  });
  return result;
}

class SettingsDictionary {
  public constructor(public readonly name: string, public readonly priority: SettingsPriority, public readonly settings: SettingDictionary) { }
  public getSetting<T extends SettingType>(settingName: string): SettingType | undefined {
    return this.settings[settingName] as T | undefined;
  }
}

/**
 * Internal implementation of Settings interface.
 * @internal
 */
export class BaseSettings implements Settings {
  private _dictionaries: SettingsDictionary[] = [];
  protected verifyPriority(_priority: SettingsPriority) { }
  public close() { }
  public readonly onSettingsChanged = new BeEvent<() => void>();

  public addFile(fileName: LocalFileName, priority: SettingsPriority) {
    this.addJson(fileName, priority, fs.readFileSync(fileName, "utf-8"));
  }

  public addJson(dictionaryName: string, priority: SettingsPriority, settingsJson: string) {
    this.addDictionary(dictionaryName, priority, parse(settingsJson));
  }

  public addDictionary(dictionaryName: string, priority: SettingsPriority, settings: SettingDictionary) {
    this.verifyPriority(priority);
    this.dropDictionary(dictionaryName, false); // make sure we don't have the same dictionary twice
    const file = new SettingsDictionary(dictionaryName, priority, settings);
    const doAdd = () => {
      for (let i = 0; i < this._dictionaries.length; ++i) {
        if (this._dictionaries[i].priority <= file.priority) {
          this._dictionaries.splice(i, 0, file);
          return;
        }
      }
      this._dictionaries.push(file);
    };
    doAdd();
    this.onSettingsChanged.raiseEvent();
  }

  public dropDictionary(dictionaryName: DictionaryName, raiseEvent = true) {
    for (let i = 0; i < this._dictionaries.length; ++i) {
      if (this._dictionaries[i].name === dictionaryName) {
        this._dictionaries.splice(i, 1);
        if (raiseEvent)
          this.onSettingsChanged.raiseEvent();
        return true;
      }
    }
    return false;
  }

  public resolveSetting<T extends SettingType>(name: SettingName, resolver: SettingResolver<T>, defaultValue?: T): T | undefined {
    for (const dict of this._dictionaries) {
      const val = dict.getSetting(name) as T | undefined;
      const resolved = val && resolver(val, dict.name, dict.priority);
      if (undefined !== resolved)
        return resolved;
    }
    return defaultValue;
  }

  public getSetting<T extends SettingType>(name: SettingName, defaultValue?: T): T | undefined {
    return this.resolveSetting(name, (val) => deepClone<T>(val)) ?? defaultValue;
  }

  /** for debugging. Returns an array of all values for a setting, sorted by priority.
   * @note values are not cloned. Do not modify objects or arrays.
   */
  public inspectSetting<T extends SettingType>(name: SettingName): SettingInspector<T>[] {
    const all: SettingInspector<T>[] = [];
    this.resolveSetting<T>(name, (value, dictionary, priority) => { all.push({ value, dictionary, priority }); return undefined; });
    return all;
  }

  public getString(name: SettingName, defaultValue: string): string;
  public getString(name: SettingName): string | undefined;
  public getString(name: SettingName, defaultValue?: string): string | undefined {
    const out = this.getSetting<string>(name);
    return typeof out === "string" ? out : defaultValue;
  }
  public getBoolean(name: SettingName, defaultValue: boolean): boolean;
  public getBoolean(name: SettingName): boolean | undefined;
  public getBoolean(name: SettingName, defaultValue?: boolean): boolean | undefined {
    const out = this.getSetting<boolean>(name);
    return typeof out === "boolean" ? out : defaultValue;
  }
  public getNumber(name: SettingName, defaultValue: number): number;
  public getNumber(name: SettingName): number | undefined;
  public getNumber(name: SettingName, defaultValue?: number): number | undefined {
    const out = this.getSetting<number>(name);
    return typeof out === "number" ? out : defaultValue;
  }
  public getObject(name: SettingName, defaultValue: SettingObject): SettingObject;
  public getObject(name: SettingName): SettingObject | undefined;
  public getObject(name: SettingName, defaultValue?: SettingObject): SettingObject | undefined {
    const out = this.getSetting<SettingObject>(name);
    return typeof out === "object" ? out : defaultValue;
  }
  public getArray<T>(name: SettingName, defaultValue: Array<T>): Array<T>;
  public getArray<T>(name: SettingName): Array<T> | undefined;
  public getArray<T>(name: SettingName, defaultValue?: Array<T>): Array<T> | undefined {
    const out = this.getSetting<Array<T>>(name);
    return Array.isArray(out) ? out : defaultValue;
  }
}
