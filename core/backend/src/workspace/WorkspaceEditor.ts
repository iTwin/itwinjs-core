/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { LocalFileName } from "@itwin/core-common";
import { SQLiteDb } from "../SQLiteDb";
import { SettingsContainer } from "./Settings";
import { BlobContainer } from "../BlobContainerService";
import {
  GetWorkspaceContainerArgs, Workspace, WorkspaceContainer, WorkspaceContainerProps, WorkspaceDb, WorkspaceDbCloudProps, WorkspaceDbManifest, WorkspaceDbName, WorkspaceDbNameAndVersion,
  WorkspaceDbProps, WorkspaceDbVersion, WorkspaceResourceName,
} from "./Workspace";
import { WorkspaceSqliteDb } from "../internal/workspace/WorkspaceSqliteDb";
import { constructWorkspaceEditor } from "../internal/workspace/WorkspaceImpl";
import { implementationProhibited } from "../internal/ImplementationProhibited";

/** @beta */
export namespace WorkspaceEditor {
  /**
   * Create a new [[WorkspaceEditor]] for creating new versions of [[WorkspaceDb]]s.
   * @note the caller becomes the owner of the Workspace.Editor and is responsible for calling [[WorkspaceEditor.close]] on it when they are finished using it.
   * @note It is illegal to have more than one Workspace.Editor active in a single session.
   */
  export function construct(): WorkspaceEditor {
    return constructWorkspaceEditor();
  }

  /**
   * Create a new, empty, [[EditableWorkspaceDb]] file on the local filesystem for importing [[Workspace]] resources.
   */
  export function createEmptyDb(args: { localFileName: LocalFileName, manifest: WorkspaceDbManifest }): void {
    WorkspaceSqliteDb.createNewDb(args.localFileName, args);
  }
}

/** Arguments supplied to [[WorkspaceEditor.createNewCloudContainer]] to create a new [[EditableWorkspaceContainer]].
 * @beta
 */
export interface CreateNewWorkspaceContainerArgs {
  /**
   * The scope of the container. This determines the ownership of the container, how RBAC rights are assigned,
   * and the location of the datacenter
   */
  scope: BlobContainer.Scope;
  /** The manifest to be stored in the default WorkspaceDb in the new container. */
  manifest: WorkspaceDbManifest;
  /** Metadata stored by the BlobContainer service */
  metadata: Omit<BlobContainer.Metadata, "containerType">;
  /** The name of the default [[WorkspaceDb]] created inside the new container.
   * Default: "workspace-db";
   */
  dbName?: WorkspaceDbName;
}

/**
 * A [[WorkspaceContainer]] opened for editing by a [[WorkspaceEditor]].
 * You can create new [[WorkspaceDb]]s or new versions of existing [[WorkspaceDb]]s inside it.
 * Before actually making any changes to the container's contents, you must first obtain an exclusive write lock on it via
 * [[acquireWriteLock]]. Only one user can hold the write lock at any given time. When you have finished making changes,
 * you can use [[releaseWriteLock]] to publish your changes, or [[abandonChanges]] to discard them.
 * @beta
 */
export interface EditableWorkspaceContainer extends WorkspaceContainer {
  /**
   * Create a copy of an existing [[WorkspaceDb]] in this container with a new [[WorkspaceDbVersion]].
   * The copy should be modified with new content before the write lock is released,
   * and thereafter may never be modified again.
   * @note The copy actually shares all of the data with the original, but with copy-on-write if/when data in the new WorkspaceDb is modified.
   * @param props - The properties that determine the source WorkspaceDb to serve as the basis for the new version.
   * @returns A promise that resolves to an object containing the old and new WorkspaceDb names and versions.
   */
  createNewWorkspaceDbVersion(props: CreateNewWorkspaceDbVersionArgs): Promise<{ oldDb: WorkspaceDbNameAndVersion, newDb: WorkspaceDbNameAndVersion }>;

