/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelBank */
import { IModelBankAccessContextGroupProps, IModelFileSystemProps, NamedIModelAccessContextProps, makeIModelBankAccessContextGroupPropsFromFileSystem } from "./IModelBankAccessContext";
import { AccessToken } from "../Token";
import { HubIModel, IModelQuery } from "../imodelhub/iModels";
import { UserProfile } from "../UserProfile";
import { DeploymentEnv } from "../Client";
import { IModelHubStatus, WSStatus, LoggerLevelsConfig, ActivityLoggingContext, BeEvent } from "@bentley/bentleyjs-core";
import { IModelProjectClient, IModelProjectIModelCreateParams, IModelAuthorizationClient } from "../IModelCloudEnvironment";
import { IModelHubError, IModelHubClientError } from "../imodelhub/Errors";
import { WsgError } from "../WsgClient";
import { Project } from "../ConnectClients";
import { IModelBankFileSystemAdmin } from "./IModelBankFileSystemAdmin";

function isQuoted(str: string): boolean {
  return str.startsWith("'");
}

function unQuote(str: string): string {
  return !isQuoted(str) ? str : str.replace(/\'/g, "");
}

/*
 * The format of a config file that imodel-bank's runWebServer program will read
 * in order to get the information needed to set up and run an iModelBank server.
 */
export interface IModelBankServerConfig {
  /* The protocol and hostname of the server. E.g., "https://localhost".
   * baseUrl will be used to form the upload and download URLs returned by the server to the client for
   * briefcase, seedfile, and changeset upload/download.
   */
  baseUrl: string;
  /* The port where the server should listen */
  port: number;
  /* The path to the .key file to be used by https. Path may be relative to the server config file.  */
  keyFile: string;
  /* The path to the .crt file to be used by https. Path may be relative to the server config file. */
  certFile: string;
  /* Access control URL - a server that performs the permissions check */
  accessControlUrl: string | undefined;
  /* admin user name - for ULAS */
  adminConnectUserName: string;
  /* admin user's password - for ULAS */
  adminConnectUserPassword: string;
}

/* The format of a config file that contains logging configuration information.
 * The following macros may be used:
 * * IMODEL-BANK-DEFAULT-LOG-LEVEL  - default log level for all categories
 * * IMODEL-BANK-IMODEL-BANK-LOG-LEVEL - log level for the iModelBank logging category
 * * IMODEL-BANK-BESQLITE-LOG-LEVEL - log level for the BeSQLite logging category
 * * IMODEL-BANK-ULAS-LOG-LEVEL - log level for the ULAS logging category
 * * IMODEL-BANK-SEQ-URL - the URL of the SEQ logging client
 * * IMODEL-BANK-SEQ-PORT - the port of the SEQ logging client
 */
export interface IModelBankLoggingConfig {
  /* Log levels */
  loggerConfig?: LoggerLevelsConfig;
  /* SEQ logging configuration - must use the SeqConfig format. See @bentleyjs-core/SeqLoggerConfig */
  seq?: any; // SeqConfig
}

export interface IModelBankFileSystemProjectOptions {
  rootDir: string;
  name: string;
  env: DeploymentEnv;
  deleteIfExists?: boolean;
  createIfNotExist?: boolean;
}

/* Implements the user permission abstraction by creating a dummy AccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this dummy token.
 */
export class IModelBankPermissionDummy implements IModelAuthorizationClient {
  public authorizeUser(_actx: ActivityLoggingContext, userProfile: UserProfile | undefined, userCredentials: any, _env: DeploymentEnv): Promise<AccessToken> {
    if (!userProfile)
      userProfile = { email: userCredentials.email, userId: "", firstName: "", lastName: "", organization: "", organizationId: "", ultimateSite: "", usageCountryIso: "" };
    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userProfile };
    return Promise.resolve(AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper))!);
  }
}

/* Implements the project abstraction by managing directories and files to represent projects and imodel definitions. */
export class IModelBankFileSystemProject extends IModelProjectClient {
  public group: IModelBankAccessContextGroupProps;
  public fsAdmin: IModelBankFileSystemAdmin;
  public env: DeploymentEnv;
  public readonly onDeleteIModel = new BeEvent<(iModelId: string) => void>();
  public readonly onTerminate = new BeEvent<() => void>();

  public get isIModelHub(): boolean { return false; }

  constructor(options: IModelBankFileSystemProjectOptions) {
    super();
    this.fsAdmin = new IModelBankFileSystemAdmin(options.rootDir);
    if (options.deleteIfExists)
      this.fsAdmin.deleteProject(options.name);
    if (options.createIfNotExist)
      this.fsAdmin.getOrCreateProject(options.name);

    const imodelfs: IModelFileSystemProps = require(this.fsAdmin.getIModelFileSystemPropsFile(options.name));
    this.group = makeIModelBankAccessContextGroupPropsFromFileSystem(imodelfs);
    for (const context of this.group.iModelBankProjectAccessContextGroup.contexts) {
      context.imodeljsCoreClientsIModelBankAccessContext.env = this.env;
    }
  }

