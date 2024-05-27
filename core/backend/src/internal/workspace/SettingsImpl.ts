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
import { SettingName, SettingObject, Settings, SettingType } from "../../workspace/Settings";
import { IModelHost } from "../../IModelHost";

const dictionaryMatches = (d1: Settings.Dictionary.Source, d2: Settings.Dictionary.Source): boolean => {
  return (d1.workspaceDb === d2.workspaceDb) && (d1.name === d2.name);
};

class SettingsDictionaryImpl implements Settings.Dictionary {
  public readonly props: Settings.Dictionary.Props;
  public readonly settings: SettingObject;

  public constructor(props: Settings.Dictionary.Props, settings: SettingObject) {
    this.props = { ...props }; // make a copy so it can't be changed by caller
    this.settings = settings;
  }

  public getSetting<T extends SettingType>(settingName: string): T | undefined {
    const value = this.settings[settingName] as T | undefined;
    return undefined !== value ? SettingType.clone(value) : undefined;
  }
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

  public * getSettingEntries<T extends SettingType>(settingName: SettingName): Iterable<{ value: T, dictionary: Settings.Dictionary}> {
    for (const dictionary of this.dictionaries) {
      const value = dictionary.getSetting<T>(settingName);
      if (undefined !== value) {
        yield { value, dictionary };
      }
    }
  }

  public * getSettingValues<T extends SettingType>(settingName: SettingName): Iterable<T> {
    for (const entry of this.getSettingEntries<T>(settingName)) {
      yield entry.value;
    }
  }

  public getSetting<T extends SettingType>(settingName: SettingName, defaultValue?: T): T | undefined {
    for (const value of this.getSettingValues<T>(settingName)) {
      return value;
    }

    return defaultValue;
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
  public getArray<T extends SettingType>(name: SettingName, defaultValue: T[]): T[];
  public getArray<T extends SettingType>(name: SettingName): T[] | undefined;
  public getArray<T extends SettingType>(name: SettingName, defaultValue?: T[]): T[] | undefined {
    if (IModelHost.settingsSchemas.settingDefs.get(name)?.combineArray) {
      return this.getCombinedArray<T>(name, defaultValue);
    }

    const out = this.getSetting<T[]>(name);
    if (out === undefined)
      return defaultValue;
    if (!Array.isArray(out))
      throw new Error(`setting ${name} is not an array: ${out}`);
    return IModelHost.settingsSchemas.validateSetting(out, name);
  }

  private getCombinedArray<T extends SettingType>(name: SettingName, defaultValue?: T[]): T[] | undefined {
    let foundSetting = false;
    const out: T[] = [];
    for (const array of this.getSettingValues<T[]>(name)) {
      foundSetting = true;

      IModelHost.settingsSchemas.validateSetting(array, name);
      for (const value of array) {
        if (!out.includes(value)) {
          out.push(value);
        }
      }
    }

    return foundSetting ? out : defaultValue;
  }
}
