/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module BlobContainers
 */

import { AccessToken, Id64String } from "@itwin/core-bentley";

/**
 * Types and Service for creating, managing and authorizing access to cloud-based blob containers for an iTwin.
 * @beta
 */
export namespace BlobContainer {

  /** name of cloud provider for a container. */
  export type Provider = "azure" | "google" | "aws";

  /** the name of the container within its [[Scope]] */
  export type ContainerId = string;

  /** access token that authenticates a user. This token is required to obtain a [[ContainerToken]]. */
  export type UserToken = AccessToken;

  /** access token that authenticates access to a container for either read or write. */
  export type ContainerToken = AccessToken;

  export interface Scope {
    iTwinId: Id64String;
    iModelId?: Id64String;
  }

  export interface Metadata {
    description: string;
    format: string;
    application: string;
    [propertyName: string]: string;
  }

  export interface Props extends Scope {
    id?: ContainerId;
    metadata: Metadata;
    isPublic?: true;
  }

  export interface AccessProps extends Props {
    provider: Provider;
    token: ContainerToken;
    expiration: Date;
    isEmulator?: true;
  }

  export interface Address {
    uri: string;
    id: ContainerId;
  }

  export interface Service {
    /** create a new Container. Throws on failure (e.g. access denied or container already exists.) */
    create(arg: { props: Props, userToken: UserToken }): Promise<Address>;
    delete(arg: { address: Address, userToken: UserToken }): Promise<void>;
    getToken(arg: { address: Address, requestWriteAccess: boolean, userToken: UserToken, durationSeconds: number }): Promise<AccessProps>;
  }

  export let service: Service | undefined;
}
