/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable-next-line:no-var-keyword
// tslint:disable-next-line:no-var-requires
// const prompt = require("prompt");
import { BriefcaseManager, IModelHost, IModelDb, OpenParams, IModelHostConfiguration, IModelAccessContext } from "@bentley/imodeljs-backend";
import { AccessToken, IModelQuery, IModel as HubIModel, ChangeSet } from "@bentley/imodeljs-clients";
import { OpenMode, Logger, LogLevel } from "@bentley/bentleyjs-core";
import * as path from "path";
import * as fs from "fs-extra";

Logger.initializeToConsole();
Logger.setLevel("imodeljs-clients", LogLevel.Trace);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

let useIModelHub: boolean;

export class DemoBackend {

  // Call this when starting up the backend
  public static initialize(useHub: boolean) {
    useIModelHub = useHub;

    Logger.initializeToConsole();
    Logger.setLevel("imodeljs-clients", LogLevel.Trace);

    const hostConfig = new IModelHostConfiguration();
    hostConfig.briefcaseCacheDir = path.join(__dirname, "briefcaseCache", useIModelHub ? "hub" : "bank");
    if (!fs.existsSync(hostConfig.briefcaseCacheDir))
      fs.mkdirsSync(hostConfig.briefcaseCacheDir);
    IModelHost.startup(hostConfig);
  }

  private static displayIModelInfo(iModel: HubIModel) {
    console.log(`iModel name: ${iModel.name} ID: ${iModel.wsgId}`);
    // *** TODO: Log more info
  }

  private static displayChangeSet(changeSet: ChangeSet) {
    // tslint:disable-next-line:no-console
    console.log(`\nChangeSet ID: ${changeSet.wsgId} parentId: ${changeSet.parentId} pushDate: ${changeSet.pushDate} containsSchemaChanges: ${changeSet.containsSchemaChanges} briefcaseId: ${changeSet.briefcaseId} description: ${changeSet.description}`);
  }

  // Example app backend method
  public async logChangeSets(context: IModelAccessContext, accessToken: AccessToken) {
    BriefcaseManager.setContext(context);

    const iModel: HubIModel = (await BriefcaseManager.hubClient.IModels().get(accessToken, context.projectId, new IModelQuery().byId(context.iModelId)))[0];
    console.log("\n");
    DemoBackend.displayIModelInfo(iModel);
    console.log("ChangeSets:\n");
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.ChangeSets().get(accessToken, context.iModelId);
    for (const changeSet of changeSets) {
      DemoBackend.displayChangeSet(changeSet);
    }
  }

  // Example app backend method
  public async downloadBriefcase(context: IModelAccessContext, accessToken: AccessToken) {
    BriefcaseManager.setContext(context);

    const imodel = await IModelDb.open(accessToken, context.projectId, context.iModelId, new OpenParams(OpenMode.Readonly));
    console.log(`Downloaded to ${imodel.briefcase.pathname}`);
  }
}