  /**
   * Create a new, empty [[WorkspaceDb]].
   * @param args - The arguments for creating the new WorkspaceDb.
   * @returns A promise that resolves to an EditableWorkspaceDb.
   */
  createDb(args: { dbName?: WorkspaceDbName, version?: WorkspaceDbVersion, manifest: WorkspaceDbManifest }): Promise<EditableWorkspaceDb>;

  /**
   * Get the cloud properties of this container.
   */
  readonly cloudProps: WorkspaceContainerProps | undefined;

  /**
   * Get an editable [[WorkspaceDb]] to add, delete, or update resources *within a newly created version* of a WorkspaceDb.
   * @param props - The properties of the WorkspaceDb.
   */
  getEditableDb(props: WorkspaceDbProps): EditableWorkspaceDb;

  /**
   * Acquire the write lock on the container. Use [[releaseWriteLock]] to release the lock after publishing your changes, or
   * [[abandonChanges]] to release the lock and discard your changes.
   * Only one use can hold the write lock at any given time. However, readers can continue to read the published contents of the container while
   * a writer holds the write lock. Readers will only see the writer's changes after they are published by [[releaseWriteLock]].
   * @param user - The name of the user acquiring the write lock.
   */
  acquireWriteLock(user: string): void;

  /**
   * Release the write lock on the container. This should be called after all changes to the container's contents are complete. It
   * publishes and uploads the changes made to any [[WorkspaceDb]]s while the lock was held, after which those dbs become immutable.
   */
  releaseWriteLock(): void;

  /**
   * Abandon any changes made to the container and release the write lock. Any newly created versions of WorkspaceDbs are discarded.
   */
  abandonChanges(): void;
}

/**
 * The release increment for a version number, used as part of [[CreateNewWorkspaceDbVersionArgs]] to specify the kind of version to create.
 * @see [semver.ReleaseType](https://www.npmjs.com/package/semver)
 * @beta
 */
export type WorkspaceDbVersionIncrement = "major" | "minor" | "patch" | "premajor" | "preminor" | "prepatch" | "prerelease";

/**
 * Arguments supplied to [[Workspace.createNewWorkspaceDbVersion]].
 * @beta
 */
export interface CreateNewWorkspaceDbVersionArgs {
  /**
   * The properties that determine the source [[WorkspaceDb]] to serve as the basis for the new version.
   * This is usually the latest version, but it is possible to create patches to older versions.
   */
  fromProps?: WorkspaceDbProps;
  /** The type of version increment to apply to the source version. */
  versionType: WorkspaceDbVersionIncrement;
  /** For prerelease versions, a string that becomes part of the version name. */
  identifier?: string;
}

/**
 * An editable [[WorkspaceDb]]. This is used only by tools to allow administrators to create and modify WorkspaceDbs.
 * For cloud-based WorkspaceDbs, the container's write token must be obtained via [[EditableWorkspaceContainer.acquireWriteLock]] before the methods in this interface may be used.
 * Normally, only admins will have write access to a [[Workspace]].
 * Only one admin at a time may be editing a Workspace.
 * @beta
 */
export interface EditableWorkspaceDb extends WorkspaceDb {
  readonly container: EditableWorkspaceContainer;
  /**
   * The cloud properties of the [[WorkspaceDb]], if this is a cloud-based WorkspaceDb.
   */
  get cloudProps(): WorkspaceDbCloudProps | undefined;

  /**
   * Update the contents of the manifest in this WorkspaceDb.
   * @param manifest - The updated manifest.
   */
  updateManifest(manifest: WorkspaceDbManifest): void;

  /**
   * Add or update a resource in this WorkspaceDb that can be loaded as a [[SettingsDictionary]].
   * The `settings` will be stored as stringified JSON.
   * @param settings - The settings object to add or update.
   * @param rscName - The name of the settings resource. Defaults to "settingsDictionary" if undefined.
   */
  updateSettingsResource(settings: SettingsContainer, rscName?: string): void;

  /**
   * Add a new string resource to this WorkspaceDb.
   * @param rscName - The name of the string resource.
   * @param val - The string to save.
   * @throws if a string resource named `rscName` already exists.
   */
  addString(rscName: WorkspaceResourceName, val: string): void;

