/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelHost } from "@bentley/imodeljs-backend";
import { Logger } from "@bentley/bentleyjs-core";

// tslint:disable:no-var-requires
import { app } from "electron";

// Start the backend
IModelHost.startup();
Logger.initializeToConsole(); // configure logging for imodeljs-core

// Now switch as required to either Electron or Webserver.
if (app) {
  require("./electron/ElectronMain");
} else {
  require("./web/WebServer");
}
