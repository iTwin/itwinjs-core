/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyCloudRpcParams } from "@bentley/imodeljs-common";
import { IModelApp, IModelAppOptions, ToolAdmin } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import { UiCore } from "@bentley/ui-core";
import { UiComponents } from "@bentley/ui-components";
import initLogging from "./logging";
import initRpc from "./rpc";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { Tools } from "../tools/tools";
import { Notifications } from "./NotificationManager";
import { OidcClientHelper } from "./OidcClientHelper";
import { AppState } from "./AppState";
import { ErrorHandling } from "./ErrorHandling";

// initialize logging
initLogging();

export class SimpleEditorApp {

  private static _isReady: Promise<void>;
  private static _nameSpace: I18NNamespace;

  public static get ready(): Promise<void> { return this._isReady; }

  public static get namespace(): I18NNamespace { return this._nameSpace; }

  public static startup() {
    const options: IModelAppOptions = {
      notifications: new Notifications(),
    };
    IModelApp.startup(options);

    this._nameSpace = IModelApp.i18n.registerNamespace("SimpleEditor");

    Tools.registerTools();
    ToolAdmin.exceptionHandler = async (exc) => ErrorHandling.onUnexpectedError(exc);

    AppState.startup();

    // contains various initialization promises which need
    // to be fulfilled before the app is ready
    const initPromises = new Array<Promise<any>>();

    // initialize localization for the app
    initPromises.push(this._nameSpace.readFinished);

    // initialize UiCore
    initPromises.push(UiCore.initialize(IModelApp.i18n));

    // initialize UiComponents
    initPromises.push(UiComponents.initialize(IModelApp.i18n));

    // initialize Presentation
    initPromises.push(Presentation.initialize({
      activeLocale: IModelApp.i18n.languageList()[0],
    }));

    // initialize RPC communication
    initPromises.push(SimpleEditorApp.initializeRpc());

    // initialize OIDC
    initPromises.push(OidcClientHelper.initializeOidc());

    // the app is ready when all initialization promises are fulfilled
    this._isReady = Promise.all(initPromises).then(() => { });
  }

  private static async initializeRpc(): Promise<void> {
    const rpcParams = await this.getConnectionInfo();
    initRpc(rpcParams);
  }

  public static shutdown() {
    OidcClientHelper.shutdown();
    IModelApp.shutdown();
  }

  private static async getConnectionInfo(): Promise<BentleyCloudRpcParams | undefined> {
    return undefined;
  }
}
