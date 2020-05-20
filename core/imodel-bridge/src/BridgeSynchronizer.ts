/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Framework
 */

import { ChangesType, HubIModel, IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { BriefcaseDb, BriefcaseManager, IModelJsNative } from "@bentley/imodeljs-backend";
import { BentleyStatus, Guid, GuidString, Logger, OpenMode } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { AzureFileHandler } from "@bentley/backend-itwin-client";
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { DownloadBriefcaseOptions, SyncMode } from "@bentley/imodeljs-common";
import * as fs from "fs";

import { IModelBridge } from "./IModelBridge";
import { BridgeLoggerCategory } from "./BridgeLoggerCategory";
// import { UsageLoggingUtilities } from "./usage-logging/UsageLoggingUtilities";

const loggerCategory: string = BridgeLoggerCategory.Framework;
/** Arguments that define how a bridge job should be run
 * @alpha
 */
export class BridgeJobDefArgs {
  /** Comment to be used as the initial string for all changesets.  Can be null. */
  public revisionComments?: string;
  /** Should be run after all documents have been synchronized.  Runs any actions (like project extent calculations) that need to run on the completed imodel */
  public allDocsProcessed: boolean = false;
  // public jobSubjectName?: string;
  /** Indicates whether the synchronizer should update the profile of the imodel's db. */
  public updateDbProfile: boolean = false;
  /** Indicates whether the synchronizer should update any of the core domain schemas in the imodel */
  public updateDomainSchemas: boolean = false;
  /** The module containing the IModel Bridge implementation */
  public bridgeModule?: string;
  /** Path to the source file */
  public sourcePath?: string;
  /** Path to the staging directory */
  public stagingdir?: string;
  public documentGuid?: string;
}

/** Arguments that describe the server environment used for the job
 * @alpha
 */
export class ServerArgs {
  /** Name of the iModel. Either the name or the GUID of the iModel must be defined. */
  public iModelName?: string;
  /** GUID of the iModel. Either the name or the GUID of the iModel must be defined. */
  public iModelId?: string;
  /** GUID of the Context (project) where this iModel resides. Either contextId or contextName must be defined. */
  public contextId?: string;
  /** Name of the Context (project) where this iModel resides. Either contextId or contextName must be defined. */
  public contextName?: string;
  public getToken?: () => Promise<AccessToken>;
  /** Create an iModel on the hub if one does not exist.
   * @internal
   */
  public createiModel: boolean = false;
  /** Specifies which environment: dev, QA, release */
  public environment?: string;
  /** The urn to fetch the input file. This and associated workspace will be downloaded */
  public dmsServerUrl?: string;
  /** OIDC or SAML access token used to login to DMS system. If ommited or empty, user credentials are used for login. */
  public dmsAccessToken?: string;
}
class StaticTokenStore {
  public static tokenString: string;
}

/** The driver for synchronizer content to an iModel.
 * @alpha
 */
export class BridgeSynchronizer {
  private _bridge?: IModelBridge;
  // private _ldClient: iModelBridgeLDClient;
  private _activityId: GuidString;

  private _imodelClient: IModelHubClient;
  private _requestContext?: AuthorizedClientRequestContext;
  private _briefcaseDb?: BriefcaseDb;
  private _bridgeArgs: BridgeJobDefArgs;
  private _serverArgs: ServerArgs;

  public getCacheDirectory () { return this._bridgeArgs.stagingdir; }

  private static parseArguments(args: string[], bridgeJobDef: BridgeJobDefArgs, serverArgs: ServerArgs): [BridgeJobDefArgs, ServerArgs] {
    for (const line of args) {
      if (!line)
        continue;
      const keyVal = line.split("=");
      if (keyVal[0].startsWith("@")) {
        const argFile = keyVal[0].substr(1);
        if (!fs.existsSync(argFile))
          throw new Error("Error file {argFile} does not exist.");
        BridgeSynchronizer.parseArgumentFile(argFile, bridgeJobDef, serverArgs);
        continue;
      }
      const argName = keyVal[0].trim();
      switch (argName) {
        case "--fwk-input": bridgeJobDef.sourcePath = keyVal[1].trim(); break;
        case "--fwk-staging-dir": bridgeJobDef.stagingdir = keyVal[1].trim(); break;
        case "--fwk-bridge-library": bridgeJobDef.bridgeModule = keyVal[1].trim(); break;
        case "--fwk-create-repository-if-necessary": serverArgs.createiModel = true; break;
        case "--server-repository": serverArgs.iModelName = keyVal[1].trim(); break;
        case "--server-project": serverArgs.contextName = keyVal[1].trim(); break;
        case "--server-project-guid": serverArgs.contextId = keyVal[1].trim(); break;
        case "--server-environment": serverArgs.environment = keyVal[1].trim(); break;
        case "--server-accessToken": {
          StaticTokenStore.tokenString = fs.readFileSync(keyVal[1]).toString();
          serverArgs.getToken = async (): Promise<AccessToken> => AccessToken.fromTokenString(StaticTokenStore.tokenString);
          break;
        }
        case "--dms-inputFileUrn=": serverArgs.dmsServerUrl = keyVal[1].trim(); break;
        case "--dms-accessToken=": serverArgs.dmsAccessToken = keyVal[1].trim(); break;
        case "--dms-documentGuid=": bridgeJobDef.documentGuid = keyVal[1].trim(); break;
        default:
          {
            /** Unsupported options
             * --fwk-skip-assignment-check
             * --server-user=abeesh.basheer@bentley.com
             * --server-password=ReplaceMe
             */
            Logger.logError(loggerCategory, `${line} is not supported`);
          }
      }
    }
    return [bridgeJobDef, serverArgs];
  }
  private static parseArgumentFile(argFile: string, bridgeJobDef: BridgeJobDefArgs, serverArgs: ServerArgs): [BridgeJobDefArgs, ServerArgs] {
    const fileContent = fs.readFileSync(argFile).toString().split("\n");
    return this.parseArguments(fileContent, bridgeJobDef, serverArgs);
  }

  /** Create a new instance of BridgeSynchronizer from command line arguments */
  public static fromArgs(args: string[]): BridgeSynchronizer {
    const bridgeJobDef = new BridgeJobDefArgs();
    const serverArgs = new ServerArgs();
    const argValues = BridgeSynchronizer.parseArguments(args, bridgeJobDef, serverArgs);
    return new BridgeSynchronizer(argValues[0], argValues[1]);
  }

  /** Create a new instance with the given arguments. */
  public constructor(_jobDefArgs: BridgeJobDefArgs, _serverArgs: ServerArgs) {
    // this._ldClient = iModelBridgeLDClient.getInstance(env);
    this._activityId = Guid.createValue();
    this._imodelClient = new IModelHubClient(new AzureFileHandler());
    this._bridgeArgs = _jobDefArgs;
    this._serverArgs = _serverArgs;
    if (!this._bridgeArgs.stagingdir)
      throw new Error("staging directory is not defined.");
    BriefcaseManager.initialize(this._bridgeArgs.stagingdir, this._imodelClient);
  }

  /** Main driver. */
  public async synchronize(): Promise<BentleyStatus> {
    // If we can't load the bridge, no point in trying anything else;
    if (this._bridgeArgs.bridgeModule === undefined)
      return BentleyStatus.ERROR;

    await this.loadBridge(this._bridgeArgs.bridgeModule);
    if (this._bridge === undefined)
      return BentleyStatus.ERROR;

    if (undefined === this._serverArgs.getToken) {
      return BentleyStatus.ERROR;
    }

    const token = await this._serverArgs.getToken();

    this._requestContext = new AuthorizedClientRequestContext(token, this._activityId, this._bridge.getApplicationId(), this._bridge.getApplicationVersion());

    if (this._serverArgs === undefined || this._serverArgs.contextId === undefined && this._serverArgs.contextName === undefined) {
      throw new Error("Need to supply either a context name or a context id");
    }

    if (this._serverArgs.contextName !== undefined) {
      this._serverArgs.contextId = await this.getContextId(this._serverArgs.contextName);
    }

    if (this._serverArgs.contextId === undefined) {
      throw new Error("Could not find project " + this._serverArgs.contextName + ".");
    }

    if (this._bridgeArgs.sourcePath === undefined) {
      throw new Error("Source path is not defined");
    }
    // Disabiling until we figure out how to get permissions for this scope in access token.
    // await UsageLoggingUtilities.postUserUsage(this._requestContext, this._serverArgs.contextId, IModelJsNative.AuthType.OIDC, os.hostname(), IModelJsNative.UsageType.Trial);

    this.initProgressMeter();

    if (Guid.isGuid(this._serverArgs.iModelName!))
      this._serverArgs.iModelId = this._serverArgs.iModelName;
    else
      this._serverArgs.iModelId = await this.getIModelIdFromName();

    if (this._serverArgs.iModelId === undefined)
      throw new Error("Failed to get IModelId from briefcaseName");

    this._briefcaseDb = await this.acquireBriefcase();
    if (this._briefcaseDb === undefined)
      throw new Error("Unable to acquire briefcase");

    await this._bridge.openSource(this._bridgeArgs.sourcePath, this._serverArgs.dmsAccessToken, this._bridgeArgs.documentGuid);
    await this._bridge.onOpenBim(this._briefcaseDb);

    await this.updateExistingIModel(this._bridgeArgs.sourcePath);

    this._briefcaseDb.close();
    return BentleyStatus.SUCCESS;
  }

  private async loadBridge(bridgeModulePath: string): Promise<boolean> {
    let bridgeModule;
    try {
      bridgeModule = require(bridgeModulePath);
    } catch (error) {
      Logger.logError(loggerCategory, `Failed to load bridge '${bridgeModulePath}' error: ${error}`);
    }

    if (undefined === bridgeModule) {
      Logger.logError(loggerCategory, `Failed to load bridge '${bridgeModulePath}'`);
    }
    this._bridge = bridgeModule.getBridgeInstance();
    return null !== this._bridge;
  }

  private async getContextId(contextName: string): Promise<string> {
    if (this._requestContext === undefined)
      throw new Error("Must initialize AuthorizedClientRequestContext before using");

    const project: Project = await (new ContextRegistryClient()).getProject(this._requestContext, { $select: "$id", $filter: "Name+like+'" + contextName + "'" });

    if (!project || !project.wsgId)
      throw new Error("Could not find project " + contextName + ".");

    return project.wsgId;
  }

  private initProgressMeter() {

  }

  /**
   * Gets the Guid of an iModel from iModelHub
   * @param contextId Guid of iModel context
   * @param imodelName Name of iModel
   * @returns Guid of specified iModel
   * @throws If an iModel with specified contextId and name could not be found
   */
  private async getIModelIdFromName(): Promise<string> {
    if (this._serverArgs.iModelId !== undefined)
      return this._serverArgs.iModelId;

    if (this._requestContext === undefined)
      throw new Error("Must initialize AuthorizedClientRequestContext before using");
    if (this._serverArgs.contextId === undefined)
      throw new Error("Must initialize ContextId before using");
    if (this._serverArgs.iModelName === undefined)
      throw new Error("Must initialize BriefcaseName before using");

    // get iModel from iModelHub
    const imodel: HubIModel = (await this._imodelClient.iModels.get(this._requestContext, this._serverArgs.contextId, new IModelQuery().byName(this._serverArgs.iModelName)))[0];
    if (!imodel) {
      throw new Error(`iModel with name ${this._serverArgs.iModelName} was not found in the given project/context.`);
    }
    return imodel.wsgId;
  }

  /** This will download the briefcase, open it with the option to update the Db profile, close it, re-open with the option to upgrade core domain schemas */
  private async acquireBriefcase(): Promise<BriefcaseDb> {
    // Can't actually get here with a null _requestContext, but this guard removes the need to instead use this._requestContext!
    if (this._requestContext === undefined)
      throw new Error("Must initialize AuthorizedClientRequestContext before using");
    if (this._serverArgs.contextId === undefined)
      throw new Error("Must initialize ContextId before using");
    if (this._serverArgs.iModelId === undefined)
      throw new Error("Must initialize IModelId before using");

    // First, download the briefcase
    const downloadOptions: DownloadBriefcaseOptions = { syncMode: SyncMode.PullAndPush };
    const briefcaseProps = await BriefcaseManager.download(this._requestContext, this._serverArgs.contextId, this._serverArgs.iModelId, downloadOptions);
    const briefcaseEntry = BriefcaseManager.findBriefcaseByKey(briefcaseProps.key);
    if (undefined === briefcaseEntry) {
      throw new Error("Unable to download briefcase");
    }
    let briefcaseDb: BriefcaseDb | undefined;
    if (this._bridgeArgs.updateDbProfile) {
      briefcaseProps.openMode = OpenMode.ReadWrite;
      briefcaseEntry.upgrade = IModelJsNative.UpgradeMode.Profile;
      briefcaseDb = await BriefcaseDb.open(this._requestContext, briefcaseProps.key);
      if (briefcaseDb === undefined)
        throw new Error("Unable to download and open briefcase with profile upgrade");
      await briefcaseDb.pushChanges(this._requestContext, "Open with Db Profile update");
      if (this._bridgeArgs.updateDomainSchemas)
        briefcaseDb.close();
    }

    if (this._bridgeArgs.updateDomainSchemas) {
      briefcaseEntry.upgrade = IModelJsNative.UpgradeMode.Domain;
      briefcaseDb = await BriefcaseDb.open(this._requestContext, briefcaseProps.key);
      if (briefcaseDb === undefined)
        throw new Error("Unable to download and open briefcase with domain schema upgrade");
      await briefcaseDb.pushChanges(this._requestContext, "Open with Domain Schema update");
    }

    if (briefcaseDb === undefined || !briefcaseDb.isOpen)
      briefcaseDb = await BriefcaseDb.open(this._requestContext, briefcaseProps.key);

    if (briefcaseDb === undefined)
      throw new Error("Unable to download and open briefcase");
    return briefcaseDb;
  }

  private async updateExistingIModel(sourcePath: string) {

    // Import futureon BIS schema into the iModel.
    await this.initDomainSchema();
    await this.importDefinitions();
    try {
      await this.pushDataChanges("Data changes", ChangesType.Schema);
    } catch (error) {
      Logger.logError(loggerCategory, `${error} was thrown from pushDataChanges`);
    }
    await this.updateExistingData(sourcePath);
  }

  private getRevisionComment(pushComments: string): string {
    let comment = "";
    if (this._bridgeArgs.revisionComments !== undefined)
      comment = this._bridgeArgs.revisionComments.substring(0, 400);
    if (comment.length > 0)
      comment = comment + " - ";
    return comment + pushComments;
  }

  /** Pushes any pending transactions to the hub. */
  public async pushDataChanges(pushComments: string, type: ChangesType) {
    if (this._briefcaseDb === undefined)
      return;
    if (this._briefcaseDb.txns === undefined)
      return;
    if (this._briefcaseDb.txns.hasUnsavedChanges)
      throw new Error("Cannot have unsaved changes when calling pushDataChanges");
    if (!this._briefcaseDb.txns.hasPendingTxns)
      return;
    const comment = this.getRevisionComment(pushComments);
    await BriefcaseManager.pushChanges(this._requestContext!, this._briefcaseDb.briefcase, comment, type);
  }

  private async importDefinitions() {
    // Get a schema lock from iModelHub before calling the bridge.
    await this._bridge!.importDefinitions();
  }

  // Get a schema lock from iModelHub before calling the bridge.
  private async initDomainSchema() {
    await this._bridge!.importDomainSchema(this._requestContext!);
    try {
      await this.pushDataChanges("Schema changes", ChangesType.Schema);
    } catch (error) {
      Logger.logError(loggerCategory, `${error} was thrown from pushDataChanges`);
    }
    await this._bridge!.importDynamicSchema(this._requestContext!);
    try {
      await this.pushDataChanges("Dynamic schema changes", ChangesType.Schema);
    } catch (error) {
      Logger.logError(loggerCategory, `${error} was thrown from pushDataChanges`);
    }
  }

  private async updateExistingData(sourcePath: string) {
    try {
      this._briefcaseDb?.concurrencyControl.startBulkMode();
      await this._bridge!.updateExistingData(sourcePath);
      await this._briefcaseDb?.concurrencyControl.endBulkMode(this._requestContext!);
      await this._briefcaseDb?.concurrencyControl.request(this._requestContext!);
      this._briefcaseDb?.saveChanges();
    } catch (error) {
      Logger.logError(loggerCategory, `${error} was thrown from the bridge`);
    }
    try {
      await this.pushDataChanges("Data changes", ChangesType.Regular);
    } catch (error) {
      Logger.logError(loggerCategory, `${error} was thrown from pushDataChanges`);
    }
  }
}
