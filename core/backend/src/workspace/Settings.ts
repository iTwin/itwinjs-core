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

export interface SettingDictionary {
  [name: string]: SettingType;
}

export enum SettingsPriority {
  application = 100,
  organization = 200,
  iTwin = 300,
  iModel = 500,
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
  public getSetting(settingName: string): SettingType | undefined {
    return this.settings[settingName];
  }
}

export class Settings {
  private static _dictionaries: SettingsDictionary[] = [];
  private static _registryListener: () => void;
  public static readonly onSettingsChanged = new BeEvent<() => void>();

  private static updateDefaults() {
    const defaults: SettingDictionary = {};
    for (const [specName, val] of SettingsSpecRegistry.allSpecs)
      defaults[specName] = val.default!;
    this.addDictionary("_default_", 0, defaults);
  }

  public static reset() {
    if (!this._registryListener)
      this._registryListener = SettingsSpecRegistry.onSpecsChanged.addListener(() => this.updateDefaults());

    this._dictionaries = [];
    this.updateDefaults();
  }

  public static addFile(fileName: string, priority: SettingsPriority) {
    this.addJson(fileName, priority, fs.readFileSync(fileName, "utf-8"));
  }

  public static addJson(dictionaryName: string, priority: SettingsPriority, settingsJson: string) {
    this.addDictionary(dictionaryName, priority, parse(settingsJson));
  }

  public static addDictionary(dictionaryName: string, priority: SettingsPriority, settings: SettingDictionary) {
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

  public static dropDictionary(fileName: string, raiseEvent = true) {
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

  public static getSetting<T extends SettingType>(settingName: string, defaultValue?: T): T | undefined {
    for (const dict of this._dictionaries) {
      const val = dict.getSetting(settingName);
      if (val !== undefined)
        return deepClone<T>(val);
    }
    return defaultValue;
  }

  public static getString(settingName: string, defaultValue: string): string;
  public static getString(settingName: string, defaultValue?: string): string | undefined {
    const out = this.getSetting<string>(settingName);
    return typeof out === "string" ? out : defaultValue;
  }
  public static getBoolean(settingName: string, defaultValue: boolean): boolean;
  public static getBoolean(settingName: string, defaultValue?: boolean): boolean | undefined {
    const out = this.getSetting<boolean>(settingName);
    return typeof out === "boolean" ? out : defaultValue;
  }
  public static getNumber(settingName: string, defaultValue: number): number;
  public static getNumber(settingName: string, defaultValue?: number): number | undefined {
    const out = this.getSetting<number>(settingName);
    return typeof out === "number" ? out : defaultValue;
  }
  public static getObj(settingName: string, defaultValue: object): object;
  public static getObj(settingName: string, defaultValue?: object): object | undefined {
    const out = this.getSetting<object>(settingName);
    return typeof out === "object" ? out : defaultValue;
  }
  public static getArray<T>(settingName: string, defaultValue: Array<T>): Array<T>;
  public static getArray<T>(settingName: string, defaultValue?: Array<T>): Array<T> | undefined {
    const out = this.getSetting<Array<T>>(settingName);
    return Array.isArray(out) ? out : defaultValue;
  }
}
