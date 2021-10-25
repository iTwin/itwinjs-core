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
import { SettingsSpecRegistry } from "./SettingsSpecRegistry";

export type SettingType = JSONSchemaType;

export type SettingResolver<T> = (val: T, settingName: string, priority: SettingsPriority) => T | undefined;

export interface SettingDictionary {
  [name: string]: SettingType;
}

export enum SettingsPriority {
  application = 100,
  organization = 200,
  iTwin = 300,
  iModel = 500,
}

export interface Settings {
  readonly onSettingsChanged: BeEvent<() => void>;
  addFile(fileName: string, priority: SettingsPriority): void;
  addJson(dictionaryName: string, priority: SettingsPriority, settingsJson: string): void;
  addDictionary(dictionaryName: string, priority: SettingsPriority, settings: SettingDictionary): void;
  dropDictionary(fileName: string, raiseEvent?: boolean): void;
  resolveSetting<T extends SettingType>(settingName: string, resolver: SettingResolver<T>): T | undefined;
  getSetting<T extends SettingType>(settingName: string, defaultValue?: T): T | undefined;
  getString(settingName: string, defaultValue: string): string;
  getString(settingName: string): string | undefined;
  getBoolean(settingName: string, defaultValue: boolean): boolean;
  getBoolean(settingName: string): boolean | undefined;
  getNumber(settingName: string, defaultValue: number): number;
  getNumber(settingName: string): number | undefined;
  getObj(settingName: string, defaultValue: object): object;
  getObj(settingName: string): object | undefined;
  getArray<T>(settingName: string, defaultValue: Array<T>): Array<T>;
  getArray<T>(settingName: string): Array<T> | undefined;
}

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

/* @internal */
export class ITwinSettings implements Settings {
  private _dictionaries: SettingsDictionary[] = [];
  public readonly onSettingsChanged = new BeEvent<() => void>();

  private updateDefaults() {
    const defaults: SettingDictionary = {};
    for (const [specName, val] of SettingsSpecRegistry.allSpecs)
      defaults[specName] = val.default!;
    this.addDictionary("_default_", 0, defaults);
  }

  public constructor() {
    SettingsSpecRegistry.onSpecsChanged.addListener(() => this.updateDefaults());
    this._dictionaries = [];
    this.updateDefaults();
  }

  public addFile(fileName: string, priority: SettingsPriority) {
    this.addJson(fileName, priority, fs.readFileSync(fileName, "utf-8"));
  }

  public addJson(dictionaryName: string, priority: SettingsPriority, settingsJson: string) {
    this.addDictionary(dictionaryName, priority, parse(settingsJson));
  }

  public addDictionary(dictionaryName: string, priority: SettingsPriority, settings: SettingDictionary) {
    this.dropDictionary(dictionaryName, false); // make sure we don't have the same dictionary twice
    const file = new SettingsDictionary(dictionaryName, priority, settings);
    for (let i = 0; i < this._dictionaries.length; ++i) {
      if (this._dictionaries[i].priority <= file.priority) {
        this._dictionaries.splice(i, 0, file);
        return;
      }
    }
    this._dictionaries.push(file);
    this.onSettingsChanged.raiseEvent();
  }

  public dropDictionary(fileName: string, raiseEvent = true) {
    for (let i = 0; i < this._dictionaries.length; ++i) {
      if (this._dictionaries[i].name === fileName) {
        this._dictionaries.splice(i, 1);
        if (raiseEvent)
          this.onSettingsChanged.raiseEvent();
        return true;
      }
    }
    return false;
  }

  public resolveSetting<T extends SettingType>(settingName: string, resolver: SettingResolver<T>): T | undefined {
    for (const dict of this._dictionaries) {
      const val = dict.getSetting(settingName) as T | undefined;
      const retVal = val && resolver(val, dict.name, dict.priority);
      if (undefined !== retVal)
        return retVal;
    }
    return undefined;
  }

  public getSetting<T extends SettingType>(settingName: string, defaultValue?: T): T | undefined {
    return this.resolveSetting(settingName, (val) => deepClone<T>(val)) ?? defaultValue;
  }

  public getString(settingName: string, defaultValue: string): string;
  public getString(settingName: string): string | undefined;
  public getString(settingName: string, defaultValue?: string): string | undefined {
    const out = this.getSetting<string>(settingName);
    return typeof out === "string" ? out : defaultValue;
  }
  public getBoolean(settingName: string, defaultValue: boolean): boolean;
  public getBoolean(settingName: string): boolean | undefined;
  public getBoolean(settingName: string, defaultValue?: boolean): boolean | undefined {
    const out = this.getSetting<boolean>(settingName);
    return typeof out === "boolean" ? out : defaultValue;
  }
  public getNumber(settingName: string, defaultValue: number): number;
  public getNumber(settingName: string): number | undefined;
  public getNumber(settingName: string, defaultValue?: number): number | undefined {
    const out = this.getSetting<number>(settingName);
    return typeof out === "number" ? out : defaultValue;
  }
  public getObj(settingName: string, defaultValue: object): object;
  public getObj(settingName: string): object | undefined;
  public getObj(settingName: string, defaultValue?: object): object | undefined {
    const out = this.getSetting<object>(settingName);
    return typeof out === "object" ? out : defaultValue;
  }
  public getArray<T>(settingName: string, defaultValue: Array<T>): Array<T>;
  public getArray<T>(settingName: string): Array<T> | undefined;
  public getArray<T>(settingName: string, defaultValue?: Array<T>): Array<T> | undefined {
    const out = this.getSetting<Array<T>>(settingName);
    return Array.isArray(out) ? out : defaultValue;
  }
}
