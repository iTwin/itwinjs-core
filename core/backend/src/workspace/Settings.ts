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
import { _implementationProhibited } from "../internal/Symbols";

/** The value of a single named parameter within a [[Workspace.settings]] that configures some aspect of the applications run-time behavior.
 * Settings are stored in a [[SettingsDictionary]]. A setting is described by its [[SettingSchema]].
 * @beta
 */
export type Setting = JSONSchemaType;

/** @beta */
export namespace Setting { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Create a deep copy of a [[Setting]]. */
  export function clone<T extends Setting>(setting: T): T {
    if (!setting || typeof setting !== "object")
      return setting;

    const result = Array.isArray(setting) ? [] : {} as any;
    Object.keys(setting).forEach((key: string) => result[key] = clone((setting as any)[key]));
    return result;
  }

  /** Returns true if `a` and `b` are considered equivalent [[Setting]] values.
   * Settings of primitive types like `number` and `string` are compared using `===`.
   * Settings of type "object" are compared by comparing each property using `areEqual`; the objects are considered
   * equal if they have the exact same set of property names with equivalent values.
   * Settings of type "array" are compared by comparing each element of the arrays use `areEqual`; the arrays are considered
   * equal if they have the same number of elements with equivalent values in the same exact order.
   */
  export function areEqual(a: Setting | undefined, b: Setting | undefined): boolean {
    if (a === b) {
      return true;
    }

    // For primitive types, === suffices.
    if (typeof a !== "object" || typeof b !== "object") {
      return false;
    }

    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
      }

      for (let i = 0; i < a.length; i++) {
        if (!areEqual(a[i], b[i])) {
          return false;
        }
      }

      return true;
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }

    aKeys.sort();
    bKeys.sort();
    for (let i = 0; i < aKeys.length; i++) {
      const key = aKeys[i];
      if (key !== bKeys[i]) {
        return false;
      }

      if (!areEqual((a as SettingsContainer)[key], (b as SettingsContainer)[key])) {
        return false;
      }
    }

    return true;
  }
}

/**
 * The name of a [[Setting]].
 * Setting names must be [valid JavaScript property names](https://developer.mozilla.org/en-US/docs/Glossary/property/JavaScript) containing no spaces or periods.
 * The name of a setting begins with the schema prefix of the [[SettingGroupSchema]] in which its [[SettingSchema]] is defined.
 * A setting name therefore forms a path like file names in a file system.
 * For example, the following are setting names defined in the `energyAnalysis`, `iot-scan-visualization`, and `vibration-map` schemas.
 *
 * ```ts
 * "energyAnalysis/formats/totalWork"
 * "energyAnalysis/formats/totalHours"
 * "energyAnalysis/units/power"
 * "energyAnalysis/units/temperature"
 * "energyAnalysis/startupMode"
 * "iot-scan-visualization/ports/cameras"
 * "vibration-map/filters/scope"
 * "vibration-map/filters/prefabricated"
 * ```
 *
 * @beta
 */
export type SettingName = string;

/** An object that defines the values for any number of [[Setting]]s. Each of its properties' names must conform to the semantics of a [[SettingName]].
 * @beta
 */
export interface SettingsContainer {
  /** Accesses settings by their names. */
  [name: SettingName]: Setting | undefined;
}

/** Defines the precedence of a [[SettingsDictionary]].
 * [[Settings]] may contain multiple dictionaries containing different values for the same [[SettingName]].
 * When resolving the value of a [[Setting]], the value from the highest-priority dictionary is used.
 * Priorities are grouped into coarse categories like [[SettingsPriority.application]] and [[SettingsPriority.iModel]].
 * Settings with priorities less than or equal to [[SettingsPriority.application]] are stored in [[IModelHost.appWorkspace]], while
 * those with priorities higher than [[SettingsPriority.application]] are stored inside [[IModelDb.workspace]].
 * @beta
 */
export type SettingsPriority = number;

/** @beta */
export namespace SettingsPriority { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Settings that originate from default setting files loaded automatically at the start of a session. */
  export const defaults = 100;
  /** Settings supplied by an application at runtime. */
  export const application = 200;
  /** Settings that apply to all iTwins for an organization. */
  export const organization = 300;
  /** Settings that apply to all iModels in an iTwin. */
  export const iTwin = 400;
  /** Settings that apply to all branches of an iModel. */
  export const branch = 500;
  /** Settings that apply to a specific iModel. */
  export const iModel = 600;
}

/** A named container that supplies values for [[Setting]]s.
 * @see [[Settings.addDictionary]] to register a new settings dictionary.
 * @beta
 */
export interface SettingsDictionary {
  /** @internal */
  [_implementationProhibited]: unknown;

