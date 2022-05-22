/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { AccessToken } from "@itwin/core-bentley";
import { Project as ITwin } from "@itwin/projects-client";
import { AuthorizationClient } from "@itwin/core-common";
import { IModelClient } from "./IModelClient";

/** How to discover iTwins
 * @internal
 */
export interface ITwinManagerClient {
  getITwinByName(accessToken: AccessToken, name: string): Promise<ITwin>;
}

/** All of the services that a frontend or other client app needs to find and access iModels.
 * @internal
 */
export interface IModelCloudEnvironment {
  readonly isIModelHub: boolean;
  readonly iTwinMgr: ITwinManagerClient;
  readonly imodelClient: IModelClient;
  getAuthorizationClient(userCredentials: any): AuthorizationClient;
  startup(): Promise<void>;
  shutdown(): Promise<number>;
}
