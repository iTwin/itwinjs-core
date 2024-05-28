/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { LocalFileName } from "@itwin/core-common";
import { SQLiteDb } from "../SQLiteDb";
import { SettingObject } from "./Settings";
import { BlobContainer } from "../BlobContainerService";
import { Workspace, WorkspaceContainer, WorkspaceDb, WorkspaceResourceName } from "./Workspace";
import { WorkspaceSqliteDb } from "../internal/workspace/WorkspaceSqliteDb";
import { constructWorkspaceEditor } from "../internal/workspace/WorkspaceImpl";

/** @beta */
export namespace WorkspaceEditor {
  /**
   * Construct a new `WorkspaceEditor`
   * @note the caller becomes the owner of the Workspace.Editor and is responsible for calling `close` on it when it is no longer used.
   * It is illegal to have more than one Workspace.Editor active in a single session.
   */
  export function construct(): WorkspaceEditor {
    return constructWorkspaceEditor();
  }

  /**
   * The properties needed to create a new container from the BlobContainer service
   */
  export interface CreateNewContainerProps {
    /**
     * The scope of the container. This determines the ownership of the container, how RBAC rights are assigned,
     * and the location of the datacenter
     */
    scope: BlobContainer.Scope;
    /** The manifest to be stored in the default WorkspaceDb in the new container. */
    manifest: WorkspaceDb.Manifest;
    /** Metadata stored by the BlobContainer service */
    metadata: Omit<BlobContainer.Metadata, "containerType">;
    dbName?: string;
  }

  /**
   * A Workspace.Editor.Container supplies methods for creating and modifying versions of a WorkspaceDb.
   */
  export interface Container extends WorkspaceContainer {
    /**
     * Create a copy of an existing WorkspaceDb in this Workspace.Editor.Container with a new version number.
     * This function is used by administrator tools that modify Workspaces.
     * This requires that the *write lock on the container be held*.
     * The copy should be modified with new content before the write lock is released,
     * and thereafter may never be modified again.
     * @note The copy actually shares all of the data with the original, but with copy-on-write if/when data in the new WorkspaceDb is modified.
     * @param props - The properties that determine the source WorkspaceDb for the new version.
     * @returns A promise that resolves to an object containing the old and new WorkspaceDb names and versions.
     */
    makeNewVersion(props: Container.MakeNewVersionProps): Promise<{ oldDb: WorkspaceDb.NameAndVersion, newDb: WorkspaceDb.NameAndVersion }>;

    /**
     * Create a new empty WorkspaceDb.
     * @param args - The arguments for creating the new WorkspaceDb.
     * @returns A promise that resolves to an EditableWorkspaceDb.
     */
    createDb(args: { dbName?: string, version?: string, manifest: WorkspaceDb.Manifest }): Promise<EditableWorkspaceDb>;

    /**
     * Get the cloud properties of this Container.
     */
    get cloudProps(): WorkspaceContainer.Props | undefined;

    /**
     * Get an EditableWorkspaceDb to add, delete, or update resources *within a newly created version* of a WorkspaceDb.
     * @param props - The properties of the WorkspaceDb.
     */
    getEditableDb(props: WorkspaceDb.Props): EditableWorkspaceDb;

    /**
     * Acquire the write lock on the container.
     * @param user - The user acquiring the write lock.
     */
    acquireWriteLock(user: string): void;

    /**
     * Release the write lock on the container. This should be called after all changes to the EditableDb are complete. It
     * "publishes" and uploads the changes to the new version of the EditableDb and it is thereafter immutable.
     */
    releaseWriteLock(): void;

    /**
     * Abandon any changes made to the container and release the write lock. Any newly created versions of WorkspaceDbs are discarded.
     */
    abandonChanges(): void;
  }

  export namespace Container {
    /**
     * The release increment for a version number.
     * @see [semver.ReleaseType](https://www.npmjs.com/package/semver)
     */
    export type VersionIncrement = "major" | "minor" | "patch" | "premajor" | "preminor" | "prepatch" | "prerelease";

