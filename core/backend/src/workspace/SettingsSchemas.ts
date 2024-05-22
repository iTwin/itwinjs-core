/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { BeEvent, JSONSchema, JSONSchemaTypeName } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { SettingsSchemaSymbol } from "../internal/workspace/SettingsSchemasImpl";

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
  readonly settingDefs?: { [name: string]: SettingSchema | undefined };
  readonly typeDefs?: { [name: string]: SettingSchema | undefined };
  readonly order?: number;
  readonly description?: string;
}

/**
 * The registry of available [[SettingSchemaGroup]]s.
 * The registry is used for editing Settings files and for finding default values for settings.
 * @beta
 */
export interface SettingsSchemas {
  /** @internal */
  readonly [SettingsSchemaSymbol]: unknown;
  readonly settingDefs: Map<string, SettingSchema>;
  readonly typeDefs: Map<string, SettingSchema>;
  readonly onSchemaChanged: BeEvent<() => void>;

  validateSetting<T>(value: T, settingName: string): T;
  // getObjectProperties(propDef: Readonly<SettingSchema>, scope: string): { required?: string[], properties: { [name: string]: SettingSchema } };
  // getArrayItems(propDef: Readonly<SettingSchema>, scope: string): SettingSchema;
  addGroup(settingsGroup: SettingSchemaGroup | SettingSchemaGroup[]): void;
  addJson(settingSchema: string): void;
  addFile(fileName: LocalFileName): void;
  addDirectory(dirName: LocalDirName): void;
  removeGroup(schemaPrefix: string): void;
}
