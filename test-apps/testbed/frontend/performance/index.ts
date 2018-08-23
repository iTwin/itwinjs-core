/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as bodyParser from "body-parser";
import { IModelHost } from "@bentley/imodeljs-backend";
import { TestbedConfig/*, TestbedIpcMessage*/ } from "../../common/TestbedConfig";
// import { TestRpcImpl, TestRpcImpl2, TestRpcImpl3 } from "../../backend/TestRpcImpl";
// import { CONSTANTS } from "../../common/Testbed";
import { RpcConfiguration/*, IModelReadRpcInterface*/ } from "@bentley/imodeljs-common";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
// const compatibleVersion = IModelReadRpcInterface.version;

let pendingsSent = 0;
const pendingResponseQuota = 0;

RpcConfiguration.developmentMode = true;

// tslint:disable-next-line:no-var-requires
/*const { ipcMain } = require("electron");
ipcMain.on("testbed", (event: any, arg: any) => {
  const msg: TestbedIpcMessage = arg;
  if (msg.name === CONSTANTS.PENDING_RESPONSE_QUOTA_MESSAGE) {
    pendingResponseQuota = msg.value;
    pendingsSent = 0;
    event.returnValue = true;
  } else if (msg.name === CONSTANTS.REGISTER_TEST_RPCIMPL2_CLASS_MESSAGE) {
    TestRpcImpl2.register();
    TestRpcImpl2.instantiate();
    event.returnValue = true;
  } else if (msg.name === CONSTANTS.REPLACE_TEST_RPCIMPL2_INSTANCE_MESSAGE) {
    TestRpcImpl2.instantiate();
    event.returnValue = true;
  } else if (msg.name === CONSTANTS.UNREGISTER_TEST_RPCIMPL2_CLASS_MESSAGE) {
    TestRpcImpl2.unregister();
    event.returnValue = true;
  } else if (msg.name === CONSTANTS.SET_INCOMPATIBLE_INTERFACE_VERSION) {
    IModelReadRpcInterface.version = "0.0.0";
    event.returnValue = true;
  } else if (msg.name === CONSTANTS.RESTORE_COMPATIBLE_INTERFACE_VERSION) {
    IModelReadRpcInterface.version = compatibleVersion;
    event.returnValue = true;
  } else if (msg.name === CONSTANTS.RESTART_BACKEND) {
    IModelHost.shutdown();
    IModelHost.startup();
    event.returnValue = true;
  }
});*/

// Start the backend
IModelHost.startup();

// TestRpcImpl.register();
// TestRpcImpl3.register();
TestbedConfig.initializeRpcBackend();

Logger.initializeToConsole();
Logger.setLevel("imodeljs-backend.IModelReadRpcImpl", LogLevel.Error);  // Change to trace to debug

if (TestbedConfig.cloudRpc) {
  const app = express();
  app.use(bodyParser.text());
  app.use(express.static(__dirname + "/public"));
  app.get(TestbedConfig.swaggerURI, (req, res) => TestbedConfig.cloudRpc.protocol.handleOpenApiDescriptionRequest(req, res));

  app.post("*", (req, res) => {
    if (pendingResponseQuota && pendingsSent < pendingResponseQuota) {
      ++pendingsSent;
      res.status(202).send(`Pending Response #${pendingsSent}`);
      return;
    }

    pendingsSent = 0;
    TestbedConfig.cloudRpc.protocol.handleOperationPostRequest(req, res);
  });

  app.listen(TestbedConfig.serverPort);
}
