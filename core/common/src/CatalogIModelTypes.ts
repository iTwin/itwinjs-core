/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { Id64String, ITwinError } from "@itwin/core-bentley";
import { LocalFileName } from "./ChangesetProps";
import { IModelConnectionProps, SnapshotOpenOptions } from "./IModel";

export namespace CatalogError {
  export const scope = "itwin-Catalog";

  export type Key =
    "invalid-seed-catalog" |
    "manifest-missing";

  /** Determine whether an error object is a CatalogError */
  export function isError(error: unknown, key?: Key): error is ITwinError {
    return ITwinError.isError<ITwinError>(error, scope, key);
  }

  /** Instantiate and throw a CatalogError */
  export function throwError<T extends ITwinError>(key: Key, e: Omit<T, "name" | "iTwinErrorId">): never {
    ITwinError.throwError<ITwinError>({ ...e, iTwinErrorId: { scope, key } });
  }
}

export namespace CatalogIModelTypes {

  export type IpcChannel = "catalogIModel/ipc";

  /** Metadata stored inside a [[WorkspaceDb]] describing the database's contents, to help users understand the purpose of the [[WorkspaceDb]], who to
  * contact with questions about it, and so on.
  * @note Only the [[workspaceName]] field is required, and users may add additional fields for their own purposes.
  * @note Since the information is stored inside of the [[WorkspaceDb]], it is versioned along with the rest of the contents.
  * @beta
  */
  export interface CatalogManifest {
    /** The iTwinId for the Catalog */
    readonly iTwinId?: Id64String;

    /** The name of the [[WorkspaceDb]] to be shown in user interfaces. Organizations should attempt to make this name informative enough
     * so that uses may refer to this name in conversations. It should also be unique enough that there's no confusion when it appears in
     * lists of WorkspaceDbs.
     * @note it is possible and valid to change the workspaceName between new version of a WorkspaceDb (e.g. incorporating a date).
     */
    readonly catalogName: string;
    /** A description of the contents of this Catalog to help users understand its purpose and appropriate usage. */
    readonly description?: string;
    /** The name of the person to contact with questions about this Catalog */
    readonly contactName?: string;
    /** The name of the person who last modified this Catalog. */
    lastEditedBy?: string;
  }

  /** Arguments for creating a new Container from the BlobContainerService that holds (versions of) a CatalogIModel. */
  export interface CreateNewContainerArgs {
    /** supplies the iTwinId for the new container */
    readonly iTwinId: Id64String;
    /** metadata stored with the new container */
    readonly metadata: {
      label: string;
      /** Optional human-readable explanation of the information held in the container. This will be displayed in the administrator RBAC panel, and on usage reports. */
      description?: string;
      /** optional properties for the container */
      json?: { [key: string]: any };
    }

    /** The manifest to be stored in the catalog */
    readonly manifest: CatalogManifest;
    /** The name for the CatalogIModel database within the container. Should not contain version. Default is "catalog-db" */
    readonly dbName?: string,
    /** version for the catalog created [[catalogFileName]]. Defaults to "0.0.0" */
    readonly version?: string;
    /** The filename that holds the CatalogIModel to upload into the new container */
    readonly localCatalogFile: LocalFileName;
  }

  export interface NewContainerProps {
    readonly baseUri: string;
    readonly containerId: string;
    /** name of the blob storage provider. */
    readonly provider: "azure" | "google";
  }


  export interface NameAndVersion {
    /** The name of the catalog database. Defaults to "catalog-db" for CatalogIModels stored in cloud containers. */
    readonly dbName?: string;
    /** The range of acceptable versions of the database of the specified [[dbName]].
     * If omitted, it defaults to the newest available version.
     */
    readonly version?: VersionRange;
  }

  export interface OpenArgs extends NameAndVersion, SnapshotOpenOptions {
    containerId?: string;
    syncWithCloud?: boolean;
    prefetch?: boolean;
  }

  export interface CreateNewVersionArgs {
    readonly containerId: string;
    /** full name of source Db (including version) */
    readonly fromDb: NameAndVersion;
    /** The type of version increment to apply to the source version. */
    readonly versionType: "major" | "minor" | "patch" | "premajor" | "preminor" | "prepatch" | "prerelease";
    /** For prerelease versions, a string that becomes part of the version name. */
    readonly identifier?: string;
  }

  /** A [semver string](https://github.com/npm/node-semver?tab=readme-ov-file#ranges) describing a range of acceptable [[CatalogIModels]]s,
   * e.g., ">=1.2.7 <1.3.0".
   */
  export type VersionRange = string;

  export interface IpcMethods {
    /** create a new container from the BlobContainerService for holding a CatalogIModel. Also uploads the seed file */
    createNewContainer(args: CreateNewContainerArgs): Promise<NewContainerProps>;
    /** Acquire the write lock for a CatalogIModel container. */
    acquireWriteLock(args: { containerId: string, username: string }): Promise<void>;
    /** Release the write lock for a CatalogIModel container. */
    releaseWriteLock(args: { containerId: string, abandon?: true }): Promise<void>;
    /** create a new version of a CatalogIModel from an existing version. */
    createNewVersion(args: CreateNewVersionArgs): Promise<{ oldDb: NameAndVersion, newDb: NameAndVersion }>;
    /** Attempt to open a CatalogIModel readonly*/
    openReadonly(args: OpenArgs): Promise<IModelConnectionProps>;
    /** Attempt to open a CatalogIModel for editing */
    openEditable(args: OpenArgs): Promise<IModelConnectionProps>;
    getInfo(key: string): Promise<{ manifest: CatalogIModelTypes.CatalogManifest, version: string }>;
    updateCatalogManifest(key: string, manifest: CatalogIModelTypes.CatalogManifest): Promise<void>;
  }
}
