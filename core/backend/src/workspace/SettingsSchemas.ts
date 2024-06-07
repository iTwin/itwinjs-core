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

/** Metadata describing a single [[Setting]] as part of a [[SettingGroupSchema]].
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
   * Therefore, it must be the full name, including the [[SettingGroupSchema.schemaPrefix]].
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
  * @beta
  */
export interface SettingGroupSchema {
  /** Uniquely identifies this group amongst all other groups.
   * The prefix can use forward-slashes to define logical subgroups - for example, two related groups with the prefixes "units/metric" and "units/imperial".
   * The user interface may parse these prefixes to display both groups under a "units" tab or expandable tree view node.
   *
   * @note Schema prefixes beginning with "itwin" are reserved for use by iTwin.js.
   */
  readonly schemaPrefix: string;
  /** Metadata for each [[Setting]] in this group. */
  readonly settingDefs?: { [name: string]: SettingSchema | undefined };
  /** Metadata for types that can be extended by other [[Setting]]s via [[SettingSchema.extends]]. */
  readonly typeDefs?: { [name: string]: SettingSchema | undefined };
  /** An integer used when displaying a list of schemas in a user interface, to sort schemas with a lower `order` before those with a `higher` order. */
  readonly order?: number;
  /** A description of this group suitable for displaying to a user. */
  readonly description: string;
}

/**
 * The registry of available [[SettingGroupSchema]]s.
 * The registry is used for editing Settings files and for finding default values for settings.
 * @beta
 */

/** The registry of metadata describing groups of [[SettingSchema]]s available to the current session.
  * The schemas are used to look up the default values of [[Setting]]s, validate that their values are of the type dictated by the schema, and
  * query metadata like [[SettingsSchema.combineArray]] that modify their behavior.
  * They can also be used to drive a user interface that enables end users to edit [[Settings]].
  *
  * When [[IModelHost.startup]] is invoked at the beginning of a session, schemas delivered with the application - like those describing
  * [[Workspace]]s - are automatically loaded.
  * The application can manually register additional schemas using methods like [[addGroup]], [[addFile]], [[addDirectory]], and [[addJson]].
  * When [[IModelHost.shutdown]] is invoked at the end of a session, all registered schemas are unregistered.
  *
  * See the [learning article]($docs/learning/backend/Workspace) for a detailed overiew and examples.
  *
  * @see [[IModelHost.settingsSchemas]] to access the registry for the current session.
  * @beta
  */
export interface SettingsSchemas {
  /** @internal */
  readonly [implementationProhibited]: unknown;

  /** The map of each individual registered [[SettingSchema]] defining a [[Setting]], accessed by its fully-qualified name (including its [[SettingGroupSchema.schemaPrefix]]). */
  readonly settingDefs: ReadonlyMap<SettingName, SettingSchema>;

  /** The map of each individual registered [[SettingSchema]] defining a type that can be extended by other [[SettingSchema]]s via [[SettingSchema.extends]],
   * accessed by its fully-qualified name (including its [[SettingGroupSchema.schemaPrefix]]).
   */
  readonly typeDefs: ReadonlyMap<SettingName, SettingSchema>;

  /** An event raised whenever schemas are added or removed. */
  readonly onSchemaChanged: BeEvent<() => void>;

  /**
   * Ensure that the setting value supplied is valid according to its [[SettingSchema]].
   * If no schema has been registered for the setting, no validation is performed.
   * @param value The value of the setting to validate against the schema.
   * @param settingName The fully-qualified setting name.
   * @returns `value` if `value` matches the schema corresponding to `settingName`, or if no such schema has been registered.
   * @throws Error if `value` is invalid according to the schema.
   */
  validateSetting<T>(value: T, settingName: SettingName): T;

  /** Register one or more [[SettingGroupSchema]]s.
   * If a group with the same [[SettingGroupSchema.prefix]] was previously registered, it will be replaced.
   * Each [[SettingSchema]] in the group will be added to [[settingDefs]] or [[typeDefs]].
   */
  addGroup(settingsGroup: SettingGroupSchema | SettingGroupSchema[]): void;

  /** Invokes [[addGroup]] for a [[SettingGroupSchema]] supplied as stringified json5. */
  addJson(settingSchema: string): void;

  /** Invokes [[addGroup]] for a json5 file containiner a [[SettingGroupSchema]]. */
  addFile(fileName: LocalFileName): void;

  /** Invokes [[addFile]] for every json and json5 file in the specified directory. */
  addDirectory(dirName: LocalDirName): void;

  /** Unregisters all [[settingDefs]] and [[typeDefs]] with the specified [[SettingGroupSchema.schemaPrefix]]. */
  removeGroup(schemaPrefix: string): void;
}