  public terminate(): void {
    this.onTerminate.raiseEvent();
  }

  private matchesProjectFilter(props: IModelBankAccessContextGroupProps, query: any | undefined): boolean {
    if (query === undefined || query.$filter === undefined)
      return true;

    const filter = query.$filter!.split("+");
    if (filter.length !== 3 || filter[0].toLowerCase() !== "name" || filter[1] !== "eq")
      throw new Error("TBD - unsuported imodel query filter");
    const name = unQuote(filter[2]);
    return props.iModelBankProjectAccessContextGroup.name === name;
  }

  public queryProject(_actx: ActivityLoggingContext, _accessToken: AccessToken, query: any | undefined): Promise<Project> {
    if (!this.matchesProjectFilter(this.group, query))
      return Promise.reject(`Project matching ${JSON.stringify(query)} not registered`);

    const name = this.group.iModelBankProjectAccessContextGroup.name;
    const id = this.group.iModelBankProjectAccessContextGroup.id;
    return Promise.resolve({ wsgId: id, ecId: id, name });
  }

  private matchesFilter(props: NamedIModelAccessContextProps, query: IModelQuery | undefined): boolean {
    if (query === undefined || (query.getId() === "" && query.getQueryOptions().$filter === undefined))
      return true;

    const id = query.getId();
    if (id !== undefined)
      return props.imodeljsCoreClientsIModelBankAccessContext.iModelId === id;

    const filter = query.getQueryOptions().$filter!.split("+");
    if (filter.length !== 3 || filter[0].toLowerCase() !== "name" || filter[1] !== "eq")
      throw new Error("TBD - unsuported imodel query filter");
    const name = unQuote(filter[2]);
    return props.name === name;
  }

  private isIdQuery(query: IModelQuery | undefined) {
    return (query !== undefined) && (query.getId() !== undefined);
  }

  private toRepo(props: NamedIModelAccessContextProps): HubIModel {
    const id = props.imodeljsCoreClientsIModelBankAccessContext.iModelId;
    const name = props.name;
    return { wsgId: id, ecId: id, name };
  }

  public queryIModels(_actx: ActivityLoggingContext, _accessToken: AccessToken, projectId: string, query: IModelQuery | undefined): Promise<HubIModel[]> {
    if (projectId !== undefined) {
      if (projectId === "")
        return Promise.reject(new IModelHubClientError(IModelHubStatus.UndefinedArgumentError));
      if (!projectId.startsWith("{\"iModelBankProjectAccessContextGroup\":") && (projectId !== this.group.iModelBankProjectAccessContextGroup.id))
        return Promise.reject(new IModelHubClientError(IModelHubStatus.InvalidArgumentError));
    }

    const repos: HubIModel[] = [];
    for (const context of this.group.iModelBankProjectAccessContextGroup.contexts) {
      if (this.matchesFilter(context, query))
        repos.push(this.toRepo(context));
    }
    if ((repos.length === 0) && this.isIdQuery(query)) {
      const err = new WsgError(WSStatus.InstanceNotFound);
      err.name = "InstanceNotFound";
      return Promise.reject(err);
    }
    return Promise.resolve(repos);
  }

  public async createIModel(alctx: ActivityLoggingContext, _accessToken: AccessToken, _projectId: string, params: IModelProjectIModelCreateParams): Promise<HubIModel> {
    const existing = await this.queryIModels(alctx, _accessToken, _projectId, new IModelQuery().byName(params.name));
    alctx.enter();
    if (existing.length !== 0)
      return Promise.reject(new IModelHubError(IModelHubStatus.iModelAlreadyExists));

    const context = this.fsAdmin.createIModel(params.name, params.description, params.seedFile, this.group.iModelBankProjectAccessContextGroup.name); // may throw
    context.imodeljsCoreClientsIModelBankAccessContext.env = this.env;
    this.group.iModelBankProjectAccessContextGroup.contexts.push(context);
    const id = context.imodeljsCoreClientsIModelBankAccessContext.iModelId;
    if (params.tracker)
      params.tracker({ percent: 100, total: 1, loaded: 1 });
    return Promise.resolve({ wsgId: id, ecId: id, name: params.name, initialized: true });
  }

  public deleteIModel(_actx: ActivityLoggingContext, _accessToken: AccessToken, _projectId: string, iModelId: string): Promise<void> {
    this.onDeleteIModel.raiseEvent(iModelId);

    this.group.iModelBankProjectAccessContextGroup.contexts =
      this.group.iModelBankProjectAccessContextGroup.contexts.filter(
        (props: NamedIModelAccessContextProps) => props.imodeljsCoreClientsIModelBankAccessContext.iModelId === iModelId);

    this.fsAdmin.deleteIModel(this.group.iModelBankProjectAccessContextGroup.name, iModelId);

    return Promise.resolve();
  }

}
