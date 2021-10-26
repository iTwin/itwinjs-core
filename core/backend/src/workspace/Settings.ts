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
import { LocalFileName } from "@itwin/core-common";

export type SettingType = JSONSchemaType;
export type SettingName = string;

export type SettingResolver<T> = (val: T, settingName: SettingName, priority: SettingsPriority) => T | undefined;

export interface SettingDictionary {
  [name: string]: SettingType;
}

export enum SettingsPriority {
  defaults = 100,
  application = 200,
  organization = 300,
  iTwin = 400,
  iModel = 500,
}

export interface Settings {
  readonly onSettingsChanged: BeEvent<() => void>;
  addFile(fileName: LocalFileName, priority: SettingsPriority): void;
  addJson(dictionaryName: string, priority: SettingsPriority, settingsJson: string): void;
  addDictionary(dictionaryName: string, priority: SettingsPriority, settings: SettingDictionary): void;
  dropDictionary(fileName: LocalFileName, raiseEvent?: boolean): void;
  resolveSetting<T extends SettingType>(settingName: string, resolver: SettingResolver<T>, defaultValue?: T): T | undefined;
  resolveSetting<T extends SettingType>(settingName: string, resolver: SettingResolver<T>, defaultValue: T): T;
  getSetting<T extends SettingType>(settingName: string, defaultValue?: T): T | undefined;
  getString(settingName: SettingName, defaultValue: string): string;
  getString(settingName: SettingName, defaultValue?: string): string | undefined;
  getBoolean(settingName: SettingName, defaultValue: boolean): boolean;
  getBoolean(settingName: SettingName, defaultValue?: boolean): boolean | undefined;
  getNumber(settingName: SettingName, defaultValue: number): number;
  getNumber(settingName: SettingName): number | undefined;
  getObj(settingName: SettingName, defaultValue: object): object;
  getObj(settingName: SettingName): object | undefined;
  getArray<T>(settingName: SettingName, defaultValue: Array<T>): Array<T>;
  getArray<T>(settingName: SettingName): Array<T> | undefined;
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

  public addFile(fileName: LocalFileName, priority: SettingsPriority) {
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
  public getObj(name: SettingName, defaultValue: object): object;
  public getObj(name: SettingName): object | undefined;
  public getObj(name: SettingName, defaultValue?: object): object | undefined {
    const out = this.getSetting<object>(name);
    return typeof out === "object" ? out : defaultValue;
  }
  public getArray<T>(name: SettingName, defaultValue: Array<T>): Array<T>;
  public getArray<T>(name: SettingName): Array<T> | undefined;
  public getArray<T>(name: SettingName, defaultValue?: Array<T>): Array<T> | undefined {
    const out = this.getSetting<Array<T>>(name);
    return Array.isArray(out) ? out : defaultValue;
  }
}
