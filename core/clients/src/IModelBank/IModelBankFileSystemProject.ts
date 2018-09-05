/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as path from "path";
import * as child_process from "child_process";
import { IModelBankAccessContextGroupProps, IModelFileSystemProps, IModelBankAccessContext, IModelFileSystemIModelProps, NamedIModelAccessContextProps } from "./IModelBankAccessContext";
import { AccessToken } from "../Token";
import { IModelRepository, IModelQuery } from "../imodelhub/iModels";
import { UserProfile } from "../UserProfile";
import { DeploymentEnv } from "../Client";
import { Guid, IModelHubStatus, WSStatus, LoggerLevelsConfig, assert, EnvMacroSubst, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelProjectAbstraction, IModelProjectAbstractionIModelCreateParams } from "../IModelProjectAbstraction";
import { IModelHubError, IModelHubClientError } from "../imodelhub/Errors";
import { UrlFileHandler } from "../UrlFileHandler";
import { IModelClient } from "../IModelClient";
import { WsgError } from "../WsgClient";
import { IModelAccessContext } from "../IModelAccessContext";
import { Project } from "../ConnectClients";

function isQuoted(str: string): boolean {
  return str.startsWith("'");
}

function unQuote(str: string): string {
  return !isQuoted(str) ? str : str.replace(/\'/g, "");
}

/** The format of a config file that imodel-bank's runWebServer program will read
 * in order to get the information needed to set up and run an iModelBank server.
 */
export interface IModelBankServerConfig {
  /** The protocol and hostname of the server. E.g., "https://localhost".
   * baseUrl will be used to form the upload and download URLs returned by the server to the client for
   * briefcase, seedfile, and changeset upload/download.
   */
  baseUrl: string;
  /** The port where the server should listen */
  port: number;
  /** The path to the .key file to be used by https. Path may be relative to the server config file.  */
  keyFile: string;
  /** The path to the .crt file to be used by https. Path may be relative to the server config file. */
  certFile: string;
  /** Access control URL - a server that performs the permissions check */
  accessControlUrl: string | undefined;
  /** admin user name - for ULAS */
  adminConnectUserName: string;
  /** admin user's password - for ULAS */
  adminConnectUserPassword: string;
}

/** The format of a config file that contains logging configuration information.
 * The following macros may be used:
 * * IMODEL-BANK-DEFAULT-LOG-LEVEL  - default log level for all categories
 * * IMODEL-BANK-IMODEL-BANK-LOG-LEVEL - log level for the iModelBank logging category
 * * IMODEL-BANK-BESQLITE-LOG-LEVEL - log level for the BeSQLite logging category
 * * IMODEL-BANK-ULAS-LOG-LEVEL - log level for the ULAS logging category
 * * IMODEL-BANK-SEQ-URL - the URL of the SEQ logging client
 * * IMODEL-BANK-SEQ-PORT - the port of the SEQ logging client
 */
export interface IModelBankLoggingConfig {
  /** Log levels */
  loggerConfig?: LoggerLevelsConfig;
  /** SEQ logging configuration - must use the SeqConfig format. See @bentleyjs-core/SeqLoggerConfig */
  seq?: any; // SeqConfig
}

export interface IModelBankFileSystemProjectOptions {
  rootDir: string;
  name: string;
  env: DeploymentEnv;
  deleteIfExists?: boolean;
  createIfNotExist?: boolean;
}

interface RunningBank {
  context: IModelAccessContext;
  proc: child_process.ChildProcess;
}

export class IModelBankFileSystemProject extends IModelProjectAbstraction {
  public group: IModelBankAccessContextGroupProps;
  public runningBanks: Map<string, RunningBank>;
  public fsAdmin: IModelBankFileSystemAdmin;
  public env: DeploymentEnv;
  public serverConfig: IModelBankServerConfig;
  public serverLoggingConfigFile: string | undefined;
  public nextPort: number;

  public get isIModelHub(): boolean { return false; }

  constructor(options: IModelBankFileSystemProjectOptions, serverConfig: IModelBankServerConfig, serverLoggingConfigFile: string | undefined) {
    super();

    this.fsAdmin = new IModelBankFileSystemAdmin(options.rootDir);
    if (options.deleteIfExists)
      this.fsAdmin.deleteProject(options.name);
    if (options.createIfNotExist)
      this.fsAdmin.getOrCreateProject(options.name);

    this.env = options.env;
    this.serverConfig = serverConfig;
    this.serverLoggingConfigFile = serverLoggingConfigFile;
    this.nextPort = this.serverConfig.port;

    const imodelfs: IModelFileSystemProps = require(this.fsAdmin.getIModelFileSystemPropsFile(options.name));
    this.group = IModelBankAccessContext.makeIModelBankAccessContextGroupPropsFromFileSystem(imodelfs);

    for (const context of this.group.iModelBankProjectAccessContextGroup.contexts) {
      context.imodeljsCoreClientsIModelBankAccessContext.env = this.env;
    }

    this.runningBanks = new Map<string, RunningBank>();
  }

  public terminate(): void {
    for (const running of this.runningBanks.values())
      this.killIModelBank(running);
  }

  /** Make sure a bank server is running for the specified iModel */
  private queryContextPropsFor(iModelId: string): NamedIModelAccessContextProps {
    for (const context of this.group.iModelBankProjectAccessContextGroup.contexts) {
      if (context.imodeljsCoreClientsIModelBankAccessContext.iModelId === iModelId) {
        return context;
      }
    }
    throw new Error(`iModel ${iModelId} not registered in this project.`);
  }

  public getClientForIModel(_actx: ActivityLoggingContext, _projectId: string | undefined, iModelId: string): IModelClient {
    if (process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) {
      assert(false);
      return {} as IModelClient;
    }

    const running = this.runningBanks.get(iModelId);
    if (running !== undefined)
      return running.context.client!;

    const props: NamedIModelAccessContextProps = this.queryContextPropsFor(iModelId);

    // Assign a port to this bank
    const port = this.nextPort++;
    props.imodeljsCoreClientsIModelBankAccessContext.url = `${this.serverConfig.baseUrl}:${port}`;

    // Prepare a client for this bank, pointing to the assigned url
    const context = IModelBankAccessContext.fromJson(props, new UrlFileHandler())!;

    //  Run the bank
    const imodelDir = this.fsAdmin.getIModelDir(this.group.iModelBankProjectAccessContextGroup.name, iModelId);

    const thisBankServerConfig: IModelBankServerConfig = Object.assign({}, this.serverConfig);
    thisBankServerConfig.port = port;
    EnvMacroSubst.replaceInProperties(thisBankServerConfig, true, undefined);   // replace ${IMODELJS_CLIENTS_TEST_IMODEL_BANK}

    const thisBankServerConfigFile = path.join(imodelDir, "server.config.json");
    fs.writeFileSync(thisBankServerConfigFile, JSON.stringify(thisBankServerConfig));

    const thisBankLoggingConfigFile = this.serverLoggingConfigFile || path.join(imodelDir, "logging.config.json");
    if (!fs.existsSync(thisBankLoggingConfigFile)) {
      fs.writeFileSync(thisBankLoggingConfigFile, "{}");
    }

    const runWebServerJs = path.join(process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK, "lib", "runWebServer.js");

    const verboseArg = process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK_VERBOSE ?
      `--verbose=${process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK_VERBOSE}` : "";

    const cmdargs = [
      runWebServerJs,
      verboseArg,
      (imodelDir),
      (thisBankServerConfigFile),
      (thisBankLoggingConfigFile),
    ];

    const proc = child_process.spawn("node", cmdargs, { stdio: "inherit" });

    this.runningBanks.set(iModelId, { context, proc });

    proc.on("exit", () => {
      this.runningBanks.delete(iModelId);
    });

    proc.on("error", (err: Error) => {
      this.runningBanks.delete(iModelId);
      throw err;
    });

    return context.client!;
  }

  private killIModelBank(running: RunningBank): void {
    console.log(`killing ${running.context.toIModelTokenContextId()}`);
    running.proc.kill();
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
    // const id = this.group.iModelBankProjectAccessContextGroup.id;
    const id = JSON.stringify(this.group);
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

  private toRepo(props: NamedIModelAccessContextProps): IModelRepository {
    const id = props.imodeljsCoreClientsIModelBankAccessContext.iModelId;
    const name = props.name;
    return { wsgId: id, ecId: id, name };
  }

  public queryIModels(_actx: ActivityLoggingContext, _accessToken: AccessToken, projectId: string, query: IModelQuery | undefined): Promise<IModelRepository[]> {
    if (projectId !== undefined) {
      if (projectId === "")
        return Promise.reject(new IModelHubClientError(IModelHubStatus.UndefinedArgumentError));
      if (!projectId.startsWith("{\"iModelBankProjectAccessContextGroup\":") && (projectId !== this.group.iModelBankProjectAccessContextGroup.id))
        return Promise.reject(new IModelHubClientError(IModelHubStatus.InvalidArgumentError));
    }

    const repos: IModelRepository[] = [];
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

  public async createIModel(alctx: ActivityLoggingContext, _accessToken: AccessToken, _projectId: string, params: IModelProjectAbstractionIModelCreateParams): Promise<IModelRepository> {
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
    const running: RunningBank | undefined = this.runningBanks.get(iModelId);
    if (running !== undefined) {
      this.killIModelBank(running);
      this.runningBanks.delete(iModelId);
    }

    this.group.iModelBankProjectAccessContextGroup.contexts =
      this.group.iModelBankProjectAccessContextGroup.contexts.filter(
        (props: NamedIModelAccessContextProps) => props.imodeljsCoreClientsIModelBankAccessContext.iModelId === iModelId);

    this.fsAdmin.deleteIModel(this.group.iModelBankProjectAccessContextGroup.name, iModelId);

    return Promise.resolve();
  }

  public authorizeUser(_actx: ActivityLoggingContext, userProfile: UserProfile | undefined, userCredentials: any, _env: DeploymentEnv): Promise<AccessToken> {
    if (!userProfile)
      userProfile = { email: userCredentials.email, userId: "", firstName: "", lastName: "", organization: "", ultimateId: "", usageCountryIso: "" };
    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userProfile };
    return Promise.resolve(AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper))!);
  }
}

