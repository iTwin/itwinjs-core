/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CloudContainers
 */

import { AccessToken, Id64String } from "@itwin/core-bentley";
import { SettingObject } from "./workspace/Settings";

/**
 * Service for creating, managing and providing access to cloud containers for an iTwin.
 * @beta
 */
export namespace CloudContainer {

  export type Provider = "azure" | "google" | "aws";
  export type ContainerId = string;
  export type UserToken = AccessToken;
  export type ContainerToken = AccessToken;

  export interface ScopeProps {
    iTwinId: Id64String;
    iModelId?: Id64String;
  }

  export interface Props extends ScopeProps {
    description: string;
    format: string;
    application: string;
    json?: SettingObject;
  }

  export interface Address {
    provider: Provider
    uri: string;
    id: ContainerId;
  }

  export interface AccessProps extends Props {
    token: ContainerToken;
    expiration: Date;
  }

  export interface Service {
    createNewContainer(arg: { props: Props, userToken: UserToken, provider?: Provider }): Promise<Address>;
    deleteContainer(arg: { address: Address, userToken: UserToken }): Promise<void>;
    requestAccess(arg: { address: Address, requestWriteAccess?: boolean, userToken: UserToken, durationSeconds: number }): Promise<AccessProps>;
  }

  export let service: Service | undefined;
}
