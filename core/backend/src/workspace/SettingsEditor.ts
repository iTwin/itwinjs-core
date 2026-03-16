/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { LocalFileName } from "@itwin/core-common";
import { GuidString } from "@itwin/core-bentley";
import { Setting, SettingName, SettingsContainer } from "./Settings";
import { BlobContainer } from "../BlobContainerService";
import { CloudSqliteContainer, GetWorkspaceContainerArgs, Workspace, WorkspaceContainerProps, WorkspaceDbName, WorkspaceDbNameAndVersion, WorkspaceDbVersion } from "./Workspace";
import { SettingsDb, SettingsDbManifest, SettingsDbProps } from "./SettingsDb";
import { SettingsSqliteDb } from "../internal/workspace/SettingsSqliteDb";
import { constructSettingsEditor } from "../internal/workspace/SettingsImpl";
import { _implementationProhibited } from "../internal/Symbols";
import { CloudSqlite } from "../CloudSqlite";
import { IModelHost } from "../IModelHost";

/** @beta */
export namespace SettingsEditor {
  /**
   * Create a new [[SettingsEditor]] for creating new versions of [[SettingsDb]]s.
   * @note The caller becomes the owner of the SettingsEditor and is responsible for calling [[SettingsEditor.close]] on it when finished.
   * @note It is illegal to have more than one SettingsEditor active in a single session.
   */
  export function construct(): SettingsEditor {
    return constructSettingsEditor();
  }

  /**
   * Create a new, empty, [[SettingsDb]] file on the local filesystem for importing settings dictionaries.
   */
  export function createEmptyDb(args: { localFileName: LocalFileName; manifest: SettingsDbManifest }): void {
    SettingsSqliteDb.createNewDb(args.localFileName, args);
  }

  /** Arguments for [[SettingsEditor.queryContainers]] and [[SettingsEditor.findContainers]]. */
  export interface QuerySettingsContainersArgs {
    /** The iTwinId whose settings containers should be queried. */
    iTwinId: GuidString;
    /** Optional iModelId to further scope the query to containers associated with a specific iModel. */
    iModelId?: GuidString;
    /** Optional label filter. */
    label?: string;
  }

  /**
   * Query the [[BlobContainer]] service for all settings containers associated with a given iTwin.
   * This is a convenience wrapper around `BlobContainer.service.queryContainersMetadata` that
   * automatically filters by `containerType: "settings"`.
   * @param args - The query arguments including the iTwinId.
   * @returns A promise that resolves to the matching container metadata entries.
   * @note Requires [[IModelHost.authorizationClient]] to be configured.
   */
  export async function queryContainers(args: QuerySettingsContainersArgs): Promise<BlobContainer.MetadataResponse[]> {
    if (undefined === BlobContainer.service)
      throw new Error("BlobContainer.service is not available. Ensure IModelHost is initialized with a valid configuration.");
    const userToken = await IModelHost.getAccessToken();
    return BlobContainer.service.queryContainersMetadata(userToken, { ...args, containerType: "settings" });
  }
}

/** Arguments supplied to [[SettingsEditor.createNewCloudContainer]] to create a new [[EditableSettingsCloudContainer]].
 * The created container will automatically have `containerType: "settings"` in its metadata, enabling discovery
 * via `BlobContainer.service.queryContainersMetadata({ containerType: "settings" })`.
 * @beta
 */
export interface CreateNewSettingsContainerArgs {
  /**
   * The scope of the container. This determines the ownership of the container, how RBAC rights are assigned,
   * and the location of the datacenter.
   */
  scope: BlobContainer.Scope;
  /** The manifest to be stored in the default SettingsDb in the new container. */
  manifest: SettingsDbManifest;
  /** Metadata stored by the BlobContainer service. The `containerType` field is omitted here because it is
   * automatically set to `"settings"` when the container is created (mirroring the `"workspace"` convention for WorkspaceDb containers).
   */
  metadata: Omit<BlobContainer.Metadata, "containerType">;
  /** The name of the default [[SettingsDb]] created inside the new container.
   * Default: "settings-db";
   */
  dbName?: WorkspaceDbName;
}

/** Arguments supplied to [[EditableSettingsCloudContainer.createNewSettingsDbVersion]].
 * @beta
 */
