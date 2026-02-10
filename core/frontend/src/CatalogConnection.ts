/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { CatalogIModel, IModelConnectionProps, IModelError } from "@itwin/core-common";
import { BriefcaseConnection } from "./BriefcaseConnection";
import { IModelStatus, OpenMode } from "@itwin/core-bentley";
import { NativeApp } from "./NativeApp";

/**
 * A read-only connection to a [CatalogDb]($backend).
 * @note CatalogConnection may only be used in [[NativeApp]]s
 * @see {@link CatalogConnection.openReadonly} to instantiate this type.
 * @beta
 */
export interface CatalogConnection extends BriefcaseConnection {
  getCatalogInfo(): Promise<{ manifest?: CatalogIModel.Manifest, version: string }>;
  isEditable(): this is EditableCatalogConnection;
}

/** A writable connection to an [EditableCatalogDb]($backend).
 * @see {@link CatalogConnection.openEditable} to instantiate this type.
 * @beta
 */
export interface EditableCatalogConnection extends CatalogConnection {
  updateManifest(manifest: CatalogIModel.Manifest): Promise<void>;
}

/** @beta */
export namespace CatalogConnection {
  /** Create a new [BlobContainer]($backend) to hold versions of a [CatalogIModel]($common).
   * @returns The properties of the newly created container.
   * @note creating new containers requires "admin" authorization.
  */
  export async function createNewContainer(args: CatalogIModel.CreateNewContainerArgs): Promise<CatalogIModel.NewContainerProps> {
    return NativeApp.catalogIpc.createNewContainer(args);
  }

  /** Acquire the write lock for a CatalogIModel container. Only one person may obtain the write lock at a time.
   * @note this requires "write" authorization to the container
  */
  export async function acquireWriteLock(args: {
    /** The id of the container */
    containerId: string,
    /**
     * The name of the individual acquiring the lock. This will be shown to others who attempt to acquire the lock while it is held.
     * It is also stored in the "lastEditedBy" field of the manifest of any new version edited while the lock is held.
     */
    username: string;
  }): Promise<void> {
    return NativeApp.catalogIpc.acquireWriteLock(args);
  }

  /** Release the write lock on a CatalogIModel container. This uploads all changes made while the lock is held, so they become visible to other users. */
  export async function releaseWriteLock(args: { containerId: string, abandon?: true; }): Promise<void> {
    return NativeApp.catalogIpc.releaseWriteLock(args);
  }

  /**
   * Create a new version of a CatalogIModel as a copy of an existing version. Immediately after this operation, the new version will be an exact copy
   * of the source CatalogIModel. Then, use [[openEditable]] to modify the new version with new content.
   * @note the write lock must be held for this operation to succeed
   * @see [[acquireWriteLock]]
   */
  export async function createNewVersion(args: CatalogIModel.CreateNewVersionArgs): Promise<{ oldDb: CatalogIModel.NameAndVersion; newDb: CatalogIModel.NameAndVersion; }> {
    return NativeApp.catalogIpc.createNewVersion(args);
  }

  /** Open a CatalogIModel for read access.
   * @returns the [[CatalogConnection]] to access the contents of the Catalog.
   * @note CatalogConnection extends BriefcaseConnection. When finished reading, call `close` on the connection.
   */
  export async function openReadonly(args: CatalogIModel.OpenArgs): Promise<CatalogConnection> {
    const openResponse = await NativeApp.catalogIpc.openReadonly(args);
    const connection = new CatalogConnectionImpl(openResponse, OpenMode.Readonly);
    BriefcaseConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Open a CatalogIModel for write access.
   * @note Once a version of a CatalogIModel has been published (i.e. the write lock has been released), it is no longer editable, *unless* it is a prerelease version.
   * @note the write lock must be held for this operation to succeed
   */
  export async function openEditable(args: CatalogIModel.OpenArgs): Promise<EditableCatalogConnection> {
    const openResponse = await NativeApp.catalogIpc.openEditable(args);
    const connection = new EditableCatalogConnectionImpl(openResponse, OpenMode.ReadWrite);
    BriefcaseConnection.onOpen.raiseEvent(connection);
    return connection;
  }
}

class CatalogConnectionImpl extends BriefcaseConnection implements CatalogConnection{
  public constructor(props: IModelConnectionProps, openMode: OpenMode) {
    super(props, openMode);
  }

  protected override requireTimeline(): void {
    throw new IModelError(IModelStatus.WrongIModel, "Catalogs have no timeline");
  }

  /** Get the manifest and version information for an open CatalogConnection. */
  public async getCatalogInfo(): Promise<{ manifest?: CatalogIModel.Manifest, version: string }> {
    return NativeApp.catalogIpc.getInfo(this.key);
  }

  public isEditable(): this is EditableCatalogConnection {
    return false;
  }
}

class EditableCatalogConnectionImpl extends CatalogConnectionImpl implements EditableCatalogConnection {
  /** Update the contents of the manifest in a CatalogIModel that is open with [[openEditable]]. */
  public async updateManifest(manifest: CatalogIModel.Manifest): Promise<void> {
    return NativeApp.catalogIpc.updateCatalogManifest(this.key, manifest);
  }

  public override isEditable(): this is EditableCatalogConnection {
    return true;
  }
}
