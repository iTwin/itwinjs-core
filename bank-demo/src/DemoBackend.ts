/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:no-console

import { BriefcaseManager, IModelHost, IModelDb, /*OpenParams,*/ IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { AccessToken, IModelQuery, IModelRepository, ChangeSet, Version } from "@bentley/imodeljs-clients";
// import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import * as path from "path";
import * as fs from "fs-extra";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

let useIModelHub: boolean;

export class DemoBackend {

  // Call this when starting up the backend
  public static initialize(useHub: boolean) {
    useIModelHub = useHub;

    // Logger.initializeToConsole();
    // Logger.setLevel("imodeljs-clients", LogLevel.Error);

    const hostConfig = new IModelHostConfiguration();
    hostConfig.briefcaseCacheDir = path.join(__dirname, "briefcaseCache", useIModelHub ? "hub" : "bank");
    if (!fs.existsSync(hostConfig.briefcaseCacheDir))
      fs.mkdirsSync(hostConfig.briefcaseCacheDir);
    IModelHost.startup(hostConfig);
  }

  private static displayIModelInfo(iModel: IModelRepository) {
    console.log(`name: ${iModel.name} ID: ${iModel.wsgId}`);
    // *** TODO: Log more info
  }

  private static displayChangeSet(changeSet: ChangeSet) {
    // tslint:disable-next-line:no-console
    console.log(`ID: ${changeSet.wsgId} parentId: ${changeSet.parentId} pushDate: ${changeSet.pushDate} containsSchemaChanges: ${changeSet.containsSchemaChanges} briefcaseId: ${changeSet.briefcaseId} description: ${changeSet.description}`);
  }

  private static displayVersion(version: Version) {
    // tslint:disable-next-line:no-console
    console.log(`name: ${version.name} changeSetId: ${version.changeSetId}`);
  }

  /*
  private static fmtElement(iModelDb: IModelDb, id: Id64): string {
    const el: Element = iModelDb.elements.getElement(id);
    let desc = `${el.classFullName} ${el.code.value}`;
    if (el.parent)
      desc += " { " + this.fmtElement(iModelDb, el.parent.id) + " }";
    return desc;
  }

  private static displayModel(model: Model) {
    // tslint:disable-next-line:no-console
    console.log(`name: ${model.name} modeledElement: ${this.fmtElement(model.iModel, model.modeledElement.id)}`);
  }
  */

  public async createNamedVersion(changeSetId: string, versionName: string, contextId: string, iModelId: string, accessToken: AccessToken) {
    BriefcaseManager.setClientFromIModelTokenContext(contextId);
    await BriefcaseManager.imodelClient.Versions().create(accessToken, iModelId, changeSetId, versionName);
  }

  public async logChangeSets(contextId: string, iModelId: string, accessToken: AccessToken) {
    BriefcaseManager.setClientFromIModelTokenContext(contextId);

    console.log("\niModel:");
    const iModel: IModelRepository = (await BriefcaseManager.imodelClient.IModels().get(accessToken, contextId, new IModelQuery().byId(iModelId)))[0];
    DemoBackend.displayIModelInfo(iModel);

    console.log("\nChangeSets:");
    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(accessToken, iModelId);
    for (const changeSet of changeSets) {
      DemoBackend.displayChangeSet(changeSet);
    }

    console.log("\nVersions:");
    const versions: Version[] = await BriefcaseManager.imodelClient.Versions().get(accessToken, iModelId);
    for (const version of versions) {
      DemoBackend.displayVersion(version);
    }

    /*
    console.log("\nModels:");
    const imodelDb = await IModelDb.open(accessToken, context.projectId, context.iModelId, OpenParams.pullAndPush());
    imodelDb.withPreparedStatement("select ecinstanceid as id from bis.Model", (stmt: ECSqlStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        DemoBackend.displayModel(imodelDb.models.getModel(stmt.getValue(0).getId()));
    });
    */
  }

  public async downloadBriefcase(contextId: string, iModelId: string, accessToken: AccessToken) {
    const imodel = await IModelDb.open(accessToken, contextId, iModelId /*, OpenParams.pullAndPush()*/);
    console.log(`Briefcase: ${imodel.briefcase.pathname}`);
  }
}
