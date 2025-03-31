/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { Id64String } from "@itwin/core-bentley";
import { LocalFileName } from "./ChangesetProps";
import { IModelConnectionProps } from "./IModel";

export namespace CatalogIModel {

  export const channelName = "catalogIModel/ipc";

  /** arguments for creating a new Container from the BlobContainerService that holds a StandaloneDb. */
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
    /** The name for the StandaloneDb file within the container */
    dbName: string,
    /** The filename of the StandaloneDb file to upload into the new container */
    iModelFile: LocalFileName;
  }

  /** Arguments for accessing an existing StandaloneDbContainer */
  export interface ContainerArg {
    containerId: string;
    /** If present, the container allows write operations. */
    writeable?: true
  }

  export interface NewContainerProps {
    baseUri: string;
    containerId: string;
    /** name of the blob storage provider. */
    provider: "azure" | "google";
  }

  export interface IpcMethods {
    /** create a new container from the BlobContainerService for holding a StandaloneDb. Also uploads the seed file */
    createNewContainer(args: CreateNewContainerArgs): Promise<NewContainerProps>;
    /** Acquire the write lock for a StandaloneDbContainer. */
    acquireWriteLock(args: ContainerArg & { username: string }): Promise<void>;
    /** Release the write lock for a StandaloneDbContainer. */
    releaseWriteLock(args: ContainerArg & { abandon?: true }): Promise<void>;
    /** Attempt to open a CatalogIModel */
    open(args: ContainerArg & { dbName: string }): Promise<IModelConnectionProps>;
  }
}
