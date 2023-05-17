/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module BlobContainers
 */

// spell:ignore datacenter

import { AccessToken, Id64String } from "@itwin/core-bentley";

/**
 * Types and functions for creating, deleting and authorizing access to cloud-based blob containers for an iTwin.
 * @beta
 */
export namespace BlobContainer {

  /** Object that implements the methods to create, delete, and request access to a container. */
  export let service: BlobContainer.ContainerService | undefined;

  /** name of cloud provider for a container. */
  export type Provider = "azure" | "google" | "aws";

  /** the name of the container within its `Scope` */
  export type ContainerId = string;

  /** token that authenticates a user. This token is required to obtain a `ContainerToken`. */
  export type UserToken = AccessToken;

  /** token that authenticates access to a container for either read or write. */
  export type ContainerToken = AccessToken;

  /**
   * The scope for a container. This determines:
   *  - the "owner" organization, including the contract that governs its legal and commercial terms and obligations
   *  - the administrators who may configure RBAC permissions
   *  - the datacenter for the container. Every container resides in a datacenter as determined by the iTwinId. This
   * determines the region for data residency requirements.
   *  - the lifecycle constraints for the container. No container can outlive its iTwin or its iModel (if defined). That is,
   * when the iTwin/iModel is deleted (either explicitly or due to contract expiration), the container is also deleted.
   */
  export interface Scope {
    /** iTwinId of the owner of this container. */
    iTwinId: Id64String;
    /** optionally, an iModelId within the iTwin. If present, container is deleted when the iModel is deleted. */
    iModelId?: Id64String;
    /** optionally, an owner of the container. Owners always have administrator rights for the container. */
    owner?: string;
  }

  /**
   * Metadata about the use of a container so that:
   *  - administrators can understand why a container exists for assigning RBAC permissions appropriately
   *  - usage reports can aggregate types of containers
   *  - applications can identify their containers
   *  - applications can store important (to them) properties "on" their containers
   */
  export interface Metadata {
    /** Human readable explanation of the information held in the container. This will be displayed in the administrator RBAC panel, and on usage reports. */
    description: string;
    /** a machine-readable string that describes the "format" of the data in this container (e.g. "CloudSqlite") */
    format: string;
    /** an identifier of the application that uses this this container */
    application: string;
    /** Additional properties stored on the container */
    [propertyName: string]: string;
  }

  /** Properties returned by `Service.requestToken` */
  export interface TokenProps {
    /**
     * expiring token that provides the requested access to the container. Should be used in all subsequent requests for blobs within the container,
     * and must be refreshed before it expires
     */
    token: ContainerToken;
    /** scope of the container. */
    scope: Scope;
    /** name of the blob storage provider. */
    provider: Provider;
    /** Time at which the token will expire. The token should be refreshed (that is, a new token should be requested) before this time. */
    expiration: Date;
    /** Metadata of the container. */
    metadata: Metadata;
  }

  /** The URI and Id of the container. */
  export interface UriAndId {
    baseUri: string;
    id: ContainerId;
  }

  /** Information required to access an existing container. */
  export interface AccessContainerProps {
    address: UriAndId;
    userToken: UserToken;
  }

  /** Information required to request an access token for a container. */
  export interface RequestTokenProps extends AccessContainerProps {
    /** If true, token should provide write access.
     * @note if write access is requested and the user is authorized for read but not write, an exception will be thrown (i.e. a read token is *not* returned).
     */
    forWriteAccess?: boolean;
    /** the number of seconds before the token should expire.
     * @note A maximum duration is determined by the service. If no value is supplied, or the value is larger than the maximum, the maximum duration is used.
     */
    durationSeconds?: number;
  }

  /** Information required to create a new container. */
  export interface CreateNewContainerProps {
    /** the scope of the new container */
    scope: Scope;
    /** metadata to be stored on the new container */
    metadata: Metadata;
    /** The user's access token. The user must be authorized with "create container" RBAC role for the iTwin. */
    userToken: UserToken;
    /**
     * the id for the container. Useful for tests.
     * @internal
     */
    id?: ContainerId;
  }

  /** Methods to create, delete, and access blob containers. */
  export interface ContainerService {
    /**
     * Create a new blob container. Throws on failure (e.g. access denied or container already exists.)
     */
    create(props: CreateNewContainerProps): Promise<UriAndId>;

    /**
     * Delete an existing blob container.
     * @note This method requires that the user be authorized with "delete container" RBAC role for the iTwin.
     */
    delete(props: AccessContainerProps): Promise<void>;

    /**
     * Request a `ContainerToken` for a container. Throws on failure.
     */
    requestToken(props: RequestTokenProps): Promise<TokenProps>;
  }
}
