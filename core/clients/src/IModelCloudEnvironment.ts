/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { AccessToken } from "./Token";
import { UserProfile } from "./UserProfile";
import { Project } from "./ConnectClients";
import { DeploymentEnv } from "./Client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** @hidden How to discover "contexts". A context corresponds roughly to a "project" in Connect. */
export interface ContextManagerClient {
  queryContextByName(alctx: ActivityLoggingContext, accessToken: AccessToken, name: string): Promise<Project>;
}

/** @hidden User-authorization service. */
export interface IModelAuthorizationClient {
  authorizeUser(alctx: ActivityLoggingContext, userProfile: UserProfile | undefined, userCredentials: any, env: DeploymentEnv): Promise<AccessToken>;
}

/** @hidden All of the services that a frontend or other client app needs to find and access iModels. */
export interface IModelCloudEnvironment {
  readonly isIModelHub: boolean;
  readonly authorization: IModelAuthorizationClient;
  readonly contextMgr: ContextManagerClient;
}
