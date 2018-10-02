/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { AccessToken } from "./Token";
import { UserProfile } from "./UserProfile";
import { ProgressInfo } from "./Request";
import { Project } from "./ConnectClients";
import { DeploymentEnv } from "./Client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** @hidden Information needed by a project abstraction to create an iModel */
export interface IModelContextIModelCreateParams {
  name: string;
  description: string;
  seedFile: string;
  tracker?: (progress: ProgressInfo) => void;
}

/** @hidden  Corresponds to Connect's project manager. */
export abstract class IModelContextClient {
  public abstract queryContextByName(alctx: ActivityLoggingContext, accessToken: AccessToken, name: string): Promise<Project>;
}

/** @hidden Access to a service that authorizes users. */
export interface IModelAuthorizationClient {
  authorizeUser(alctx: ActivityLoggingContext, userProfile: UserProfile | undefined, userCredentials: any, env: DeploymentEnv): Promise<AccessToken>;
}

/** @hidden All of the services that a frontend or other client app needs in order to find and access iModels. */
export interface IModelCloudEnvironment {
  readonly isIModelHub: boolean;
  readonly authorization: IModelAuthorizationClient;
  readonly contextClient: IModelContextClient;
  terminate(): void;
}
