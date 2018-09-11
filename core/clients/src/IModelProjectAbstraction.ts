/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken } from "./Token";
import { IModelRepository, IModelQuery } from "./imodelhub/iModels";
import { UserProfile } from "./UserProfile";
import { IModelClient } from "./IModelClient";
import { ProgressInfo } from "./Request";
import { Project } from "./ConnectClients";
import { DeploymentEnv } from "./Client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** Information needed to create an iModel */
export interface IModelProjectAbstractionIModelCreateParams {
  name: string;
  description: string;
  seedFile: string;
  tracker?: (progress: ProgressInfo) => void;
}

/** Manages users, projects, and imodels and their servers. */
export abstract class IModelProjectAbstraction {

  public abstract isIModelHub: boolean;

  public abstract terminate(): void;

  // User management
  public abstract authorizeUser(alctx: ActivityLoggingContext, userProfile: UserProfile | undefined, userCredentials: any, env: DeploymentEnv): Promise<AccessToken>;

  // Project management
  public abstract queryProject(alctx: ActivityLoggingContext, accessToken: AccessToken, query: any | undefined): Promise<Project>;

  // IModel management
  public abstract createIModel(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, params: IModelProjectAbstractionIModelCreateParams): Promise<IModelRepository>;
  public abstract deleteIModel(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, iModelId: string): Promise<void>;
  public abstract queryIModels(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, query: IModelQuery | undefined): Promise<IModelRepository[]>;
}

/** Interface implemented by an agent that allows client apps to connect to an iModel server */
export interface IModelServerOrchestrator {
  getClientForIModel(alctx: ActivityLoggingContext, projectId: string | undefined, imodelId: string): IModelClient;
}
