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
import { assert, BeEvent, JSONSchemaType, JSONSchemaTypeName, Mutable } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelJsFs } from "../../IModelJsFs";
import { SettingGroupSchema, SettingSchema, SettingsSchemas } from "../../workspace/SettingsSchemas";
import { _implementationProhibited } from "../Symbols";

const makeSettingKey = (prefix: string, key: string) => `${prefix}/${key}`;

class SettingsSchemasImpl implements SettingsSchemas {
  public readonly [_implementationProhibited] = undefined;
  private readonly _allGroups = new Map<string, SettingGroupSchema>();
  /** a map of all registered Setting Definitions  */
  public readonly settingDefs = new Map<string, SettingSchema>();
  /** a map of all registered TypeDefs  */
  public readonly typeDefs = new Map<string, SettingSchema>();
  /** event that signals that the values in [[allSchemas]] have changed in some way. */
  public readonly onSchemaChanged = new BeEvent<() => void>();

  private verifyType<T>(val: T, expectedType: JSONSchemaTypeName, path: string) {
    if (expectedType === "integer") {
      if (Number.isInteger(val))
        return;
    } else if (expectedType === "null") {
      if (val === null || val === undefined)
        return;
    } else if (typeof val === expectedType)
      return;

    throw new Error(`value for ${path}: "${val}" is wrong type, expected ${expectedType}`);
  }

  public validateSetting<T>(value: T, settingName: string): T {
    const settingDef = this.settingDefs.get(settingName);
    if (undefined !== settingDef) // if there's no setting definition, there's no rules so just return ok
      this.validateProperty(value, settingDef, settingName);
    return value;
  }

  /** @internal */
  public getObjectProperties(propDef: Readonly<SettingSchema>, scope: string): { required?: string[], properties: { [name: string]: SettingSchema } } {
    let required = propDef.required;
    let properties = propDef.properties;

    // if this object extends a typeDef, add typeDef's properties and required values, recursively
    if (propDef.extends !== undefined) {
      const typeDef = this.typeDefs.get(propDef.extends);
      if (undefined === typeDef)
        throw new Error(`typeDef ${propDef.extends} does not exist for ${scope}`);
      const expanded = this.getObjectProperties(typeDef, `${scope}.${propDef.extends}`);
      if (expanded.required)
        required = required ? [...required, ...expanded.required] : expanded.required;
      if (expanded.properties) {
        properties = properties ? { ...expanded.properties, ...properties } : expanded.properties;
      }
    }
    properties = properties ?? {};
    return { required, properties };
  }

  /** @internal */
  public getArrayItems(propDef: Readonly<SettingSchema>, scope: string): SettingSchema {
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

  private validateProperty<T>(val: T, propDef: Readonly<SettingSchema>, path: string) {
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
  public addGroup(settingsGroup: SettingGroupSchema | SettingGroupSchema[]): void {
    if (!Array.isArray(settingsGroup))
      settingsGroup = [settingsGroup];

    this.doAdd(settingsGroup);
    this.onSchemaChanged.raiseEvent();
  }

  /** Add a [[SettingSchemaGroup]] from stringified json5. */
  public addJson(settingSchema: string): void {
    this.addGroup(parse(settingSchema));
  }

  /** Add a [[SettingSchemaGroup]] from a json5 file. */
  public addFile(fileName: LocalFileName): void {
    try {
      this.addJson(fs.readFileSync(fileName, "utf-8"));
    } catch (e: any) {
      throw new Error(`parsing SettingSchema file "${fileName}": ${e.message}"`);
    }
  }

  /** Add all files with a either ".json" or ".json5" extension from a supplied directory. */
  public addDirectory(dirName: LocalDirName) {
    for (const fileName of IModelJsFs.readdirSync(dirName)) {
      const ext = extname(fileName);
      if (ext === ".json5" || ext === ".json")
        this.addFile(join(dirName, fileName));
    }
  }

  /** Remove a previously added [[SettingSchemaGroup]] by schemaPrefix */
  public removeGroup(schemaPrefix: string): void {
    this.doRemove(schemaPrefix);
    this.onSchemaChanged.raiseEvent();
  }

  private doAdd(settingsGroup: SettingGroupSchema[]) {
    settingsGroup.forEach((group) => {
      if (undefined === group.schemaPrefix)
        throw new Error(`settings group has no "schemaPrefix" member`);

      this.doRemove(group.schemaPrefix);
      this.validateAndAdd(group);
      this._allGroups.set(group.schemaPrefix, group);
    });
  }

  private doRemove(schemaPrefix: string) {
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

  private validateName(name: string) {
    if (!name.trim())
      throw new Error(`empty property name`);
  }

  private verifyPropertyDef(name: string, property: SettingSchema | undefined) {
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
        if (typeof property.extends === "string")
          return;
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

  private validateAndAdd(group: SettingGroupSchema) {
    const settingDefs = group.settingDefs;
    if (undefined !== settingDefs) {
      for (const key of Object.keys(settingDefs)) {
        this.validateName(key);
        this.verifyPropertyDef(key, settingDefs[key]);
        const property: Mutable<SettingSchema> | undefined = settingDefs[key];
        assert(undefined !== property);
        property.default = property.default ?? this.getDefaultValue(property.type);
        this.settingDefs.set(makeSettingKey(group.schemaPrefix, key), property);
      }
    }
    const typeDefs = group.typeDefs ?? {};
    for (const key of Object.keys(typeDefs)) {
      this.validateName(key);
      this.verifyPropertyDef(key, typeDefs[key]);
      const typeDef = typeDefs[key];
      assert(undefined !== typeDef);
      this.typeDefs.set(makeSettingKey(group.schemaPrefix, key), typeDef);
    }
  }

  private getDefaultValue(type: JSONSchemaTypeName | JSONSchemaTypeName[]): JSONSchemaType | undefined {
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

export function constructSettingsSchemas(): SettingsSchemas {
  return new SettingsSchemasImpl();
}
