/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import * as fs from "fs-extra";
import { parse } from "json5";
import { BeEvent, JSONSchema, JSONSchemaType, JSONSchemaTypeName, Mutable } from "@itwin/core-bentley";

/**
 * The properties of a Setting, used by the settings editor. This interface also includes the
 * default value if it is not specified in any Settings file.
 * This interface includes all members of [JSONSchema]($bentley) with the extensions added by VSCode.
 * @beta
 */
export interface SettingSpec extends Readonly<JSONSchema> {
  type: JSONSchemaTypeName | JSONSchemaTypeName[];
  /** labels for items of an enum. */
  readonly enumItemLabels?: string[];
  /** whether the editor should show multiple lines. */
  readonly multilineEdit?: true;
}

/**
 * The properties of a group of [[SettingSpec]]s for an application. Groups can be added and removed from the registry
 * and are identified by their (required) `groupName` member
 * @beta
 */
export interface SettingsGroupSpec {
  readonly groupName: string;
  readonly properties: { [name: string]: SettingSpec };
  readonly order?: number;
  readonly title?: string;
  readonly description?: string;
  readonly extensionId?: string;
}

/**
 * The registry of available [[SettingsGroupSpec]]s.
 * The registry is used for editing Settings files and for finding default values for settings.
 * @beta
 */
export class SettingsSpecRegistry {
  private constructor() { } // singleton
  private static readonly _allGroups = new Map<string, SettingsGroupSpec>();
  /** a map of all registered [[SettingSpec]]s */
  public static readonly allSpecs = new Map<string, SettingSpec>();
  /** event that signals that the values in [[allSpecs]] have changed in some way. */
  public static readonly onSpecsChanged = new BeEvent<() => void>();

  /** Clear the contents of the registry and remove all event listeners.
   * @note This is really only necessary for tests of the Settings system.
   * @internal
   */
  public static reset() {
    this._allGroups.clear();
    this.allSpecs.clear();
    this.onSpecsChanged.clear();
  }

  /**
   * Add one or more [[SettingsGroupSpec]]s to the registry. `SettingsGroupSpec`s must include a `groupName` member that is used
   * to identify the group. If a group with the same name is already registered, the old values are first removed and then the new group is added.
   * @returns an array of problems found adding properties of the supplied group(s).
   */
  public static addGroup(settingsGroup: SettingsGroupSpec | SettingsGroupSpec[]): string[] {
    if (!Array.isArray(settingsGroup))
      settingsGroup = [settingsGroup];

    const problems: string[] = [];
    this.doAdd(settingsGroup, problems);
    this.onSpecsChanged.raiseEvent();
    return problems;
  }

  /** Add a [[SettingsGroupSpec]] from stringified json5. */
  public static addJson(settingSpecJson: string): string[] {
    return this.addGroup(parse(settingSpecJson));
  }

  /** Add a [[SettingsGroupSpec]] from a json5 file. */
  public static addFile(fileName: string): string[] {
    return this.addJson(fs.readFileSync(fileName, "utf-8"));
  }

  /** Remove a previously added [[SettingsGroupSpec]] by groupName */
  public static removeGroup(groupName: string): void {
    this.doRemove(groupName);
    this.onSpecsChanged.raiseEvent();
  }

  private static doAdd(settingsGroup: SettingsGroupSpec[], problems?: string[]) {
    settingsGroup.forEach((group) => {
      if (undefined === group.groupName)
        throw new Error("settings group has no name");

      this.doRemove(group.groupName);
      this.validateAndAdd(group, problems);
      this._allGroups.set(group.groupName, group);
    });
  }

  private static doRemove(groupName: string) {
    const group = this._allGroups.get(groupName);
    if (undefined !== group?.properties) {
      for (const key of Object.keys(group.properties))
        this.allSpecs.delete(key);
    }
    this._allGroups.delete(groupName);
  }

  private static validateProperty(property: string): string | undefined {
    if (!property.trim())
      return "empty property name";
    if (this.allSpecs.has(property))
      return `property "${property}" is already defined`;

    return undefined;
  }

  private static validateAndAdd(group: SettingsGroupSpec, problems?: string[]) {
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

      const property: Mutable<SettingSpec> = properties[key];
      property.default = property.default ?? this.getDefaultValue(property.type);
      this.allSpecs.set(key, property);
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
