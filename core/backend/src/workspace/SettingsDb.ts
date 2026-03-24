/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { ITwinSettingsError } from "@itwin/core-common";
import { GuidString } from "@itwin/core-bentley";
import { Setting, SettingName, SettingsContainer, SettingsPriority } from "./Settings";
import { CloudSqliteContainer, GetWorkspaceContainerArgs, WorkspaceContainerId, WorkspaceDbName } from "./Workspace";
import { _implementationProhibited } from "../internal/Symbols";
import { BlobContainer } from "../BlobContainerService";
import { IModelHost } from "../IModelHost";

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
  /** If true, allow semver prerelease versions like `"0.0.0-beta.0"` when resolving the desired [[SettingsDb]]. */
  readonly includePrerelease?: boolean;
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
  /** The semantic version string or range for the desired [[SettingsDb]].
   * If not specified, the latest available version is used.
   */
  readonly version?: string;
  /** If true, allow semver prerelease versions like `"0.0.0-beta.0"` when resolving the desired [[SettingsDb]]. */
  readonly includePrerelease?: boolean;
}

/** A CloudSQLite database dedicated to storing settings as key-value pairs. Unlike a general-purpose [[WorkspaceDb]],
 * a `SettingsDb` restricts its API surface to settings-only operations, providing a focused interface
 * for reading settings by name.
 *
 * Internally, all settings are stored in a single JSON blob. Each setting is a named entry in a [[SettingsContainer]].
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
   * [[getSetting]] and [[getSettings]] will auto-open and auto-close the database if it is not already open.
   */
  open(): void;

  /** Close the underlying database. You should call this after [[open]]ing the database and completing your queries.
   * @note For [[EditableSettingsDb]] instances, if the container's write lock is currently held, closing persists
   * any pending changes and updates the manifest's `lastEditedBy` field with the current write lock holder.
   */
  close(): void;

  /** Return a copy of the value of the setting named `settingName`, or `undefined` if not found.
   * The returned value is always cloned using [[Setting.clone]].
   * @param settingName The name of the setting to retrieve.
   */
  getSetting<T extends Setting>(settingName: SettingName): T | undefined;

  /** Return a deep copy of all settings stored in this SettingsDb as a [[SettingsContainer]].
   * @note The returned object is a fresh copy — mutating it will not affect the stored settings.
   */
  getSettings(): SettingsContainer;
}

/** The default resource name used to store settings in a [[SettingsDb]].
 * This is the key under which all settings are stored in the SQLite `strings` table.
 * When loading settings at runtime via [[Workspace.loadSettingsDictionary]], the `resourceName` defaults
 * to this value, ensuring the read and write paths always agree on which key to use.
 * @internal
 */
export const settingsResourceName = "settings";

/**
 * Help locate and obtain access to settings containers.
 * @internal
 */
export namespace SettingsContainers {
  /** Arguments for [[SettingsContainers.queryContainers]]. */
  export interface QueryArgs {
    /** The iTwinId whose settings containers should be queried. */
    iTwinId: GuidString;
    /** Optional label filter. */
    label?: string;
  }

  /**
   * Query the [[BlobContainer]] service for all settings containers associated with a given iTwin.
   * Automatically filters by `containerType: "settings"`.
   * @note Requires [[IModelHost.authorizationClient]] to be configured.
   */
  export async function queryContainers(args: QueryArgs): Promise<BlobContainer.MetadataResponse[]> {
    if (undefined === BlobContainer.service)
      ITwinSettingsError.throwError("blob-service-unavailable", { message: "BlobContainer.service is not available." });

    const userToken = await IModelHost.getAccessToken();
    return BlobContainer.service.queryContainersMetadata(userToken, { ...args, containerType: "settings" });
  }

  /**
   * Query the [[BlobContainer]] service for the single settings container associated with a given iTwin.
   * @returns The containerId, or `undefined` if no container exists.
   * @throws if more than one settings container is found.
   */
  export async function getITwinContainerId(iTwinId: GuidString): Promise<WorkspaceContainerId | undefined> {
    const containers = await queryContainers({ iTwinId });
    if (containers.length > 1) {
      ITwinSettingsError.throwError("multiple-itwin-settings-containers", {
        message: `Multiple iTwin settings containers were found for '${iTwinId}', so a container cannot be automatically selected.`,
        iTwinId,
      });
    }
    return containers[0]?.containerId;
  }

  /**
   * Look up the single settings container for an iTwin and obtain a read-only access token for it.
   * @returns The container props needed by [[IModelHost.getITwinWorkspace]], or `undefined` if no settings container exists.
   * @throws if more than one settings container is found.
   * @note Requires [[BlobContainer.service]] to be configured.
   */
  export async function getITwinContainerProps(iTwinId: GuidString): Promise<GetWorkspaceContainerArgs | undefined> {
    const containerId = await getITwinContainerId(iTwinId);
    if (undefined === containerId)
      return undefined;

    if (undefined === BlobContainer.service)
      ITwinSettingsError.throwError("blob-service-unavailable", { message: "BlobContainer.service is not available." });

    const tokenProps = await BlobContainer.service.requestToken({ accessLevel: "read", containerId, userToken: await IModelHost.getAccessToken() });
    if (undefined === tokenProps)
      return undefined;

    return { containerId, baseUri: tokenProps.baseUri, storageType: tokenProps.provider, accessToken: tokenProps.token };
  }
}
