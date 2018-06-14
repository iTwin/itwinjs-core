/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import * as commander from "commander";
// import * as chalk from "chalk";
import { BriefcaseManager, IModelHost, IModelHostConfiguration, IModelDb, OpenParams } from "@bentley/imodeljs-backend";
import { AccessToken, IModelQuery, IModel, ChangeSet, IModelBankBaseHandler } from "@bentley/imodeljs-clients";
import { IModelHubIntegration } from "./IModelHubIntegration";
import { OpenMode, Logger, LogLevel } from "@bentley/bentleyjs-core";

const projectName = "iModelJsTest";
let initialized: boolean;
let accessToken: AccessToken;
let projectId: string;
const useIModelHub = false;

Logger.initializeToConsole();
Logger.setLevel("imodeljs-clients", LogLevel.Trace);

async function initialize() {
  if (initialized)
    return;
  if (useIModelHub) {
    await IModelHubIntegration.startup(projectName);
    projectId = IModelHubIntegration.testProjectId;
    accessToken = IModelHubIntegration.accessToken;
  } else {
    const config = new IModelHostConfiguration();
    config.iModelServerHandler = new IModelBankBaseHandler("https://localhost:3001");
    IModelHost.startup(config);
    projectId = "dummy";
    accessToken = { toTokenString: () => "" } as AccessToken;
  }
  initialized = true;
}

function displayIModelInfo(iModel: IModel) {
  // tslint:disable-next-line:no-console
  console.log(`\nname: ${iModel.name}\nID: ${iModel.wsgId}`);
  // *** TODO: Log more info
}

function displayChangeSet(changeSet: ChangeSet) {
  // tslint:disable-next-line:no-console
  console.log(`\nID: ${changeSet.wsgId} parentId: ${changeSet.parentId} pushDate: ${changeSet.pushDate} containsSchemaChanges: ${changeSet.containsSchemaChanges} briefcaseId: ${changeSet.briefcaseId} description: ${changeSet.description}`);
}

async function queryIModelByName(iModelName: string | undefined) {
  await initialize();
  const q = iModelName ? new IModelQuery().byName(iModelName) : undefined;
  const iModels = await BriefcaseManager.hubClient.IModels().get(accessToken, projectId, q);
  for (const iModel of iModels) {
    displayIModelInfo(iModel);
  }
}

async function logCommand(imodelId: string) {
  await initialize();
  const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.ChangeSets().get(accessToken, imodelId);
  for (const changeSet of changeSets) {
    displayChangeSet(changeSet);
  }
}

async function downloadCommand(imodelId: string) {
  await initialize();
  // TBD: const version = new IModelVersion()
  const imodel = await IModelDb.open(accessToken, projectId, imodelId, new OpenParams(OpenMode.Readonly));
  // tslint:disable-next-line:no-console
  console.log(`Downloaded to ${imodel.briefcase.pathname}`);
}

const program = new commander.Command("bank-demo");

program.description("bank-demo");
program.version("0.0.1");
program.command("findimodel [imodelname]").alias("fi").description("list all iModels or find an iModel by its name").action(async (imodelname) => await queryIModelByName(imodelname));
program.command("log <imodelid>").description("list changeSets for an iModel").action(async (imodelid) => await logCommand(imodelid));
program.command("download <imodelid>").alias("dl").description("download an iModel").action(async (imodelid) => await downloadCommand(imodelid));
program.parse(process.argv);

if (process.argv.length === 0)
  program.help();
