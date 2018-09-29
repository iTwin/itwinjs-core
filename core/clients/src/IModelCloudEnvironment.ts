/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { AccessToken } from "./Token";
import { HubIModel, IModelQuery } from "./imodelhub/iModels";
import { UserProfile } from "./UserProfile";
import { IModelClient } from "./IModelClient";
import { ProgressInfo } from "./Request";
import { Project } from "./ConnectClients";
import { DeploymentEnv } from "./Client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** Information needed by a project abstraction to create an iModel */
export interface IModelProjectIModelCreateParams {
  name: string;
  description: string;
  seedFile: string;
  tracker?: (progress: ProgressInfo) => void;
}

/** Manages projects and imodels. */
export abstract class IModelProjectClient {
  // Project queries
  public abstract queryProject(alctx: ActivityLoggingContext, accessToken: AccessToken, query: any | undefined): Promise<Project>;

  // IModel management
  public abstract createIModel(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, params: IModelProjectIModelCreateParams): Promise<HubIModel>;
  public abstract deleteIModel(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, iModelId: string): Promise<void>;
  public abstract queryIModels(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, query: IModelQuery | undefined): Promise<HubIModel[]>;
}

/** Interface implemented by a service that allows client apps to connect to an iModel server */
export interface IModelOrchestrationClient {
  getClientForIModel(alctx: ActivityLoggingContext, projectId: string | undefined, imodelId: string): Promise<IModelClient>;
}

/** Interface implemented by a service that authorizes users. */
export interface IModelAuthorizationClient {
  authorizeUser(alctx: ActivityLoggingContext, userProfile: UserProfile | undefined, userCredentials: any, env: DeploymentEnv): Promise<AccessToken>;
}

export interface IModelCloudEnvironment {
  readonly isIModelHub: boolean;
  readonly project: IModelProjectClient;
  readonly orchestrator: IModelOrchestrationClient;
  readonly authorization: IModelAuthorizationClient;
  terminate(): void;
}
