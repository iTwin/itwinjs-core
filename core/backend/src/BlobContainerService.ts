/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module BlobContainers
 */

import { AccessToken, Id64String } from "@itwin/core-bentley";

/**
 * Service for creating, managing and providing access to cloud-based blob containers for an iTwin.
 * @beta
 */
export namespace BlobContainer {

  export type Provider = "azure" | "google" | "aws";
  export type ContainerId = string;
  export type UserToken = AccessToken;
  export type ContainerToken = AccessToken;

  export interface ScopeProps {
    iTwinId: Id64String;
    iModelId?: Id64String;
  }

  export interface Props extends ScopeProps {
    id?: ContainerId;
    isPublic?: boolean;
    metadata: {
      description: string;
      format: string;
      application: string;
      [propertyName: string]: string;
    }
  }

  export interface Address {
    uri: string;
    id: ContainerId;
  }

  export interface AccessProps extends Props {
    token: ContainerToken
    provider: Provider;
    emulator: boolean;
    expiration: Date;
  }

  export interface Service {
    create(arg: { props: Props, userToken: UserToken, provider?: Provider }): Promise<Address>;
    delete(arg: { address: Address, userToken: UserToken }): Promise<void>;
    getToken(arg: { address: Address, requestWriteAccess: boolean, userToken: UserToken, durationSeconds: number }): Promise<AccessProps>;
  }

  export let service: Service | undefined;
}
