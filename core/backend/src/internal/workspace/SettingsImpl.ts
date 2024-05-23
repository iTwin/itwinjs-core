/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import * as fs from "fs-extra";
import { parse } from "json5";
import { extname, join } from "path";
import { BeEvent } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelJsFs } from "../../IModelJsFs";
import { SettingName, SettingObject, SettingType, Settings } from "../../workspace/Settings";
import { IModelHost } from "../../IModelHost";

function deepClone<T extends SettingType>(obj: any): T {
  if (!obj || typeof obj !== "object")
    return obj;

  const result = Array.isArray(obj) ? [] : {} as any;
  Object.keys(obj).forEach((key: string) => result[key] = deepClone(obj[key]));
  return result;
};

const dictionaryMatches = (d1: Settings.Dictionary.Source, d2: Settings.Dictionary.Source): boolean => {
  return (d1.workspaceDb === d2.workspaceDb) && (d1.name === d2.name);
};

class SettingsDictionaryImpl implements Settings.Dictionary {
  public readonly props: Settings.Dictionary.Props;
  public constructor(props: Settings.Dictionary.Props, public readonly settings: SettingObject) {
    this.props = { ...props }; // make a copy so it can't be changed by caller
  }
  public getSetting<T extends SettingType>(settingName: string): T | undefined { return this.settings[settingName] as T | undefined; }
}

/**
 * Internal implementation of Settings interface.
 * @internal
 */
export class SettingsImpl implements Settings {
  public dictionaries: Settings.Dictionary[] = [];
  protected verifyPriority(_priority: Settings.Priority) { }
  public close() { }
  public readonly onSettingsChanged = new BeEvent<() => void>();

  public addFile(fileName: LocalFileName, priority: Settings.Priority) {
    this.addJson({ name: fileName, priority }, fs.readFileSync(fileName, "utf-8"));
  }

  public addDirectory(dirName: LocalDirName, priority: Settings.Priority) {
    for (const fileName of IModelJsFs.readdirSync(dirName)) {
      const ext = extname(fileName);
      if (ext === ".json5" || ext === ".json")
        this.addFile(join(dirName, fileName), priority);
    }
  }

  public addJson(props: Settings.Dictionary.Props, settingsJson: string) {
    this.addDictionary(props, parse(settingsJson));
  }

  public addDictionary(props: Settings.Dictionary.Props, settings: SettingObject) {
    this.verifyPriority(props.priority);
    this.dropDictionary(props, false); // make sure we don't have the same dictionary twice
    const dict = new SettingsDictionaryImpl(props, settings);
    const doAdd = () => {
      for (let i = 0; i < this.dictionaries.length; ++i) {
        if (this.dictionaries[i].props.priority <= dict.props.priority) {
          this.dictionaries.splice(i, 0, dict);
          return;
        }
      }
      this.dictionaries.push(dict);
    };
    doAdd();
    this.onSettingsChanged.raiseEvent();
  }

  public getDictionary(source: Settings.Dictionary.Source): Settings.Dictionary | undefined {
    for (const dictionary of this.dictionaries) {
      if (dictionaryMatches(dictionary.props, source))
        return dictionary;
    }
    return undefined;
  }

  public dropDictionary(source: Settings.Dictionary.Source, raiseEvent = true) {
    for (let i = 0; i < this.dictionaries.length; ++i) {
      if (dictionaryMatches(this.dictionaries[i].props, source)) {
        this.dictionaries.splice(i, 1);
        if (raiseEvent)
          this.onSettingsChanged.raiseEvent();
        return true;
      }
    }
    return false;
  }

  public resolveSetting<T extends SettingType>(arg: { settingName: SettingName, resolver: Settings.Resolver<T> }, defaultValue?: T): T | undefined {
    for (const dict of this.dictionaries) {
      const val = dict.getSetting<T>(arg.settingName);
      const resolved = val && arg.resolver(val, dict);
      if (undefined !== resolved)
        return resolved;
    }
    return defaultValue;
  }

  public * getSettingValues<T extends SettingType>(settingName: SettingName): Iterable<{ value: T, dictionary: Settings.Dictionary}> {
    for (const dictionary of this.dictionaries) {
      const value = dictionary.getSetting<T>(settingName);
      if (undefined !== value) {
        yield { value, dictionary };
      }
    }
  }

  public getSetting<T extends SettingType>(settingName: SettingName, defaultValue?: T): T | undefined {
    return this.resolveSetting({ settingName, resolver: (val) => deepClone<T>(val) }) ?? defaultValue;
  }

  // get the setting and verify the result is either undefined or the correct type. If so, return it. Otherwise throw an exception.
  private getResult<T extends SettingType>(name: SettingName, expectedType: string) {
    const out = this.getSetting<T>(name);
    if (out === undefined || typeof out === expectedType)
      return out;
    throw new Error(`setting "${name}" is not a ${expectedType}: ${typeof out}`);
  }
  public getString(name: SettingName, defaultValue: string): string;
  public getString(name: SettingName): string | undefined;
  public getString(name: SettingName, defaultValue?: string): string | undefined {
    return this.getResult<string>(name, "string") ?? defaultValue;
  }
  public getBoolean(name: SettingName, defaultValue: boolean): boolean;
  public getBoolean(name: SettingName): boolean | undefined;
  public getBoolean(name: SettingName, defaultValue?: boolean): boolean | undefined {
    return this.getResult<boolean>(name, "boolean") ?? defaultValue;
  }
  public getNumber(name: SettingName, defaultValue: number): number;
  public getNumber(name: SettingName): number | undefined;
  public getNumber(name: SettingName, defaultValue?: number): number | undefined {
    return this.getResult<number>(name, "number") ?? defaultValue;
  }
  public getObject<T extends object>(name: SettingName, defaultValue: T): T;
  public getObject<T extends object>(name: SettingName): T | undefined;
  public getObject<T extends object>(name: SettingName, defaultValue?: T): T | undefined {
    const out = this.getResult<T>(name, "object");
    return out ? IModelHost.settingsSchemas.validateSetting(out, name) : defaultValue;
  }
  public getArray<T extends SettingType>(name: SettingName, defaultValue: Array<T>): Array<T>;
  public getArray<T extends SettingType>(name: SettingName): Array<T> | undefined;
  public getArray<T extends SettingType>(name: SettingName, defaultValue?: Array<T>): Array<T> | undefined {
    const out = this.getSetting<Array<T>>(name);
    if (out === undefined)
      return defaultValue;
    if (!Array.isArray(out))
      throw new Error(`setting ${name} is not an array: ${out}`);
    return IModelHost.settingsSchemas.validateSetting(out, name);
  }
}
