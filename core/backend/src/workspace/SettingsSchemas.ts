/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { BeEvent, JSONSchema, JSONSchemaTypeName } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { implementationProhibited } from "../internal/ImplementationProhibited"; 
import { SettingName } from "./Settings";

 /** Metadata describing a single [[Setting]] as part of a [[SettingSchemaGroup]].
  * Every setting has a [[type]], which can be one of the following:
  * - A primitive type like `string` or `number`;
  * - An object containing any number of named properties, each with their own types; or
  * - An array of elements, all of the same type.
  * This metadata is used to validate setting values against the schema, and to enable user interfaces by which
  * users can view and modify their settings.
  * @beta
  */
export interface SettingSchema extends Readonly<JSONSchema> {
  /** For arrays only, the metadata describing every element in the array. */
  readonly items?: SettingSchema;
  /** The name of the [[Setting]]'s data type. */
  readonly type: JSONSchemaTypeName;
  /** For objects and arrays only, the name of a [[SettingSchema]] that provides a base definition for this type.
   * The name is expected to refer to a type definition registered with [[SettingsSchema.typeDefs]].
   * Therefore, it must be the full name, including the [[SettingSchemaGroup.schemaPrefix]].
   */
  readonly extends?: string;
  /** For objects only, the name and metadata of each of the object's properties. */
  readonly properties?: { [name: SettingName]: SettingSchema };
  /** For arrays only, specifies how [[SettingsDictionary.getArray]] resolves the value of the setting.
   * By default, like other types of settings, the setting uses the value of the setting from the highest-priority dictionary.
   * If `combineArray` is `true`, then the value of the setting is computed by combining the elements of every array from every dictionary,
   * ordered by priority and eliminating duplicate elements.
   * Two elements are considered duplicates of one another if [[Setting.areEqual]] returns `true`.
   */
  readonly combineArray?: boolean;
}

 /** Metadata describing a group of related [[SettingSchema]]s. You can register setting schema groups via [[SettingsSchemas.addGroup]] and
  * remove them via [[SettingsSchemas.removeGroup]].
  *
  * All of the settings share the same [[schemaPrefix]], which must be unique amongst all other groups.
  * The prefix is combined with the name of each [[SettingSchema]] in the group to form the fully-qualified name used to refer
  * to the setting outside of the group, e.g., when accessing [[SettingsSchemas.settingDefs]] or in [[SettingSchema.extends]].
  * In the following example, the fully-qualified name of the setting named "metric" is "format/units/metric".
  * ###TODO example snippet
  *
  * ```json
  *  {
  *    "schemaPrefix": "format/units",
  *    "settingDefs": {
  *      "metric": { "type": "boolean" }
  *    }
  *  }
  * ```
  *
  * A group can also define [[SettingSchema]]s that, rather than describing actual [[Setting]]s, instead describe types that can be extended by [[Setting]]s via
  * [[SettingSchema.extends]]. A [[SettingSchema]] can refer to type definitions defined in its own group or any other group.
  * ###TODO example code snippet for myApp/categories
  * @beta
  */
export interface SettingSchemaGroup {
  /** Uniquely identifies this group amongst all other groups.
   * The prefix can use forward-slashes to define logical subgroups - for example, two related groups with the prefixes "units/metric" and "units/imperial".
   * The user interface may parse these prefixes to display both groups under a "units" tab or expandable tree view node.
   *
   * @note Schema prefixes beginning with "iTwin" are reserved for use by iTwin.js.
   */
  readonly schemaPrefix: string;
  /** Metadata for each [[Setting]] in this group. */
  readonly settingDefs?: { [name: string]: SettingSchema | undefined };
  /** Metadata for types that can be extended by other [[Setting]]s via [[SettingSchema.extends]]. */
  readonly typeDefs?: { [name: string]: SettingSchema | undefined };
  /** ###TODO not in Base.Schema.json. UI ordering, lower values before higher values? */
  readonly order?: number;
  /** A description of this group suitable for displaying to a user.
   * ###TODO required in Base.Schema.json, optional here - which is it?
   */
  readonly description?: string;
}

/**
 * The registry of available [[SettingSchemaGroup]]s.
 * The registry is used for editing Settings files and for finding default values for settings.
 * @beta
 */

 /** The registry of metadata describing groups of [[SettingSchema]]s available to the current session.
  * ###TODO how schemas are populated at startup and should be populated/customized by apps
  * @see [[IModelHost.settingsSchemas]] to access the registry for the current session.
  * @beta
  */
export interface SettingsSchemas {
  /** Prevents people from implementing this interface @internal */
  readonly [implementationProhibited]: unknown;

  readonly settingDefs: Map<string, SettingSchema>;
  readonly typeDefs: Map<string, SettingSchema>;
  readonly onSchemaChanged: BeEvent<() => void>;

  validateSetting<T>(value: T, settingName: string): T;
  addGroup(settingsGroup: SettingSchemaGroup | SettingSchemaGroup[]): void;
  addJson(settingSchema: string): void;
  addFile(fileName: LocalFileName): void;
  addDirectory(dirName: LocalDirName): void;
  removeGroup(schemaPrefix: string): void;
}