export interface CreateNewSettingsDbVersionArgs {
  /**
   * The properties that determine the source [[SettingsDb]] to serve as the basis for the new version.
   * This is usually the latest version, but it is possible to create patches to older versions.
   */
  fromProps?: SettingsDbProps;
  /** The type of version increment to apply to the source version. */
  versionType: CloudSqlite.SemverIncrement;
  /** For prerelease versions, a string that becomes part of the version name. */
  identifier?: string;
}

/** The result of creating a new version of a [[SettingsDb]].
 * @beta
 */
export interface SettingsDbVersionResult {
  /** The name and version of the source SettingsDb. */
  oldDb: WorkspaceDbNameAndVersion;
  /** The name and version of the newly-created SettingsDb. */
  newDb: WorkspaceDbNameAndVersion;
}

/** Arguments supplied to [[EditableSettingsCloudContainer.createDb]] to create a new [[SettingsDb]] in a container.
 * @beta
 */
export interface CreateSettingsDbArgs {
  /** The name of the new SettingsDb. Default: `"settings-db"`. */
  dbName?: WorkspaceDbName;
  /** The initial version of the new SettingsDb. Default: `"0.0.0"`. */
  version?: WorkspaceDbVersion;
  /** The manifest for the new SettingsDb. */
  manifest: SettingsDbManifest;
}

/** Arguments supplied to [[EditableSettingsDb.updateSetting]] to add or update a single [[Setting]].
 * @beta
 */
export interface UpdateSettingArgs {
  /** The [[SettingName]] of the setting to add or update. */
  readonly settingName: SettingName;
  /** The new value for the setting. */
  readonly value: Setting;
}

/**
 * A [[CloudSqliteContainer]] opened for editing settings by a [[SettingsEditor]].
 * You can create new [[SettingsDb]]s or new versions of existing [[SettingsDb]]s inside it.
 * Before actually making any changes to the container's contents, you must first obtain an exclusive write lock on it via
 * [[acquireWriteLock]]. Only one user can hold the write lock at any given time. When you have finished making changes,
 * you can use [[releaseWriteLock]] to publish your changes, or [[abandonChanges]] to discard them.
 * @note Settings containers are separate from workspace containers, providing independent write locks.
 * Editing settings does not block workspace resource editing, and vice versa.
 * @beta
 */
export interface EditableSettingsCloudContainer extends CloudSqliteContainer {
  /**
   * Create a copy of an existing [[SettingsDb]] in this container with a new [[WorkspaceDbVersion]].
   * The copy should be modified with new content before the write lock is released,
   * and thereafter may never be modified again.
   * @param args - The properties that determine the source SettingsDb and the version increment to apply.
   * @returns A promise that resolves to an object containing the old and new SettingsDb names and versions.
   */
  createNewSettingsDbVersion(args: CreateNewSettingsDbVersionArgs): Promise<SettingsDbVersionResult>;

  /**
   * Create a new, empty [[SettingsDb]].
   * @param args - The arguments for creating the new SettingsDb.
   * @returns A promise that resolves to an EditableSettingsDb.
   */
  createDb(args: CreateSettingsDbArgs): Promise<EditableSettingsDb>;

  /**
   * Get the cloud properties of this container.
   */
  readonly cloudProps: WorkspaceContainerProps | undefined;

  /**
   * Get an editable [[SettingsDb]] to add, delete, or update settings *within a newly created version* of a SettingsDb.
   * @param props - The properties of the SettingsDb.
   * @returns An EditableSettingsDb for modifying settings.
   * @throws if the targeted SettingsDb has already been published and is immutable. Use [[createNewSettingsDbVersion]] first to create an editable version.
   */
  getEditableDb(props?: SettingsDbProps): EditableSettingsDb;

  /**
   * Acquire the write lock on the container. Use [[releaseWriteLock]] to release the lock after publishing your changes, or
   * [[abandonChanges]] to release the lock and discard your changes.
   * Only one user can hold the write lock at any given time. However, readers can continue to read the published contents of the container while
   * a writer holds the write lock. Readers will only see the writer's changes after they are published by [[releaseWriteLock]].
   * @param user - The name of the user acquiring the write lock.
   * @throws if the write lock is already held by another user.
   */
  acquireWriteLock(user: string): void;

