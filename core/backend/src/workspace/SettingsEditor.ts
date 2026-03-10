/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { LocalFileName } from "@itwin/core-common";
import { SettingsContainer } from "./Settings";
import { BlobContainer } from "../BlobContainerService";
import { CloudSqliteContainer, GetWorkspaceContainerArgs, Workspace, WorkspaceContainerProps, WorkspaceDbName, WorkspaceDbNameAndVersion, WorkspaceDbVersion } from "./Workspace";
import { SettingsDb, SettingsDbManifest, SettingsDbProps } from "./SettingsDb";
import { SettingsSqliteDb } from "../internal/workspace/SettingsSqliteDb";
import { constructSettingsEditor } from "../internal/workspace/SettingsImpl";
import { _implementationProhibited } from "../internal/Symbols";
import { CloudSqlite } from "../CloudSqlite";

/** @beta */
export namespace SettingsEditor { // eslint-disable-line @typescript-eslint/no-redeclare
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
}

/** Arguments supplied to [[SettingsEditor.createNewCloudContainer]] to create a new [[EditableSettingsContainer]].
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

/** Arguments supplied to [[EditableSettingsContainer.createNewSettingsDbVersion]].
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

/** Arguments supplied to [[EditableSettingsContainer.createDb]] to create a new [[SettingsDb]] in a container.
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
export interface EditableSettingsContainer extends CloudSqliteContainer {
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
   * Get an editable [[SettingsDb]] to add, delete, or update settings dictionaries *within a newly created version* of a SettingsDb.
   * @param props - The properties of the SettingsDb.
   * @returns An EditableSettingsDb for modifying dictionaries.
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
 * For cloud-based SettingsDbs, the container's write token must be obtained via [[EditableSettingsContainer.acquireWriteLock]] before the methods in this interface may be used.
 * Normally, only admins will have write access.
 * Only one admin at a time may be editing a settings container.
 * @note Unlike [[EditableWorkspaceDb]], this interface only supports dictionary operations — no blob, file, or string resource methods.
 * @beta
 */
export interface EditableSettingsDb extends SettingsDb {
  readonly container: EditableSettingsContainer;

  /**
   * Update the contents of the manifest in this SettingsDb.
   * @note This replaces the stored manifest entirely; omitted fields are lost.
   * @param manifest - The updated manifest.
   */
  updateManifest(manifest: SettingsDbManifest): void;

  /**
   * Add or update a settings dictionary in this SettingsDb.
   * The `settings` will be stored as stringified JSON.
   * @param name - The name of the settings dictionary.
   * @param settings - The settings object to add or update.
   */
  updateSettingsDictionary(name: string, settings: SettingsContainer): void;

  /**
   * Remove a settings dictionary from this SettingsDb.
   * @param name - The name of the settings dictionary to remove.
   */
  removeSettingsDictionary(name: string): void;
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
  getContainer(args: GetWorkspaceContainerArgs): EditableSettingsContainer;

  /**
   * Asynchronously retrieves a container for the editor with the specified properties.
   */
  getContainerAsync(props: WorkspaceContainerProps): Promise<EditableSettingsContainer>;

  /**
   * Creates a new cloud container for holding SettingsDbs, from the [[BlobContainer]] service.
   * The container is automatically assigned `containerType: "settings"` in its metadata and
   * initialized with a default [[SettingsDb]].
   * @param args - The arguments for creating the container, including scope, metadata, and manifest.
   * @returns A promise that resolves to the new EditableSettingsContainer.
   * @note The current user must have administrator rights for the iTwin for the container.
   * @note Requires [[IModelHost.authorizationClient]] to be configured.
   */
  createNewCloudContainer(args: CreateNewSettingsContainerArgs): Promise<EditableSettingsContainer>;

  /**
   * Closes this editor. All settings containers are dropped.
   */
  close(): void;
}
