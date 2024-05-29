/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { BeEvent, JSONSchemaType } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { WorkspaceDb } from "./Workspace";

/** The type of a Setting, according to its schema
 * @beta
 */
export type SettingType = JSONSchemaType;

/** @beta */
export namespace SettingType { // eslint-disable-line @typescript-eslint/no-redeclare
  export function clone<T extends SettingType>(object: T): T {
    if (!object || typeof object !== "object")
      return object;

    const result = Array.isArray(object) ? [] : {} as any;
    Object.keys(object).forEach((key: string) => result[key] = clone((object as any)[key]));
    return result;
  }
}

/**
 * The name of a Setting. SettingNames must be valid JavaScript property names, defined in a [[SettingSchema]].
 * @see [SettingName]($docs/learning/backend/Workspace#settingnames)
 * @beta
 */
export type SettingName = string;

/** An object with only string-named members.
 * @beta
 */
export interface SettingObject {
  [name: SettingName]: SettingType | undefined;
}

/** @beta */
export namespace Settings {
  /**
   * Values for Settings.Priority determine the sort order for Settings. Higher values take precedence over lower values.
   * @beta
   */
  export enum Priority {
    /** values supplied default-settings files */
    defaults = 100,
    /** values supplied by applications at runtime */
    application = 200,
    /** values that apply to all iTwins for an organization. */
    organization = 300,
    /** values that apply to all iModels in an iTwin. */
    iTwin = 400,
    /** values that apply to all branches of an iModel. */
    branch = 500,
    /** values stored in an iModel. */
    iModel = 600,
  }

  /**
   * A dictionary of SettingObjects with a source and priority.
   * @beta
   */
  export interface Dictionary {
    readonly props: Dictionary.Props;

    // Value always cloned.
    getSetting<T extends SettingType>(settingName: string): T | undefined;
  }

  /** @beta */
  export namespace Dictionary {
    /** The source for a Settings.Dictionary. Used to uniquely identify a Settings.Dictionary. */
    export interface Source {
      readonly workspaceDb?: WorkspaceDb;
      readonly name: string;
    }
    /** The properties required for adding a new Settings.Dictionary. */
    export interface Props extends Source {
      readonly priority: Priority | number;
    }
  }
}

/** The current set of Settings for a Workspace.
 * @beta
 */
export interface Settings {
  /** @internal */
  close(): void;

  /** the array of `Settings.Dictionary` entries for this `Settings`, sorted by priority. */
  readonly dictionaries: readonly Settings.Dictionary[];

  /** Event raised whenever a Settings.Dictionary is added or removed. */
  readonly onSettingsChanged: BeEvent<() => void>;

  /** Add a Settings.Dictionary from a local settings file. The file should be in [JSON5](https://json5.org/) format. It is read
   * and parsed and the fileName is used as the dictionary name.
   * @param fileName the name of a local settings file of the Settings.Dictionary.
   * @param priority the Settings.Priority for the Settings.Dictionary
   * @note If the Settings.Dictionary was previously added, the new content overrides the old content.
   */
  addFile(fileName: LocalFileName, priority: Settings.Priority | number): void;

  /** Add all files in the supplied directory with the extension ".json" or ".json5"
   * @param dirName the name of a local settings directory
   */
  addDirectory(dirName: LocalDirName, priority: Settings.Priority | number): void;

  /** Add a Settings.Dictionary from a JSON5 stringified string. The string is parsed and the resultant object is added as a Settings.Dictionary.
   * @param props properties of the Settings.Dictionary
   * @param settingsJson the JSON5 stringified string to be parsed.
   * @note If the Settings.Dictionary was previously added, the new content overrides the old content.
   */
  addJson(props: Settings.Dictionary.Props, settingsJson: string): void;

  /** get a Settings.Dictionary from this Settings that matches a source. */
  getDictionary(source: Settings.Dictionary.Source): Settings.Dictionary | undefined;

  /** Add a new Settings.Dictionary to this Settings.
   * @param props properties of the Settings.Dictionary
   * @param settings the Settings in the dictionary.
   * @note If the Settings.Dictionary was previously added, the new content replaces the old content.
   */
  addDictionary(props: Settings.Dictionary.Props, settings: SettingObject): void;

  /** Remove a Settings.Dictionary by name. */
  dropDictionary(props: Settings.Dictionary.Source): void;

  /** Get the highest priority setting for a SettingName.
   * @param settingName The name of the setting
   * @param defaultValue value returned if settingName is not present in any Settings.Dictionary.
   * @note This method is generic on SettingType, but no type checking is actually performed at run time. So, if you
   * use this method to get a setting with an expected type, but its value is a different type, the return type of this method will be wrong.
   * You must always type check the result. Use the non-generic "get" methods (e.g. [[getString]]) if you only want the value
   * if its type is correct.
   */
  getSetting<T extends SettingType>(settingName: SettingName, defaultValue?: T): T | undefined;

  getSettingEntries<T extends SettingType>(settingName: SettingName): Iterable<{ value: T, dictionary: Settings.Dictionary}>;

  getSettingValues<T extends SettingType>(settingName: SettingName): Iterable<T>;

  /** Get a string setting by SettingName.
   * @param settingName The name of the setting
   * @param defaultValue value returned if settingName is not present in any Settings.Dictionary, or if the highest priority setting is not a string.
   */
  getString(settingName: SettingName, defaultValue: string): string;
  getString(settingName: SettingName, defaultValue?: string): string | undefined;

  /** Get a boolean setting by SettingName.
  * @param settingName The name of the setting
  * @param defaultValue value returned if settingName is not present in any Settings.Dictionary, or if the highest priority setting is not a boolean.
  */
  getBoolean(settingName: SettingName, defaultValue: boolean): boolean;
  getBoolean(settingName: SettingName, defaultValue?: boolean): boolean | undefined;

  /** Get a number setting by SettingName.
  * @param settingName The name of the setting
  * @param defaultValue value returned if settingName is not present in any Settings.Dictionary, or if the highest priority setting is not a number.
  */
  getNumber(settingName: SettingName, defaultValue: number): number;
  getNumber(settingName: SettingName): number | undefined;

  /** Get an object setting by SettingName.
  * @param settingName The name of the setting
  * @param defaultValue value returned if settingName is not present in any Settings.Dictionary, or if the highest priority setting is not an object.
  */
  getObject<T extends object>(settingName: SettingName, defaultValue: T): T;
  getObject<T extends object>(settingName: SettingName): T | undefined;

  /** Get an array setting by SettingName.
  * @param settingName The name of the setting
  * @param defaultValue value returned if settingName is not present in any Settings.Dictionary, or if the highest priority setting is not an array.
  */
  getArray<T extends SettingType>(settingName: SettingName, defaultValue: Array<T>): Array<T>;
  getArray<T extends SettingType>(settingName: SettingName): Array<T> | undefined;
}
