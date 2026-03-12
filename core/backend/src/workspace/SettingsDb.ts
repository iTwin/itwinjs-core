/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { SettingsDictionary, SettingsPriority } from "./Settings";
import { CloudSqliteContainer, WorkspaceContainerId, WorkspaceDbName } from "./Workspace";
import { _implementationProhibited } from "../internal/Symbols";

/** Metadata stored inside a [[SettingsDb]] describing the database's contents, to help users understand
 * the purpose of the [[SettingsDb]] and who to contact with questions about it.
 * @note Only the `settingsName` field is required, and users may add additional fields for their own purposes.
 * @note Since the information is stored inside the [[SettingsDb]], it is versioned along with the rest of the contents.
 * @beta
 */
export interface SettingsDbManifest {
  /** The name of the [[SettingsDb]] to be shown in user interfaces. Organizations should attempt to make this name
   * informative enough so that users may refer to it in conversations.
   */
  readonly settingsName: string;
  /** A description of the contents of this [[SettingsDb]] to help users understand its purpose and appropriate usage. */
  readonly description?: string;
  /** The name of the person to contact with questions about this [[SettingsDb]]. */
  readonly contactName?: string;
  /** The name of the person who last modified this [[SettingsDb]]. */
  readonly lastEditedBy?: string;
}

/** Properties that specify how to load a [[SettingsDb]] within a [[CloudSqliteContainer]].
 * @beta
 */
export interface SettingsDbProps {
  /** The base name of the [[SettingsDb]], without any version information. Default: `"settings-db"`. */
  readonly dbName?: WorkspaceDbName;
  /** The [semver](https://github.com/npm/node-semver) version string or range for the desired [[SettingsDb]].
   * If not specified, the latest available version is used.
   */
  readonly version?: string;
}

/** Arguments for obtaining a [[SettingsDb]] from a previously-loaded container.
 * @beta
 */
export interface GetSettingsDbArgs {
  /** The [[WorkspaceContainerId]] of the cloud container that holds the [[SettingsDb]].
   * This is an opaque GUID assigned by the BlobContainer service when the container is created — it is
   * **not** the same as an iTwinId or iModelId.
   */
  readonly containerId: WorkspaceContainerId;
  /** The priority to assign to dictionaries loaded from this [[SettingsDb]]. */
  readonly priority: SettingsPriority;
  /** The name of the [[SettingsDb]] to retrieve. Default: `"settings-db"`. */
  readonly dbName?: WorkspaceDbName;
}

/** A SQLite database dedicated to storing [[SettingsDictionary]] values. Unlike a general-purpose [[WorkspaceDb]],
 * a `SettingsDb` restricts its API surface to dictionary-only operations, providing a focused interface
 * for reading settings organized into named dictionaries.
 *
 * A `SettingsDb` resides in a [[CloudSqliteContainer]] and can be published to the cloud. Once published,
 * the `SettingsDb` becomes immutable; however, multiple versions may be created to allow settings to evolve over time.
 * @beta
 */
export interface SettingsDb {
  /** @internal */
  [_implementationProhibited]: unknown;
  /** The [[CloudSqliteContainer]] in which this database resides. */
  readonly container: CloudSqliteContainer;
  /** The base name of this SettingsDb, without version. */
  readonly dbName: string;
  /** The resolved [semver](https://github.com/npm/node-semver) version of this SettingsDb.
   * @note For local (non-cloud) containers, this property returns `"0.0.0"`.
   */
  readonly version: string;
  /** The priority assigned to dictionaries loaded from this SettingsDb. */
  readonly priority: SettingsPriority;
  /** Whether the underlying database is currently open. */
  readonly isOpen: boolean;
  /** The manifest describing the contents of this SettingsDb. */
  readonly manifest: SettingsDbManifest;

  /** Open the underlying database for querying. When performing significant activity against a SettingsDb,
   * open it before the operations and [[close]] it afterwards.
   * @note Explicit open/close is a performance optimization for batches of operations. Individual methods like
   * [[getDictionary]] and [[getDictionaries]] will auto-open and auto-close the database if it is not already open.
   */
  open(): void;

  /** Close the underlying database. You should call this after [[open]]ing the database and completing your queries.
   * @note For [[EditableSettingsDb]] instances, if the container's write lock is currently held, closing persists
   * any pending changes and updates the manifest's `lastEditedBy` field with the current write lock holder.
   */
  close(): void;

  /** Return all [[SettingsDictionary]]s stored in this SettingsDb. */
  getDictionaries(): SettingsDictionary[];

  /** Look up a [[SettingsDictionary]] by name, returning `undefined` if no dictionary with that name exists.
   * @param name The name of the dictionary to retrieve.
   */
  getDictionary(name: string): SettingsDictionary | undefined;
}