  /** Metadata describing the dictionary. */
  readonly props: SettingsDictionaryProps;

  /** Obtain a copy of the value of the setting named `settingName` stored in this dictionary, or `undefined` if no such setting exists.
   * The returned value is always cloned using [[Setting.clone]].
   * @note Generally, applications use methods like [[Settings.getString]] and [[Setting.getArray]] to resolve a setting value from multiple
   * dictionaries. Those methods - unlike this one - also validate that `settingName` is of type `T` as defined by its [[SettingSchema]].
   */
  getSetting<T extends Setting>(settingName: SettingName): T | undefined;
}

/** Uniquely identifies a [[SettingsDictionary]].
 * @beta
 */
export interface SettingsDictionarySource {
  /** The name of the dictionary, which must be unique within its [[workspaceDb]], or - if [[workspaceDb]] is undefined - unique among all dictionaries not associated with any [[WorkspaceDb]]. */
  readonly name: string;
  /** The [[WorkspaceDb]] from which the dictionary originated. */
  readonly workspaceDb?: WorkspaceDb;
}

/** Properties of a [[SettingsDictionary]], defining its name, the [[WorkspaceDb]] (if any) from which it originated, and its [[priority]] relative to other dictionaries.
 * @beta
 */
export interface SettingsDictionaryProps extends SettingsDictionarySource {
  /** Precedence value determining which setting value to use when multiple dictionaries supply values for the same [[SettingName]]. */
  readonly priority: SettingsPriority;
}

/**
 * The collection of [[Setting]]s that supply the run-time configuration of a [[Workspace]].
 * The `Settings` object comprises a collection of named [[SettingsDictionary]] objects.
 * Methods like [[getSetting]], [[getString]], and [[getArray]] provide access to the value of an individual [[Setting]] by searching
 * the [[dictionaries]] in order by their [[SettingsPriority]] to find the highest-priority setting with the requested [[SettingName]].
 * Most methods that retrieve [[Setting]] values validate them against their [[SettingSchema]]s to ensure that they are of the correct type.
 * A [[SettingsDictionary]] can be added or removed using [[addDictionary]] and [[dropDictionary]].
 * Because [[Setting]]s can change at any time during the session, you should avoid caching their values wherever possible.
 * If you must cache them (for example, to display in a user interface), you should listen for the [[onSettingsChanged]] event to be
 * notified of potential changes.
 *
 * Settings are accessed via [[Workspace.settings]]. They are defined at the application level by [[IModelHost.appWorkspace]], but individual iModels may supply
 * additional iModel-specific settings or overrides for application-level settings. When working in the context of a specific iModel, use [[IModelDb.workspace]]'s `settings`
 * property. Any settings not overridden by the iModel will fall back to the settings defined in [[IModelHost.appWorkspace]].
 *
 * Application settings are loaded into [[IModelHost.appWorkspace]] when the session begins (i.e., when [[IModelHost.startup]] is invoked), and unloaded when it ends (in [[IModelHost.shutdown]]).
 * They are read from [JSON5](https://json5.org/) files delivered with the application. The application should register any additional [[SettingsDictionary]]'s '(and their corresponding
 * [[SettingGroupSchema]]s) at this time.
 *
 * iModel-specific settings are stored in the iModel's property table and loaded into [[IModelDb.workspace]] when the iModel is first opened.
 * You can add and remove a [[SettingsDictionary]] from the property table using [[IModelDb.saveSettingDictionary]] and [[IModelDb.deleteSettingDictionary]].
 *
 * See the [learning article]($docs/learning/backend/Workspace) for a detailed overiew and examples.
 *
 * @see [[IModelHost.appWorkspace]] application-wide settings, and [[IModelDb.workspace]] for settings specific to a given iModel.
 * @beta
 */
export interface Settings {
  /** @internal */
  [_implementationProhibited]: unknown;

  /** @internal */
  close(): void;

  /** The set of settings dictionaries from which [[Setting]] values are obtained, sorted by [[SettingsPriority]].
   * The set can contain at most one dictionary for each unique combination of name and [[WorkspaceDb]].
   * @see [[addDictionary]], [[addFile]], [[addJson]], and [[addDirectory]] to add a new dictionary.
   * @see [[dropDictionary]] to remove a dictionary.
   * @see [[getDictionary]] to look up a dictionary.
   */
  readonly dictionaries: readonly SettingsDictionary[];

  /** Event raised whenever a [[SettingsDictionary]] is added or removed. */
  readonly onSettingsChanged: BeEvent<() => void>;

