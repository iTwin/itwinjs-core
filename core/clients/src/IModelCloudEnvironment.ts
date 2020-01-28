/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "./Token";
import { UserInfo } from "./UserInfo";
import { Project, Asset } from "./ConnectClients";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";
import { IModelClient } from "./IModelClient";
import { IAuthorizationClient } from "./imodeljs-clients";

/** How to discover "contexts". A context corresponds roughly to a "project" in Connect.
 * @internal
 */
export interface ContextManagerClient {
  queryProjectByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project>;
  queryAssetByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Asset>;
}

/** User-authorization service.
 * @internal
 */
export interface IModelAuthorizationClient extends IAuthorizationClient {
  authorizeUser(requestContext: ClientRequestContext, userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken>;
}

/** All of the services that a frontend or other client app needs to find and access iModels.
 * @internal
 */
export interface IModelCloudEnvironment {
  readonly isIModelHub: boolean;
  readonly authorization: IModelAuthorizationClient;
  readonly contextMgr: ContextManagerClient;
  readonly imodelClient: IModelClient;
  startup(): Promise<void>;
  shutdown(): Promise<number>;
}
