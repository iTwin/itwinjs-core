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

/**
 * Errors created by the CatalogIModel apis
 * @beta
 */
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

/**
 * A CatalogIModel is an iModel that holds "definition" elements (e.g. Component Definitions) that are typically copied into
 * another iModel by applications.
 *
 * CatalogIModels may be stored in `BlobContainers` managed by a "reference data service" that uses [semantic versioning](https://semver.org/), much like [[WorkspaceDb]]s.
 * @beta
 */
export namespace CatalogIModelTypes {

  /** Metadata stored inside a CatalogIModel describing its, to help users understand the purpose of the CatalogIModel, the person to
  * contact with questions about it, and so on.
  * @note Only the [[catalogName]] field is required, and users may add additional fields for their own purposes.
  * @note Since the manifest is stored inside of the CatalogIModel, it is versioned along with the rest of the contents.
  * @beta
  */
  export interface CatalogManifest {
    /** The iTwinId for the Catalog */
    readonly iTwinId?: Id64String;

    /**
     * The name of the Catalog to be shown in user interfaces. Organizations should attempt to make this name informative enough
     * so that uses may refer to it in conversations. It should also be unique enough that there's no confusion when it appears in
     * lists of catalogs.
     * @note it is possible and valid to change the catalogName between versions of a CatalogIModel (e.g. incorporating a date).
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
      /** a "name" for the Catalog container. Should be long enough to be unique, but this is not enforced. */
      label: string;
      /** Optional human-readable explanation of the information held in the container. This will be displayed in the administrator RBAC panel, and on usage reports. */
      description?: string;
      /** optional properties for the container */
      json?: { [key: string]: any };
    }

    /** The manifest to be stored in the catalog */
    readonly manifest: CatalogManifest;
    /** The name for the CatalogIModel database within the container. May not contain a version. Default is "catalog-db" */
    readonly dbName?: string,
    /** version for the catalog created [[localCatalogFile]]. Defaults to "0.0.0" */
    readonly version?: string;
    /** A filename on the local computer of the "seed" CatalogIModel to be uploaded into the new container */
    readonly localCatalogFile: LocalFileName;
  }

  /** Properties of a newly created container created from [[CreateNewContainerArgs]]. Most importantly, this holds the ContainerId of the new container. */
  export interface NewContainerProps {
    /** The ContainerId of the new container (usually a [[Guid]]). Applications should store this value to access the container via the CatalogIModel apis. */
    readonly containerId: string;
    /** the uri of the BlobContainer service where the new container resides. */
    readonly baseUri: string;
    /** name of the blob storage provider. */
    readonly provider: "azure" | "google";
  }

  /** Properties to identify a specific CatalogIModel within a container. */
  export interface NameAndVersion {
    /** The name of the catalog database. Defaults to "catalog-db" for CatalogIModels stored in cloud containers. */
    readonly dbName?: string;
    /** The range of acceptable versions of the database of the specified [[dbName]].
     * If not present, defaults to the newest available version.
     */
    readonly version?: VersionRange;
  }

  /** Arguments to open an existing version of a CatalogIModel. */
  export interface OpenArgs extends NameAndVersion, SnapshotOpenOptions {
    /** The ContainerId of the cloud container. If not present, dbName is the name of a file on the local computer. */
    containerId?: string;
    /** If true, attempt ot synchronize the container with any changes in the cloud. Since this automatically happens the first time a
     * container is accessed within a session, this is usually not necessary except for tests.
     */
    syncWithCloud?: boolean;
    /** Start a prefetch operation on the CatalogIModel as it is opened. */
    prefetch?: boolean;
  }

  /** Arguments to create a new version of a CatalogIModel from (a copy of) an existing version in a cloud container. */
  export interface CreateNewVersionArgs {
    /** The id of cloud container. */
    readonly containerId: string;
    /** the source version of the CatalogIModel, from which the new version will copied. */
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

  /** The name of the ipc channel for [[IpcMethods]]
   * @internal
   */
  export type IpcChannel = "catalogIModel/ipc";

  /** @internal */
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
    /** Get the manifest and version number for an open CatalogConnection. */
    getInfo(key: string): Promise<{ manifest: CatalogIModelTypes.CatalogManifest, version: string }>;
    /** Update the manifest stored in an open EditableCatalog */
    updateCatalogManifest(key: string, manifest: CatalogIModelTypes.CatalogManifest): Promise<void>;
  }
}