  /** Parses the contents of a local [JSON5](https://json5.org/) file as a [[SettingsContainer]] and invokes [[addDictionary]] to
   * add a [[SettingsDictionary]] named `fileName` with the specified priority.
   * @param fileName the name of a local settings file containing the dictionary.
   * @param priority the priority for the dictionary.
   */
  addFile(fileName: LocalFileName, priority: SettingsPriority): void;

  /** Invokes [[addFile]] for all files in `directory` with the extension ".json" or ".json5". */
  addDirectory(directory: LocalDirName, priority: SettingsPriority): void;

  /** Parses `settingsJson` as a [[SettingsContainer]] and invokes [[addDictionary]] to add a [[SettingsDictionary]] with the specified `props`.
   * This is typically used when reading dictionaries out of a [[WorkspaceDb]], where they are stored as stringified JSON.
   */
  addJson(props: SettingsDictionaryProps, settingsJson: string): void;

  /** Find a [[SettingsDictionary]] with the same name and [[WorkspaceDb]] as `source`. */
  getDictionary(source: SettingsDictionarySource): SettingsDictionary | undefined;

  /** Add a new [[SettingsDictionary]] with the priority, name, and [[WorkspaceDb]] specified by `props` and setting values supplied by `settings`.
   * @note If a dictionary with the same name and [[WorkspaceDb]] already exists, it will be replaced.
   * @see [[addFile]], [[addJson]], and [[addDirectory]] for convenient ways to add dictionaries from various sources.
   */
  addDictionary(props: SettingsDictionaryProps, settings: SettingsContainer): void;

  /** Removes a previously-added [[SettingsDictionary]]. */
  dropDictionary(props: SettingsDictionarySource): void;

  /** Looks up the highest priority setting value for a SettingName, falling back to a default value if no value for the setting is found.
   * The [[dictionaries]] are searched in order by [[SettingsPriority]]; the first one that provides a value for `settingName` wins.
   * @param settingName The name of the setting.
   * @param defaultValue value returned if settingName is not present in any [[SettingsDictionary]].
   * @note This method is generic on [[Setting]] type, but no type checking is actually performed at run time. So, if you
   * use this method to get a setting with an expected type, but its value is a different type, the return type of this method will be wrong.
   * You must always type check the result. Use the non-generic "get" methods like [[getString]] and [[getArray]] if you only want the value
   * if its type is correct.
   * @note Unlike [[getArray]], this method does not combine arrays - it ignores [[SettingsSchema.combineArrays]].
   */
  getSetting<T extends Setting>(settingName: SettingName, defaultValue?: T): T | undefined;

  /** Obtain an iterator over all of the values in the [[dictionaries]] for the [[Setting]] identified by `settingName`, ordered by [[SettingsPriority]]. */
  getSettingEntries<T extends Setting>(settingName: SettingName): Iterable<{ value: T, dictionary: SettingsDictionary}>;

  /** Obtain an iterator over all of the values in the [[dictionaries]] for the [[Setting]] identified by `settingName`, ordered by [[SettingsPriority]]. */
  getSettingValues<T extends Setting>(settingName: SettingName): Iterable<T>;

  /** Look up the value of a string [[Setting]] named `settingName`, returning `defaultValue` if no such value is defined.
   * @throws Error if the setting exists but is not a string.
   */
  getString(settingName: SettingName, defaultValue: string): string;
  getString(settingName: SettingName, defaultValue?: string): string | undefined;

  /** Look up the value of a boolean [[Setting]] named `settingName`, returning `defaultValue` if no such value is defined.
   * @throws Error if the setting exists but is not a boolean.
   */
  getBoolean(settingName: SettingName, defaultValue: boolean): boolean;
  getBoolean(settingName: SettingName, defaultValue?: boolean): boolean | undefined;

  /** Look up the value of a numeric [[Setting]] named `settingName`, returning `defaultValue` if no such value is defined.
   * @throws Error if the setting exists but is not a number.
   */
  getNumber(settingName: SettingName, defaultValue: number): number;
  getNumber(settingName: SettingName): number | undefined;

  /** Look up the value of an object [[Setting]] named `settingName`, returning `defaultValue` if no such value is defined.
   * @throws Error if the setting exists but is not an object.
   */
  getObject<T extends object>(settingName: SettingName, defaultValue: T): T;
  getObject<T extends object>(settingName: SettingName): T | undefined;

  /** Look up the value of an array [[Setting]] named `settingName`, returning `defaultValue` if no such value is defined.
   * @throws Error if the setting exists but is not an array.
   */
  getArray<T extends Setting>(settingName: SettingName, defaultValue: Array<T>): Array<T>;
  getArray<T extends Setting>(settingName: SettingName): Array<T> | undefined;
}
