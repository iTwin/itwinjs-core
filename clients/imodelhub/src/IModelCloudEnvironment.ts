/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */
import { Asset, Project } from "@bentley/context-registry-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AuthorizedClientRequestContext, UserInfo } from "@bentley/itwin-client";
import { IModelClient } from "./IModelClient";

/** How to discover "contexts". A context corresponds to an iTwin "project" or "asset".
 * @internal
 */
export interface ContextManagerClient {
  queryProjectByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project>;
  queryAssetByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Asset>;
}

/** All of the services that a frontend or other client app needs to find and access iModels.
 * @internal
 */
export interface IModelCloudEnvironment {
  readonly isIModelHub: boolean;
  readonly contextMgr: ContextManagerClient;
  readonly imodelClient: IModelClient;
  getAuthorizationClient(userInfo: UserInfo | undefined, userCredentials: any): FrontendAuthorizationClient;
  startup(): Promise<void>;
  shutdown(): Promise<number>;
}
