/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Logger, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { Config } from "@bentley/imodeljs-clients";
import {
  BentleyCloudRpcManager, BentleyCloudRpcParams,
  ElectronRpcManager, ElectronRpcConfiguration,
  RpcOperation, IModelToken,
} from "@bentley/imodeljs-common";
// __PUBLISH_EXTRACT_START__ Presentation.Frontend.Imports
import { Presentation } from "@bentley/presentation-frontend";
// __PUBLISH_EXTRACT_END__
import { UiCore } from "@bentley/ui-core";
import { UiComponents } from "@bentley/ui-components";
import { MyAppFrontend } from "./api/MyAppFrontend";
import rpcs from "../common/Rpcs";
import App from "./components/app/App";
import "./index.css";

// initialize logging
Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Warning);

// initialize RPC
(function initRpc() {
  if (ElectronRpcConfiguration.isElectron) {
    ElectronRpcManager.initializeClient({}, rpcs);
  } else {
    const rpcParams: BentleyCloudRpcParams = { info: { title: "presentation-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" };
    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.RpcInterface
    const rpcConfiguration = BentleyCloudRpcManager.initializeClient(rpcParams, rpcs);
    // __PUBLISH_EXTRACT_END__
    for (const def of rpcConfiguration.interfaces())
      RpcOperation.forEach(def, (operation) => operation.policy.token = (request) => (request.findParameterOfType(IModelToken) || new IModelToken("test", "test", "test", "test", OpenMode.Readonly)));
  }
})();

export class SampleApp {
  private static _ready: Promise<void>;
  public static startup() {
    IModelApp.startup();
    const readyPromises = new Array<Promise<void>>();

    const localizationNamespace = IModelApp.i18n.registerNamespace("Sample");
    readyPromises.push(localizationNamespace.readFinished);

    // Configure a CORS proxy in development mode.
    if (process.env.NODE_ENV === "development")
      Config.App.set("imjs_dev_cors_proxy_server", `http://${window.location.hostname}:3001`); // By default, this will run on port 3001

    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.Initialization
    Presentation.initialize({
      // specify `clientId` so Presentation framework can share caches
      // between sessions for the same clients
      clientId: MyAppFrontend.getClientId(),

      // specify locale for localizing presentation data
      activeLocale: IModelApp.i18n.languageList()[0],
    });
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.SetSelectionScope
    Presentation.selection.scopes.activeScope = "top-assembly";
    // __PUBLISH_EXTRACT_END__

    readyPromises.push(UiCore.initialize(IModelApp.i18n));
    readyPromises.push(UiComponents.initialize(IModelApp.i18n));
    this._ready = Promise.all(readyPromises).then(() => { });
  }

  public static get ready(): Promise<void> { return this._ready; }
}

SampleApp.startup();

SampleApp.ready.then(() => { // tslint:disable-line:no-floating-promises
  ReactDOM.render(
    <App />,
    document.getElementById("root") as HTMLElement,
  );
});
