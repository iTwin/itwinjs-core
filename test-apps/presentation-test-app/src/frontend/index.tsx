/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./index.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { IModelApp, IModelAppOptions } from "@itwin/core-frontend";
import { BentleyCloudRpcManager } from "@itwin/core-common";
// __PUBLISH_EXTRACT_START__ Presentation.Frontend.Imports
import { createFavoritePropertiesStorage, DefaultFavoritePropertiesStorageTypes, Presentation } from "@itwin/presentation-frontend";
// __PUBLISH_EXTRACT_END__
import { UiComponents } from "@itwin/components-react";
import rpcInterfaces from "../common/Rpcs";
import App from "./components/app/App";

// initialize logging
Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Warning);

export class SampleApp {
  private static _ready: Promise<void>;
  public static async startup(): Promise<void> {
    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.RpcInterface.Options
    const iModelAppOpts: IModelAppOptions = {
      rpcInterfaces,
    };
    // __PUBLISH_EXTRACT_END__
    if (ProcessDetector.isElectronAppFrontend) {
      // __PUBLISH_EXTRACT_START__ Presentation.Frontend.IModelAppStartup
      await ElectronApp.startup({ iModelApp: iModelAppOpts });
      // __PUBLISH_EXTRACT_END__
    } else if (ProcessDetector.isBrowserProcess) {
      const rpcParams = { info: { title: "presentation-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" };
      await IModelApp.startup(iModelAppOpts);
      BentleyCloudRpcManager.initializeClient(rpcParams, iModelAppOpts.rpcInterfaces ?? []);
    }
    const readyPromises = new Array<Promise<void>>();

    const namespacePromise = IModelApp.localization.registerNamespace("Sample");
    if (namespacePromise !== undefined) {
      readyPromises.push(namespacePromise);
    }

    // Configure a CORS proxy in development mode.
    if (process.env.NODE_ENV === "development")
      process.env.IMJS_DEV_CORS_PROXY_SERVER = `http://${window.location.hostname}:3001`; // By default, this will run on port 3001

    readyPromises.push(this.initializePresentation());
    readyPromises.push(UiComponents.initialize(IModelApp.localization));
    this._ready = Promise.all(readyPromises).then(() => { });
  }

  private static async initializePresentation() {
    // __PUBLISH_EXTRACT_START__ Presentation.Frontend.Initialization
    await Presentation.initialize({
      presentation: {
        // specify locale for localizing presentation data, it can be changed afterwards
        activeLocale: IModelApp.localization.getLanguageList()[0],

        // specify the preferred unit system
        activeUnitSystem: "metric",
      },
      favorites: {
        storage: createFavoritePropertiesStorage(DefaultFavoritePropertiesStorageTypes.UserPreferencesStorage),
      },
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