class IModelBankFileSystemAdmin {
  public rootDir: string;

  constructor(workDir: string) {
    this.rootDir = path.join(workDir, "bankfs");
    fsextra.mkdirpSync(this.rootDir);
  }

  public getIModelFileSystemRootDir(name: string): string {
    return path.join(this.rootDir, name);
  }

  public getIModelFileSystemPropsFile(name: string): string {
    return path.join(this.getIModelFileSystemRootDir(name), "imodelfs.json");
  }

  public getIModelDir(projectName: string, iModelId: string): string {
    return path.join(this.getIModelFileSystemRootDir(projectName), iModelId);
  }

  public getIModelPropsFileName(projectName: string, iModelId: string): string {
    return path.join(this.getIModelDir(projectName, iModelId), "imodel.json");
  }

  public writeImodelFsFile(projectName: string, props: IModelFileSystemProps) {
    fs.writeFileSync(this.getIModelFileSystemPropsFile(projectName), JSON.stringify(props));
  }

  public deleteProject(name: string) {
    const fsdir = this.getIModelFileSystemRootDir(name);
    if (fs.existsSync(fsdir))
      fsextra.removeSync(fsdir);
  }

  public getOrCreateProject(name: string): IModelFileSystemProps {
    const fsjsonfile = this.getIModelFileSystemPropsFile(name);
    const fsdir = path.dirname(fsjsonfile);

    if (!fs.existsSync(fsdir))
      fsextra.mkdirpSync(fsdir);

    if (!fs.existsSync(fsjsonfile)) {
      const imodelFsProps: IModelFileSystemProps = {
        name,
        id: Guid.createValue(),
        description: "",
        iModels: [],
      };
      this.writeImodelFsFile(name, imodelFsProps);
    }

    return require(fsjsonfile) as IModelFileSystemProps;
  }

