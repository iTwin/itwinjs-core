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
import { BeEvent, JSONSchema, JSONSchemaType, JSONSchemaTypeName, Mutable } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelJsFs } from "../IModelJsFs";

/**
 * The properties of a single Setting, used by the settings editor. This interface also includes the
 * default value if it is not specified in any Settings file.
 * This interface includes all members of [JSONSchema]($bentley) with the extensions added by VSCode.
 * @note the `type` member is marked optional in JSONSchema but is required for Settings.
 * @beta
 */
export interface SettingSchema extends Readonly<JSONSchema> {
  readonly items?: SettingSchema; // must be single object, not array
  readonly type: JSONSchemaTypeName; // type is required for settings
  readonly properties?: { [name: string]: SettingSchema };

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

  /** @internal */
  public static validateArrayObject<T>(val: T, schemaName: string, msg: string): T {
    const schema = this.allSchemas.get(schemaName);
    const items = schema?.items;
    if (undefined === items)
      return val;
    const required = items.required;
    const properties = items.properties;
    if (undefined === required || undefined === properties)
      return val;

    for (const entry of required) {
      const entryType = properties[entry].type;
      const value = (val as any)[entry];
      if (entryType === "array" && Array.isArray(value))
        continue;
      if (typeof value !== entryType)
        throw new Error(`invalid "${schemaName}" setting entry for "${msg}": ${entry} is ${value}`);
    }
    return val;
  }

  /**
   * Add one or more [[SettingSchemaGroup]]s. `SettingSchemaGroup`s must include a `groupName` member that is used
   * to identify the group. If a group with the same name is already registered, the old values are first removed and then the new group is added.
   */
  public static addGroup(settingsGroup: SettingSchemaGroup | SettingSchemaGroup[]): void {
    if (!Array.isArray(settingsGroup))
      settingsGroup = [settingsGroup];

    this.doAdd(settingsGroup);
    this.onSchemaChanged.raiseEvent();
  }

  /** Add a [[SettingSchemaGroup]] from stringified json5. */
  public static addJson(settingSchema: string): void {
    this.addGroup(parse(settingSchema));
  }

  /** Add a [[SettingSchemaGroup]] from a json5 file. */
  public static addFile(fileName: LocalFileName): void {
    try {
      this.addJson(fs.readFileSync(fileName, "utf-8"));
    } catch (e: any) {
      throw new Error(`parsing SettingSchema file "${fileName}": ${e.message}"`);
    }
  }

  /** Add all files with a either ".json" or ".json5" extension from a supplied directory. */
  public static addDirectory(dirName: LocalDirName) {
    for (const fileName of IModelJsFs.readdirSync(dirName)) {
      const ext = extname(fileName);
      if (ext === ".json5" || ext === ".json")
        this.addFile(join(dirName, fileName));
    }
  }

  /** Remove a previously added [[SettingSchemaGroup]] by groupName */
  public static removeGroup(groupName: string): void {
    this.doRemove(groupName);
    this.onSchemaChanged.raiseEvent();
  }

  private static doAdd(settingsGroup: SettingSchemaGroup[]) {
    settingsGroup.forEach((group) => {
      if (undefined === group.groupName)
        throw new Error(`settings group has no "groupName" member`);

      this.doRemove(group.groupName);
      this.validateAndAdd(group);
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

  private static validateName(name: string) {
    if (!name.trim())
      throw new Error(`empty property name`);
    if (this.allSchemas.has(name))
      throw new Error(`property "${name}" is already defined`);
  }

  private static validateProperty(name: string, property: SettingSchema | undefined) {
    if (!property)
      throw new Error(`missing required property ${name}`);

    if (!property.type)
      throw new Error(`property ${name} has no type`);

    switch (property.type) {
      case "boolean":
      case "integer":
      case "null":
      case "number":
      case "string":
        return;

      case "object":
        const required = property.required;
        const props = property.properties;
        if (required && props) {
          for (const entry of required)
            this.validateProperty(entry, props[entry]);
        }
        if (props) {
          for (const key of Object.keys(props))
            try {
              this.validateProperty(key, props[key]);
            } catch (e: any) {
              throw new Error(`property ${key} of ${name}: ${e.message}`);
            }
        }
        return;

      case "array":
        if (typeof property.items !== "object")
          throw new Error(`array property ${name} has no items member`);
        try {
          this.validateProperty("items", property.items);
        } catch (e: any) {
          throw new Error(`array property ${name}: ${e.message}`);
        }
        return;

      default:
        throw new Error(`property ${name} has illegal type "${property.type}"`);
    }
  }

  private static validateAndAdd(group: SettingSchemaGroup) {
    const properties = group.properties;
    if (undefined === properties)
      throw new Error(`group ${group.groupName} has no properties`);

    for (const key of Object.keys(properties)) {
      this.validateName(key);
      this.validateProperty(key, properties[key]);
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