    /**
     * The properties for creating a new version of a WorkspaceDb.
     */
    export interface MakeNewVersionProps {
      /**
       * The properties that determine the source WorkspaceDb for the new version.
       * This is usually the latest version, but it is possible to create patches to older versions.
       */
      fromProps?: WorkspaceDb.Props;
      /** The type of version increment to apply to the source version. */
      versionType: Container.VersionIncrement;
      /** For prerelease versions, a string that becomes part of the version name. */
      identifier?: string;
    }
  }

  /**
   * Create a new, empty, EditableDb file on the local filesystem for importing Workspace resources.
   */
  export function createEmptyDb(args: { localFileName: LocalFileName, manifest: WorkspaceDb.Manifest }): void {
    WorkspaceSqliteDb.createNewDb(args.localFileName, args);
  }
}

/**
 * An editable [[WorkspaceDb]]. This is used only by tools to allow administrators to create and modify WorkspaceDbs.
 * For cloud-based WorkspaceDbs, the write token must be obtained before the methods in this interface may be used.
 * Normally, only admins will have write access to Workspaces.
 * Only one admin at a time may be editing a Workspace.
 * @beta
 */
export interface EditableWorkspaceDb extends WorkspaceDb {
  /**
   * Get the cloud properties of the WorkspaceDb.
   * @returns The cloud properties of the WorkspaceDb, or undefined if not available.
   */
  get cloudProps(): WorkspaceDb.CloudProps | undefined;

  /**
   * Update the contents of the manifest in this WorkspaceDb.
   * @param manifest - The updated manifest.
   */
  updateManifest(manifest: WorkspaceDb.Manifest): void;

  /**
   * Add or update a Settings resource to this WorkspaceDb.
   * @param settings - The settings object to add or update.
   * @param rscName - The name of the settings resource.
   */
  updateSettingsResource(settings: SettingObject, rscName?: string): void;

  /**
   * Add a new string resource to this WorkspaceDb.
   * @param rscName - The name of the string resource.
   * @param val - The string to save.
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
   * Add a new blob resource to this WorkspaceDb.
   * @param rscName - The name of the blob resource.
   * @param val - The blob to save.
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
   */
  getBlobWriter(rscName: WorkspaceResourceName): SQLiteDb.BlobIO;

  /**
   * Remove a blob resource.
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

/** An editor used to supply workspace administrators tools for creating or editing WorkspaceDbs. */
/**
 * Represents an editor that is associated with a workspace.
 * @beta
 */
export interface WorkspaceEditor {
  /**
   * The workspace dedicated to this editor.
   * @note This workspace is independent of all iModel or IModelHost workspaces.
   * It does not share settings or WorkspaceDbs with others.
   */
  readonly workspace: Workspace;

  /**
   * Retrieves a container for the editor with the specified properties and access token.
   * @param props - The properties of the workspace container.
   * @returns A container for editing WorkspaceDbs.
   */
  getContainer(props: WorkspaceContainer.Props & Workspace.WithAccessToken): WorkspaceEditor.Container;

  /**
   * Asynchronously retrieves a container for the editor with the specified properties.
   * @param props - The properties of the workspace container.
   * @returns A promise that resolves to a container for editing WorkspaceDbs.
   */
  getContainerAsync(props: WorkspaceContainer.Props): Promise<WorkspaceEditor.Container>;

  /**
   * Creates a new cloud container, for holding WorkspaceDbs, from the BlobContainer service.
   * @param props - The properties for creating a new container.
   * @returns A promise that resolves to a container for editing WorkspaceDbs.
   * @note The current user must have administrator rights for the iTwin for the container.
   */
  createNewCloudContainer(props: WorkspaceEditor.CreateNewContainerProps): Promise<WorkspaceEditor.Container>;

  /**
   * Closes this editor. All workspace containers are dropped.
   */
  close(): void;
}