  /**
   * Update an existing string resource with a new value, or add it if it does not exist.
   * @param rscName - The name of the string resource.
   * @param val - The new value.
   */
  updateString(rscName: WorkspaceResourceName, val: string): void;

  /**
   * Remove a string resource.
   * @param rscName - The name of the string resource to remove.
   */
  removeString(rscName: WorkspaceResourceName): void;

  /**
   * Add a new binary resource to this WorkspaceDb.
   * @param rscName - The name of the blob resource.
   * @param val - The blob to save.
   * @throws if a blob resource named `rscName` already exists.
   */
  addBlob(rscName: WorkspaceResourceName, val: Uint8Array): void;

  /**
   * Update an existing blob resource with a new value, or add it if it does not exist.
   * @param rscName - The name of the blob resource.
   * @param val - The new value.
   */
  updateBlob(rscName: WorkspaceResourceName, val: Uint8Array): void;

  /**
   * Get a BlobIO writer for a previously-added blob WorkspaceResource.
   * @param rscName - The name of the blob resource.
   * @returns A BlobIO writer.
   * @note After writing is complete, the caller must call `close` on the BlobIO and must call `saveChanges` on the `db`.
   * @internal
   */
  getBlobWriter(rscName: WorkspaceResourceName): SQLiteDb.BlobIO;

  /**
   * Remove a binary resource.
   * @param rscName - The name of the blob resource to remove.
   */
  removeBlob(rscName: WorkspaceResourceName): void;

  /**
   * Copy the contents of an existing local file into this WorkspaceDb as a file resource.
   * @param rscName - The name of the file resource.
   * @param localFileName - The name of a local file to be read.
   * @param fileExt - The extension to be appended to the generated fileName when this WorkspaceDb is extracted from the WorkspaceDb.
   * By default, the characters after the last "." in `localFileName` are used. Pass this argument to override that.
   */
  addFile(rscName: WorkspaceResourceName, localFileName: LocalFileName, fileExt?: string): void;

  /**
   * Replace an existing file resource with the contents of another local file.
   * @param rscName - The name of the file resource.
   * @param localFileName - The name of a local file to be read.
   * @throws If the file resource does not exist.
   */
  updateFile(rscName: WorkspaceResourceName, localFileName: LocalFileName): void;

  /**
   * Remove a file resource.
   * @param rscName - The name of the file resource to remove.
   */
  removeFile(rscName: WorkspaceResourceName): void;
}

/** An object that permits administrators to modify the contents of a [[Workspace]].
 * Use [[WorkspaceEditor.construct]] to obtain a WorkspaceEditor, and [[close]] when finished using it.
 * Only one WorkspaceEditor may be in use at any given time.
 * Use [[getContainer]] to edit an existing [[WorkspaceContainer]], or [[createNewCloudContainer]] to create a new [[WorkspaceContainer]].
 * @beta
 */
export interface WorkspaceEditor {
  /** @internal */
  [implementationProhibited]: unknown;

  /**
   * The workspace dedicated to this editor.
   * @note This workspace is independent from [[IModelHost.appWorkspace]] and all [[IModelDb.workspace]]s. It has its own [[Settings]] and [[WorkspaceDb]]s.
   */
  readonly workspace: Workspace;

  /**
   * Retrieves a container for the editor with the specified properties and access token.
   */
  getContainer(args: GetWorkspaceContainerArgs): EditableWorkspaceContainer;

  /**
   * Asynchronously retrieves a container for the editor with the specified properties.
   */
  getContainerAsync(props: WorkspaceContainerProps): Promise<EditableWorkspaceContainer>;

  /**
   * Creates a new cloud container for holding WorkspaceDbs, from the [[BlobContainer]] service.
   * @note The current user must have administrator rights for the iTwin for the container.
   */
  createNewCloudContainer(args: CreateNewWorkspaceContainerArgs): Promise<EditableWorkspaceContainer>;

  /**
   * Closes this editor. All [[workspace]] containers are dropped.
   */
  close(): void;
}