  /**
   * Release the write lock on the container. This should be called after all changes to the container's contents are complete. It
   * publishes and uploads the changes made to any [[SettingsDb]]s while the lock was held, after which those dbs become immutable.
   */
  releaseWriteLock(): void;

  /**
   * Abandon any changes made to the container and release the write lock. Any newly created versions of SettingsDbs are discarded.
   */
  abandonChanges(): void;
}

/**
 * An editable [[SettingsDb]]. This is used only by tools to allow administrators to create and modify SettingsDbs.
 * For cloud-based SettingsDbs, the container's write token must be obtained via [[EditableSettingsCloudContainer.acquireWriteLock]] before the methods in this interface may be used.
 * Normally, only admins will have write access.
 * Only one admin at a time may be editing a settings container.
 * @note Unlike [[EditableWorkspaceDb]], this interface only supports settings operations — no blob, file, or string resource methods.
 * @beta
 */
export interface EditableSettingsDb extends SettingsDb {
  readonly container: EditableSettingsCloudContainer;

  /**
   * Update the contents of the manifest in this SettingsDb.
   * @note This replaces the stored manifest entirely; omitted fields are lost.
   * @param manifest - The updated manifest.
   */
  updateManifest(manifest: SettingsDbManifest): void;

  /**
   * Replace all settings in this SettingsDb with the given container.
   * @param settings - The settings object to store.
   */
  updateSettings(settings: SettingsContainer): void;

  /**
   * Add or update a single [[Setting]] by name.
   * If a setting with the given name already exists, its value is replaced.
   * If it does not exist, it is added. Other settings are preserved.
   * @param args - The arguments specifying the setting name and value.
   */
  updateSetting(args: UpdateSettingArgs): void;

  /**
   * Remove a single [[Setting]] by name. Other settings are preserved.
   * @param settingName - The name of the setting to remove.
   */
  removeSetting(settingName: SettingName): void;
}

/** An object that permits administrators to modify the contents of settings containers.
 * Use [[SettingsEditor.construct]] to obtain a SettingsEditor, and [[close]] when finished using it.
 * Only one SettingsEditor may be in use at any given time.
 * Use [[getContainer]] to edit an existing container, or [[createNewCloudContainer]] to create a new container.
 * @beta
 */
export interface SettingsEditor {
  /** @internal */
  [_implementationProhibited]: unknown;

  /**
   * The workspace dedicated to this editor.
   * @note This workspace is independent from [[IModelHost.appWorkspace]] and all [[IModelDb.workspace]]s.
   */
  readonly workspace: Workspace;

  /**
   * Retrieves a container for the editor with the specified properties and access token.
   */
  getContainer(args: GetWorkspaceContainerArgs): EditableSettingsCloudContainer;

  /**
   * Asynchronously retrieves a container for the editor with the specified properties.
   */
  getContainerAsync(props: WorkspaceContainerProps): Promise<EditableSettingsCloudContainer>;

  /**
   * Creates a new cloud container for holding SettingsDbs, from the [[BlobContainer]] service.
   * The container is automatically assigned `containerType: "settings"` in its metadata and
   * initialized with a default [[SettingsDb]].
   * @param args - The arguments for creating the container, including scope, metadata, and manifest.
   * @returns A promise that resolves to the new EditableSettingsCloudContainer.
   * @note The current user must have administrator rights for the iTwin for the container.
   * @note Requires [[IModelHost.authorizationClient]] to be configured.
   */
  createNewCloudContainer(args: CreateNewSettingsContainerArgs): Promise<EditableSettingsCloudContainer>;

  /**
   * Find and open existing settings containers by querying the [[BlobContainer]] service.
   * This is a convenience method that queries for all settings containers matching the given iTwinId
   * (and optionally iModelId), requests write access tokens, and opens each matching container.
   * @param args - The query arguments including iTwinId and optionally iModelId and label.
   * @returns A promise that resolves to an array of opened [[EditableSettingsCloudContainer]]s.
   * @note Requires [[IModelHost.authorizationClient]] and [[BlobContainer.service]] to be configured.
   */
  findContainers(args: SettingsEditor.QuerySettingsContainersArgs): Promise<EditableSettingsCloudContainer[]>;

  /**
   * Closes this editor. All settings containers are dropped.
   */
  close(): void;
}
