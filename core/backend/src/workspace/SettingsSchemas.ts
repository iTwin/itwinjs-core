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
import { BeEvent, JSONSchema, JSONSchemaType, JSONSchemaTypeName, MarkRequired, Mutable } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelJsFs } from "../IModelJsFs";

/**
 * The properties of a single Setting, used by the settings editor. This interface also includes the
 * default value if it is not specified in any Settings file.
 * This interface includes all members of [JSONSchema]($bentley) with the extensions added by VSCode.
 * @note the `type` member is marked optional in JSONSchema but is required for Settings.
 * @beta
 */
export interface SettingSchema extends Readonly<MarkRequired<JSONSchema, "type">> {
  /** labels for items of an enum. */
  readonly enumItemLabels?: string[];
  /** whether the editor should show multiple lines. */
  readonly multilineEdit?: true;
  /** whether the setting replaces lower priority entries with the same name or combines with them. */
  readonly cumulative?: true;
}

/**
 * The properties of a group of [[SettingSchema]]s for an application. Groups can be added and removed from [[SettingsSchemas]]
 * and are identified by their (required) `groupName` member
 * @beta
 */
export interface SettingSchemaGroup {
  readonly groupName: string;
  readonly properties: { [name: string]: SettingSchema };
  readonly order?: number;
  readonly title?: string;
  readonly description?: string;
  readonly extensionId?: string;
}

/**
 * The registry of available [[SettingSchemaGroup]]s.
 * The registry is used for editing Settings files and for finding default values for settings.
 * @beta
 */
export class SettingsSchemas {
  private constructor() { } // singleton
  private static readonly _allGroups = new Map<string, SettingSchemaGroup>();
  /** a map of all registered [[SettingSchema]]s */
  public static readonly allSchemas = new Map<string, SettingSchema>();
  /** event that signals that the values in [[allSchemas]] have changed in some way. */
  public static readonly onSchemaChanged = new BeEvent<() => void>();

  /** Clear the contents of the registry and remove all event listeners.
   * @note This is really only necessary for tests of the Settings system.
   * @internal
   */
  public static reset() {
    this._allGroups.clear();
    this.allSchemas.clear();
    this.onSchemaChanged.clear();
  }

  /**
   * Add one or more [[SettingSchemaGroup]]s to the registry. `SettingSchemaGroup`s must include a `groupName` member that is used
   * to identify the group. If a group with the same name is already registered, the old values are first removed and then the new group is added.
   * @returns an array of problems found adding properties of the supplied group(s).
   */
  public static addGroup(settingsGroup: SettingSchemaGroup | SettingSchemaGroup[]): string[] {
    if (!Array.isArray(settingsGroup))
      settingsGroup = [settingsGroup];

    const problems: string[] = [];
    this.doAdd(settingsGroup, problems);
    this.onSchemaChanged.raiseEvent();
    return problems;
  }

  /** Add a [[SettingSchemaGroup]] from stringified json5. */
  public static addJson(settingSchema: string): string[] {
    return this.addGroup(parse(settingSchema));
  }

  /** Add a [[SettingSchemaGroup]] from a json5 file. */
  public static addFile(fileName: LocalFileName): string[] {
    try {
      return this.addJson(fs.readFileSync(fileName, "utf-8"));
    } catch (e: any) {
      throw new Error(`parsing SettingSchema file "${fileName}": ${e.message}"`);
    }
  }

  /** Add all files with a either ".json" or ".json5" extension from a supplied directory. */
  public static addDirectory(dirName: LocalDirName): string[] {
    const problems: string[] = [];
    for (const fileName of IModelJsFs.readdirSync(dirName)) {
      const ext = extname(fileName);
      if (ext === ".json5" || ext === ".json")
        problems.push(...this.addFile(join(dirName, fileName)));
    }
    return problems;
  }

  /** Remove a previously added [[SettingSchemaGroup]] by groupName */
  public static removeGroup(groupName: string): void {
    this.doRemove(groupName);
    this.onSchemaChanged.raiseEvent();
  }

  private static doAdd(settingsGroup: SettingSchemaGroup[], problems?: string[]) {
    settingsGroup.forEach((group) => {
      if (undefined === group.groupName) {
        problems?.push(`settings group has no "groupName" member`);
        return;
      }

      this.doRemove(group.groupName);
      this.validateAndAdd(group, problems);
      this._allGroups.set(group.groupName, group);
    });
  }

  private static doRemove(groupName: string) {
    const group = this._allGroups.get(groupName);
    if (undefined !== group?.properties) {
      for (const key of Object.keys(group.properties))
        this.allSchemas.delete(key);
    }
    this._allGroups.delete(groupName);
  }

  private static validateProperty(property: string): string | undefined {
    if (!property.trim())
      return "empty property name";
    if (this.allSchemas.has(property))
      return `property "${property}" is already defined`;

    return undefined;
  }

  private static validateAndAdd(group: SettingSchemaGroup, problems?: string[]) {
    const properties = group.properties;
    if (undefined === properties)
      return;

    for (const key of Object.keys(properties)) {
      const problem = this.validateProperty(key);
      if (problem) {
        problems?.push(problem);
        delete properties[key];
        continue;
      }

      const property: Mutable<SettingSchema> = properties[key];
      property.default = property.default ?? this.getDefaultValue(property.type);
      this.allSchemas.set(key, property);
    }
  }

  private static getDefaultValue(type: JSONSchemaTypeName | JSONSchemaTypeName[]): JSONSchemaType | undefined {
    type = Array.isArray(type) ? type[0] : type;
    switch (type) {
      case "boolean":
        return false;
      case "integer":
      case "number":
        return 0;
      case "string":
        return "";
      case "array":
        return [];
      case "object":
        return {};
      default:
        return undefined;
    }
  }
}
