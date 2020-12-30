/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./index.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
import {
  BentleyCloudRpcManager, BentleyCloudRpcParams, ElectronRpcConfiguration, ElectronRpcManager, RpcConfiguration,
} from "@bentley/imodeljs-common";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { PresentationUnitSystem } from "@bentley/presentation-common";
import { electronFrontendIpc } from "@bentley/electron-manager/lib/ElectronFrontendIpc";
// __PUBLISH_EXTRACT_START__ Presentation.Frontend.Imports
import { Presentation } from "@bentley/presentation-frontend";
// __PUBLISH_EXTRACT_END__
import { UiComponents } from "@bentley/ui-components";
import rpcs from "../common/Rpcs";
import { MyAppFrontend } from "./api/MyAppFrontend";
import App from "./components/app/App";

// initialize logging
Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Warning);

// initialize RPC
(function initRpc() {
  RpcConfiguration.developmentMode = true;
  if (ElectronRpcConfiguration.isElectron) {
    ElectronRpcManager.initializeClient({}, rpcs, electronFrontendIpc);
  } else {
    const rpcParams: BentleyCloudRpcParams = { info: { title: "presentation-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" };
    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.RpcInterface
    BentleyCloudRpcManager.initializeClient(rpcParams, rpcs);
    // __PUBLISH_EXTRACT_END__
  }
})();

export class SampleApp {
  private static _ready: Promise<void>;
  public static async startup(): Promise<void> {
    await IModelApp.startup();
    const readyPromises = new Array<Promise<void>>();

    const localizationNamespace = IModelApp.i18n.registerNamespace("Sample");
    readyPromises.push(localizationNamespace.readFinished);

    // Configure a CORS proxy in development mode.
    if (process.env.NODE_ENV === "development")
      Config.App.set("imjs_dev_cors_proxy_server", `http://${window.location.hostname}:3001`); // By default, this will run on port 3001

    readyPromises.push(this.initializePresentation());
    readyPromises.push(UiComponents.initialize(IModelApp.i18n));
    this._ready = Promise.all(readyPromises).then(() => { });
  }

  private static async initializePresentation() {
    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.Initialization
    await Presentation.initialize({
      // specify `clientId` so Presentation framework can share caches
      // between sessions for the same clients
      clientId: MyAppFrontend.getClientId(),

      // specify locale for localizing presentation data
      activeLocale: IModelApp.i18n.languageList()[0],

      // specify the preferred unit system
      activeUnitSystem: PresentationUnitSystem.Metric,
    });
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.SetSelectionScope
    Presentation.selection.scopes.activeScope = "top-assembly";
    // __PUBLISH_EXTRACT_END__
  }

  public static get ready(): Promise<void> { return this._ready; }
}

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await SampleApp.startup();

  await SampleApp.ready;
  ReactDOM.render(
    <App />,
    document.getElementById("root") as HTMLElement,
  );
})();
