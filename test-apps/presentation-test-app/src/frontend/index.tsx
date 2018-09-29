/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { Config as ClientConfig } from "@bentley/imodeljs-clients";
import {
  BentleyCloudRpcManager, BentleyCloudRpcParams,
  ElectronRpcManager, ElectronRpcConfiguration,
  RpcOperation, IModelToken,
} from "@bentley/imodeljs-common";
// __PUBLISH_EXTRACT_START__ Presentation.Frontend.Imports
import { Presentation } from "@bentley/presentation-frontend";
// __PUBLISH_EXTRACT_END__
import { UiComponents } from "@bentley/ui-components";
import rpcs from "../common/Rpcs";
import App from "./components/app/App";
import "./index.css";
import { UiCore } from "@bentley/ui-core/lib";

// initialize logging
Logger.initializeToConsole();

// initialize RPC
(function initRpc() {
  if (ElectronRpcConfiguration.isElectron) {
    ElectronRpcManager.initializeClient({}, rpcs);
  } else {
    const rpcParams: BentleyCloudRpcParams = { info: { title: "presentation-test-app", version: "v1.0" } };
    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.RpcInterface
    const rpcConfiguration = BentleyCloudRpcManager.initializeClient(rpcParams, rpcs);
    // __PUBLISH_EXTRACT_END__
    for (const def of rpcConfiguration.interfaces())
      RpcOperation.forEach(def, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test"));
  }
})();

// subclass of IModelApp needed to use IModelJs API
export class SampleApp extends IModelApp {
  private static _ready: Promise<void>;
  protected static onStartup() {
    const readyPromises = new Array<Promise<void>>();

    const localizationNamespace = IModelApp.i18n.registerNamespace("Sample");
    readyPromises.push(localizationNamespace.readFinished);

    // Configure a CORS proxy in development mode.
    if (process.env.NODE_ENV === "development")
      ClientConfig.devCorsProxyServer = `http://${window.location.hostname}:${process.env.CORS_PROXY_PORT}`;

    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.Initialization
    Presentation.initialize({
      activeLocale: IModelApp.i18n.languageList()[0],
    });
    // __PUBLISH_EXTRACT_END__

    readyPromises.push(UiCore.initialize(IModelApp.i18n));
    readyPromises.push(UiComponents.initialize(IModelApp.i18n));
    this._ready = Promise.all(readyPromises).then(() => { });
  }

  public static get ready(): Promise<void> { return this._ready; }
}

SampleApp.startup();

SampleApp.ready.then(() => {
  ReactDOM.render(
    <App />,
    document.getElementById("root") as HTMLElement,
  );
});
