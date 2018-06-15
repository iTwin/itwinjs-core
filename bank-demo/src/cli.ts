/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import * as commander from "commander";
// import * as chalk from "chalk";
import { BriefcaseManager, IModelHost, IModelDb, OpenParams } from "@bentley/imodeljs-backend";
import { AccessToken, IModelQuery, IModel as HubIModel, ChangeSet, IModelBankWsgClient } from "@bentley/imodeljs-clients";
import { OpenMode, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BentleyCloudProject } from "./BentleyCloudProject";
import { NopProject } from "./NopProject";

const useIModelHub = false;

let accessToken: AccessToken; // This is an opaque piece of data that the iModel server passes back to the validator, when it needs to check permissions
let projectId: string;        // This is used only as a namespace to help the iModel server identify the iModel.

Logger.initializeToConsole();
Logger.setLevel("imodeljs-clients", LogLevel.Trace);

IModelHost.startup();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

// Simulate user login in the app's frontend:
let userLoggedIn: boolean;
async function simulateUserLogin() {
  if (userLoggedIn)
    return;

  if (useIModelHub) {
    accessToken = await BentleyCloudProject.getAccessToken(); // Not shown: user supplies credentials and picks an environment
    projectId = await BentleyCloudProject.queryProjectIdByName(accessToken, "iModelJsTest"); // simulate using picking a Connect project
  } else {
    // iModelBank
    accessToken = NopProject.getAccessToken();
    projectId = ""; // projectId is meaningless to iModelBank.
  }
  userLoggedIn = true;
}

async function initialize() {
  await simulateUserLogin();
}

async function configureIModelServer(iModelId: string): Promise<void> {
  await initialize();
  if (useIModelHub)
    return;
  // iModelBank
  const bankUrl = await NopProject.startImodelServer(iModelId);
  IModelHost.configuration!.iModelServerHandler = new IModelBankWsgClient(bankUrl, accessToken);
}

function displayIModelInfo(iModel: HubIModel) {
  // tslint:disable-next-line:no-console
  console.log(`\nname: ${iModel.name}\nID: ${iModel.wsgId}`);
  // *** TODO: Log more info
}

function displayChangeSet(changeSet: ChangeSet) {
  // tslint:disable-next-line:no-console
  console.log(`\nID: ${changeSet.wsgId} parentId: ${changeSet.parentId} pushDate: ${changeSet.pushDate} containsSchemaChanges: ${changeSet.containsSchemaChanges} briefcaseId: ${changeSet.briefcaseId} description: ${changeSet.description}`);
}

async function logCommand(iModelId: string) {
  await configureIModelServer(iModelId);
  const iModel: HubIModel = (await BriefcaseManager.hubClient.IModels().get(accessToken, projectId, new IModelQuery().byId(iModelId)))[0];
  displayIModelInfo(iModel);
  // tslint:disable-next-line:no-console
  console.log("-----------------------------------\n");
  const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.ChangeSets().get(accessToken, iModelId);
  for (const changeSet of changeSets) {
    displayChangeSet(changeSet);
  }
}

async function downloadCommand(iModelId: string) {
  await configureIModelServer(iModelId);
  // TBD: const version = new IModelVersion()
  const imodel = await IModelDb.open(accessToken, projectId, iModelId, new OpenParams(OpenMode.Readonly));
  // tslint:disable-next-line:no-console
  console.log(`Downloaded to ${imodel.briefcase.pathname}`);
}

const program = new commander.Command("bank-demo");

program.description("bank-demo");
program.version("0.0.1");
program.once("", async () => { await simulateUserLogin(); });
program.command("log <imodelid>").description("list changeSets for an iModel").action(async (imodelid) => await logCommand(imodelid));
program.command("download <imodelid>").alias("dl").description("download an iModel").action(async (imodelid) => await downloadCommand(imodelid));
program.parse(process.argv);

if (process.argv.length === 0)
  program.help();
