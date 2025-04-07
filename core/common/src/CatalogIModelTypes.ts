/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { Id64String } from "@itwin/core-bentley";
import { LocalFileName } from "./ChangesetProps";
import { IModelConnectionProps, SnapshotOpenOptions } from "./IModel";

export namespace CatalogIModelTypes {

  export type IpcChannel = "catalogIModel/ipc";

  /** Arguments for creating a new Container from the BlobContainerService that holds (versions of) a CatalogIModel. */
  export interface CreateNewContainerArgs {
    /** supplies the iTwinId for the new container */
    iTwinId: Id64String;
    /** metadata stored with the new container */
    metadata: {
      label: string;
      /** Optional human-readable explanation of the information held in the container. This will be displayed in the administrator RBAC panel, and on usage reports. */
      description?: string;
      /** optional properties for the container */
      json?: { [key: string]: any };
    }
    /** The name for the CatalogIModel database within the container */
    dbName: string,
    /** The filename that holds the CatalogIModel to upload into the new container */
    iModelFile: LocalFileName;
  }

  /** Arguments for accessing an existing CatalogIModel container */
  export interface ContainerArg {
    containerId: string;
    /** If present, the container allows write operations. */
    writeable?: boolean
  }

  export interface NewContainerProps {
    baseUri: string;
    containerId: string;
    /** name of the blob storage provider. */
    provider: "azure" | "google";
  }

  export interface NameAndVersion {
    /** The name of the catalog database */
    readonly dbName: string;
    /** The range of acceptable versions of the database of the specified [[dbName]].
     * If omitted, it defaults to the newest available version.
     */
    readonly version?: VersionRange;
  }

  export interface OpenArgs extends SnapshotOpenOptions {
    containerId?: string;
    prefetch?: boolean;
  }

  export type OpenReadonlyArgs = OpenArgs & NameAndVersion;

  export interface OpenEditableArgs extends OpenArgs {
    dbFullName: string;
  }

  export interface CreateNewVersionArgs {
    readonly containerId: string;
    /** full name of source Db (including version) */
    readonly fromDb: string;
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
    acquireWriteLock(args: ContainerArg & { username: string }): Promise<void>;
    /** Release the write lock for a CatalogIModel container. */
    releaseWriteLock(args: ContainerArg & { abandon?: true }): Promise<void>;
    /** create a new version of a CatalogIModel from an existing version. */
    createNewVersion(args: CreateNewVersionArgs): Promise<{ oldDb: NameAndVersion, newDb: NameAndVersion }>;
    /** Attempt to open a CatalogIModel readonly*/
    openReadonly(args: OpenReadonlyArgs): Promise<IModelConnectionProps>;
    /** Attempt to open a CatalogIModel for editing */
    openEditable(args: OpenEditableArgs): Promise<IModelConnectionProps>;
  }
}
