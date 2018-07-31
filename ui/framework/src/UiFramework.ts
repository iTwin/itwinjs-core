/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

import { I18N } from "@bentley/imodeljs-i18n";
import { DeploymentEnv } from "@bentley/imodeljs-clients";
import { LoginServices } from "./clientservices/LoginServices";
import { DefaultLoginServices } from "./clientservices/DefaultLoginServices";
import { ProjectServices } from "./clientservices/ProjectServices";
import { DefaultProjectServices } from "./clientservices/DefaultProjectServices";
import { IModelServices } from "./clientservices/IModelServices";
import { DefaultIModelServices } from "./clientservices/DefaultIModelServices";
import { Store } from "redux";

/**
 * Manages the Redux store, I18N service and iModel, Project and Login services for the ui-framework package.
 */
export class UiFramework {
  private constructor() { }

  private static _deploymentEnv: DeploymentEnv = "QA";
  private static _loginServices?: LoginServices;
  private static _projectServices?: ProjectServices;
  private static _iModelServices?: IModelServices;
  private static _i18n?: I18N;
  private static _store: Store<any>;
  private static _complaint: string = UiFramework._complaint;

  public static async initialize(store: Store<any>, i18n: I18N, deploymentEnv?: DeploymentEnv, loginServices?: LoginServices, projectServices?: ProjectServices, iModelServices?: IModelServices) {
    UiFramework._store = store;
    UiFramework._i18n = i18n;
    await UiFramework._i18n.registerNamespace("UiFramework").readFinished;
    UiFramework._deploymentEnv = deploymentEnv ? deploymentEnv : "QA";
    UiFramework._loginServices = loginServices ? loginServices : new DefaultLoginServices();
    UiFramework._projectServices = projectServices ? projectServices : new DefaultProjectServices(UiFramework._deploymentEnv);
    UiFramework._iModelServices = iModelServices ? iModelServices : new DefaultIModelServices();
  }

  public static get store(): Store<any> {
    if (!UiFramework._store)
      throw new Error(UiFramework._complaint);
    return UiFramework._store;
  }

  public static get i18n(): I18N {
    if (!UiFramework._i18n)
      throw new Error(UiFramework._complaint);
    return UiFramework._i18n;
  }

  public static get loginServices(): LoginServices {
    if (!UiFramework._loginServices)
      throw new Error(UiFramework._complaint);
    return UiFramework._loginServices!;
  }

  public static get projectServices(): ProjectServices {
    if (!UiFramework._projectServices)
      throw new Error(UiFramework._complaint);
    return UiFramework._projectServices!;
  }

  public static get iModelServices(): IModelServices {
    if (!UiFramework._iModelServices)
      throw new Error(UiFramework._complaint);
    return UiFramework._iModelServices!;
  }

}

export default UiFramework;
