/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "./Token";
import { UserInfo } from "./UserInfo";
import { Project } from "./ConnectClients";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";

/** @hidden How to discover "contexts". A context corresponds roughly to a "project" in Connect. */
export interface ContextManagerClient {
  queryContextByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project>;
}

/** @hidden User-authorization service. */
export interface IModelAuthorizationClient {
  authorizeUser(requestContext: ClientRequestContext, userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken>;
}

/** @hidden All of the services that a frontend or other client app needs to find and access iModels. */
export interface IModelCloudEnvironment {
  readonly isIModelHub: boolean;
  readonly authorization: IModelAuthorizationClient;
  readonly contextMgr: ContextManagerClient;
  startup(): Promise<void>;
  shutdown(): Promise<number>;
}