  public createIModel(name: string, description: string, seedFile: string, projectId: string): NamedIModelAccessContextProps {
    const imodelfs = this.getOrCreateProject(projectId);
    const id = Guid.createValue();

    const imodelFileName = this.getIModelPropsFileName(projectId, id);

    const imdir = path.dirname(imodelFileName);

    if (fs.existsSync(imdir))
      throw new IModelHubError(IModelHubStatus.iModelAlreadyExists);

    if (!fs.existsSync(imdir))
      fsextra.mkdirpSync(imdir);

    const props: IModelFileSystemIModelProps = {
      name,
      description,
      id,
      seedFile,
    };

    fs.writeFileSync(imodelFileName, JSON.stringify(props));

    imodelfs.iModels.push(props);
    this.writeImodelFsFile(projectId, imodelfs);

    return IModelBankAccessContext.makeNamedIModelAccessContextPropsFromFileSystem(props);
  }

  private indexOfIModel(imodelfs: IModelFileSystemProps, iModelId: string): number {
    for (let i = 0; i !== imodelfs.iModels.length; ++i) {
      if (imodelfs.iModels[i].id === iModelId) {
        return i;
      }
    }
    return -1;
  }

  public deleteIModel(projectId: string, iModelId: string): void {
    const imodelfs = this.getOrCreateProject(projectId);
    const iFound = this.indexOfIModel(imodelfs, iModelId);
    if (iFound === -1)
      return;

    const imdir = this.getIModelDir(projectId, iModelId);
    fsextra.removeSync(imdir);

    imodelfs.iModels = imodelfs.iModels.filter((_props: IModelFileSystemIModelProps, index: number) => index === iFound);
    this.writeImodelFsFile(projectId, imodelfs);
  }
}
