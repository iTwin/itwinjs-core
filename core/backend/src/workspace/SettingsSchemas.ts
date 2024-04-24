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
  /** entries for an array. Must be single object, not array */
  readonly items?: SettingSchema;
  /** type is required for settings */
  readonly type: JSONSchemaTypeName;
  /** name of typeDef for objects or arrays to inherit */
  readonly extends?: string;
  /** for objects, a list of named properties and their definitions */
  readonly properties?: { [name: string]: SettingSchema };

  /** whether the setting replaces lower priority entries with the same name or combines with them. */
  readonly cumulative?: true;
}

/**
 * The properties of a group of [[SettingSchema]]s for an application. Groups can be added and removed from [[SettingsSchemas]]
 * and are identified by their (required) `schemaPrefix` member
 * @beta
 */
export interface SettingSchemaGroup {
  readonly schemaPrefix: string;
  readonly settingDefs: { [name: string]: SettingSchema };
  readonly typeDefs?: { [name: string]: SettingSchema };
  readonly order?: number;
  readonly description?: string;
}

const makeSettingKey = (group: string, key: string) => `${group}/${key}`;
/**
 * The registry of available [[SettingSchemaGroup]]s.
 * The registry is used for editing Settings files and for finding default values for settings.
 * @beta
 */
export class SettingsSchemas {
  private constructor() { } // singleton
  private static readonly _allGroups = new Map<string, SettingSchemaGroup>();
  /** a map of all registered Setting Definitions  */
  public static readonly settingDefs = new Map<string, SettingSchema>();
  /** a map of all registered TypeDefs  */
  public static readonly typeDefs = new Map<string, SettingSchema>();
  /** event that signals that the values in [[allSchemas]] have changed in some way. */
  public static readonly onSchemaChanged = new BeEvent<() => void>();

  /** @internal */
  public static getArrayItems(propDef: Readonly<SettingSchema>, scope: string): SettingSchema {
    let items = propDef.items;
    if (undefined === items && propDef.extends) {
      const typeDef = this.typeDefs.get(propDef.extends);
      if (undefined === typeDef)
        throw new Error(`typeDef ${propDef.extends} does not exist for ${scope}`);
      items = typeDef.items;
    }
    if (undefined === items)
      throw new Error(`array ${scope} has no items definition`);
    return items;
  }

  private static validateProperty<T>(val: T, propDef: Readonly<SettingSchema>, path: string) {
    switch (propDef.type) {
      case "boolean":
      case "number":
      case "string":
      case "integer":
      case "null":
        return this.verifyType(val, propDef.type, path);

      case "array":
        if (!Array.isArray(val))
          throw new Error(`Property ${path} must be an array`);
        const items = this.getArrayItems(propDef, path);
        for (let i = 0; i < val.length; ++i)
          this.validateProperty(val[i], items, `${path}[${i}]`);
        return;
    }
    if (!val || typeof val !== "object")
      throw new Error(`${path} must be an object`);

    const { required, properties } = this.getObjectProperties(propDef, path);

    // first ensure all required properties are present
    if (undefined !== required) {
      for (const entry of required) {
        const value = (val as any)[entry];
        if (undefined === value)
          throw new Error(`required value for "${entry}" is missing in "${path}"`);
      }
    }

    // you can supply default values in typeDefs. See if any members are undefined that have a default.
    if (undefined !== properties) {
      for (const [key, prop] of Object.entries(properties)) {
        if ((val as any)[key] === undefined && prop.default)
          (val as any)[key] = prop.default;
      }
    }

    // then validate all values in the supplied object are valid
    for (const key of Object.keys(val)) {
      const prop = properties[key];
      if (prop !== undefined) { // note: extra values are ignored.
        this.validateProperty((val as any)[key], prop, `${path}.${key}`);
      }
    }
  }

  /**
   * Add one or more [[SettingSchemaGroup]]s. `SettingSchemaGroup`s must include a `schemaPrefix` member that is used
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

  /** Remove a previously added [[SettingSchemaGroup]] by schemaPrefix */
  public static removeGroup(schemaPrefix: string): void {
    this.doRemove(schemaPrefix);
    this.onSchemaChanged.raiseEvent();
  }

  private static doAdd(settingsGroup: SettingSchemaGroup[]) {
    settingsGroup.forEach((group) => {
      if (undefined === group.schemaPrefix)
        throw new Error(`settings group has no "schemaPrefix" member`);

      this.doRemove(group.schemaPrefix);
      this.validateAndAdd(group);
      this._allGroups.set(group.schemaPrefix, group);
    });
  }

  private static doRemove(schemaPrefix: string) {
    const group = this._allGroups.get(schemaPrefix);
    if (undefined !== group?.settingDefs) {
      for (const key of Object.keys(group.settingDefs))
        this.settingDefs.delete(makeSettingKey(schemaPrefix, key));
    }
    if (undefined !== group?.typeDefs) {
      for (const key of Object.keys(group.typeDefs))
        this.settingDefs.delete(makeSettingKey(schemaPrefix, key));
    }
    this._allGroups.delete(schemaPrefix);
  }

  private static validateName(name: string) {
    if (!name.trim())
      throw new Error(`empty property name`);
  }

  private static verifyPropertyDef(name: string, property: SettingSchema | undefined) {
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
          for (const entry of required) {
            if (undefined === props[entry])
              throw new Error(`missing required property of ${name}: "${entry}"`);
          }
        }
        if (props) {
          for (const key of Object.keys(props))
            try {
              this.verifyPropertyDef(key, props[key]);
            } catch (e: any) {
              throw new Error(`property ${key} of ${name}: ${e.message}`);
            }
        }
        return;

      case "array":
        if (typeof property.items !== "object")
          throw new Error(`array property ${name} has no items member`);
        try {
          this.verifyPropertyDef("items", property.items);
        } catch (e: any) {
          throw new Error(`array property ${name}: ${e.message}`);
        }
        return;

      default:
        throw new Error(`property ${name} has illegal type "${property.type}"`);
    }
  }

  private static validateAndAdd(group: SettingSchemaGroup) {
    let properties = group.settingDefs;
    if (undefined !== properties) {
      for (const key of Object.keys(properties)) {
        this.validateName(key);
        this.verifyPropertyDef(key, properties[key]);
        const property: Mutable<SettingSchema> = properties[key];
        property.default = property.default ?? this.getDefaultValue(property.type);
        this.settingDefs.set(makeSettingKey(group.schemaPrefix, key), property);
      }
    }
    properties = group.typeDefs ?? {};
    for (const key of Object.keys(properties)) {
      this.validateName(key);
      this.verifyPropertyDef(key, properties[key]);
      this.typeDefs.set(makeSettingKey(group.schemaPrefix, key), properties[key]);
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
