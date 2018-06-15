/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable-next-line:no-var-keyword
// tslint:disable-next-line:no-var-requires
// const prompt = require("prompt");
import { BriefcaseManager, IModelHost, IModelDb, OpenParams } from "@bentley/imodeljs-backend";
import { AccessToken, IModelQuery, IModel as HubIModel, ChangeSet, IModelBankWsgClient } from "@bentley/imodeljs-clients";
import { OpenMode, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BentleyCloudProject } from "./BentleyCloudProject";
import { NopProject } from "./NopProject";

const useIModelHub = false;

let iModelId: string;
let projectId: string;        // This is used only as a namespace to help the iModel server identify the iModel.
let accessToken: AccessToken; // This is an opaque piece of data that the iModel server passes back to the validator, when it needs to check permissions

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

async function configureIModelServer(): Promise<void> {
  if (useIModelHub)
    return;
  // iModelBank
  const bankUrl = await NopProject.startImodelServer(iModelId);
  IModelHost.configuration!.iModelServerHandler = new IModelBankWsgClient(bankUrl, accessToken);
}

function displayIModelInfo(iModel: HubIModel) {
  console.log(`\nname: ${iModel.name}\nID: ${iModel.wsgId}`);
  // *** TODO: Log more info
}

function displayChangeSet(changeSet: ChangeSet) {
  // tslint:disable-next-line:no-console
  console.log(`\nID: ${changeSet.wsgId} parentId: ${changeSet.parentId} pushDate: ${changeSet.pushDate} containsSchemaChanges: ${changeSet.containsSchemaChanges} briefcaseId: ${changeSet.briefcaseId} description: ${changeSet.description}`);
}

async function logCommand() {
  const iModel: HubIModel = (await BriefcaseManager.hubClient.IModels().get(accessToken, projectId, new IModelQuery().byId(iModelId)))[0];
  displayIModelInfo(iModel);
  console.log("-----------------------------------\n");
  const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.ChangeSets().get(accessToken, iModelId);
  for (const changeSet of changeSets) {
    displayChangeSet(changeSet);
  }
}

async function downloadCommand() {
  const imodel = await IModelDb.open(accessToken, projectId, iModelId, new OpenParams(OpenMode.Readonly));
  console.log(`Downloaded to ${imodel.briefcase.pathname}`);
}

async function processCommand(cmd: string) {
  if (cmd === "log") {
    logCommand();
  } else {
    if (cmd === "download") {
      downloadCommand();
    }
  }
}

if (process.argv.length !== 3) {
  console.log(`syntax: ${process.argv0} <imodelid> <cmd> [args]`);
  process.exit(1);
}

iModelId = process.argv[2];

/*
prompt.start();

prompt.get([">"], async (err: Error, result: any): Promise<void> => {
  if (err) {
    console.log(err.message);
  } else {
    await processCommand(result);
  }
});
*/

simulateUserLogin()
  .then(() => configureIModelServer())
  .then(() => processCommand("log"))
  .then(() => processCommand("download"))
  .then(() => console.log("end of demo"));
