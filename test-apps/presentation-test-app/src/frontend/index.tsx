import * as React from "react";
import * as ReactDOM from "react-dom";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { Config as ClientConfig } from "@bentley/imodeljs-clients";
import {
  BentleyCloudRpcManager, BentleyCloudRpcParams,
  ElectronRpcManager, ElectronRpcConfiguration,
  StandaloneIModelRpcInterface, IModelReadRpcInterface, IModelTileRpcInterface,
  RpcOperation, IModelToken,
} from "@bentley/imodeljs-common";
// __PUBLISH_EXTRACT_START__ Frontend.Imports
import { PresentationRpcInterface } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
// __PUBLISH_EXTRACT_END__
import { UiComponents } from "@bentley/ui-components";
import initLogging from "./api/logging";
import SampleRpcInterface from "../common/SampleRpcInterface";
import App from "./components/app/App";
import "./index.css";

// initialize logging
initLogging();

// initialize RPC
(function initRpc() {
  const otherRpcInterfaces = [StandaloneIModelRpcInterface, IModelReadRpcInterface, IModelTileRpcInterface, SampleRpcInterface];
  if (ElectronRpcConfiguration.isElectron) {
    ElectronRpcManager.initializeClient({}, [...otherRpcInterfaces, PresentationRpcInterface]);
  } else {
    const rpcParams: BentleyCloudRpcParams = { info: { title: "my-app", version: "v1.0" } };
    // __PUBLISH_EXTRACT_START__ Frontend.Initialization.RpcInterface
    const rpcConfiguration = BentleyCloudRpcManager.initializeClient(rpcParams, [...otherRpcInterfaces, PresentationRpcInterface]);
    // __PUBLISH_EXTRACT_END__
    for (const def of rpcConfiguration.interfaces())
      RpcOperation.forEach(def, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test"));
  }
})();

// subclass of IModelApp needed to use IModelJs API
export class SampleApp extends IModelApp {
  private static _localizationNamespace: I18NNamespace;

  protected static onStartup() {
    this._localizationNamespace = IModelApp.i18n.registerNamespace("Sample");

    // Configure a CORS proxy in development mode.
    if (process.env.NODE_ENV === "development")
      ClientConfig.devCorsProxyServer = `http://${window.location.hostname}:${process.env.CORS_PROXY_PORT}`;

    // __PUBLISH_EXTRACT_START__ Frontend.Initialization.Presentation
    Presentation.initialize({
      activeLocale: IModelApp.i18n.languageList()[0],
    });
    // __PUBLISH_EXTRACT_END__

    UiComponents.initialize(IModelApp.i18n);
  }

  public static get ready(): Promise<void> { return this._localizationNamespace.readFinished; }
}

SampleApp.startup();

SampleApp.ready.then(() => {
  ReactDOM.render(
    <App />,
    document.getElementById("root") as HTMLElement,
  );
});
