/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */
import { OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import { I18N } from "@bentley/imodeljs-i18n";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { ProjectServices } from "./clientservices/ProjectServices";
import { DefaultProjectServices } from "./clientservices/DefaultProjectServices";
import { IModelServices } from "./clientservices/IModelServices";
import { DefaultIModelServices } from "./clientservices/DefaultIModelServices";
import { Store } from "redux";
import { OidcClientWrapper } from "./oidc/OidcClientWrapper";
import { AnalysisAnimationTool } from "./tools/AnalysisAnimation";

/**
 * Manages the Redux store, I18N service and iModel, Project and Login services for the ui-framework package.
 */
export class UiFramework {
  private static _projectServices?: ProjectServices;
  private static _iModelServices?: IModelServices;
  private static _i18n?: I18N;
  private static _store?: Store<any>;
  private static _complaint = "UiFramework not initialized";

  public static async initialize(store: Store<any>, i18n: I18N, oidcConfig?: OidcFrontendClientConfiguration, projectServices?: ProjectServices, iModelServices?: IModelServices) {
    UiFramework._store = store;
    UiFramework._i18n = i18n;

    const frameworkNamespace = UiFramework._i18n.registerNamespace("UiFramework");
    const readFinishedPromise = frameworkNamespace.readFinished;

    // register UiFramework provided tools
    AnalysisAnimationTool.register(frameworkNamespace);

    UiFramework._projectServices = projectServices ? projectServices : new DefaultProjectServices();
    UiFramework._iModelServices = iModelServices ? iModelServices : new DefaultIModelServices();

    if (oidcConfig) {
      const initOidcPromise = OidcClientWrapper.initialize(new ActivityLoggingContext(Guid.createValue()), oidcConfig);
      return Promise.all([readFinishedPromise, initOidcPromise]);
    }
    return readFinishedPromise;
  }

  public static terminate() {
    UiFramework._store = undefined;
    if (UiFramework._i18n)
      UiFramework._i18n.unregisterNamespace("UiFramework");
    UiFramework._i18n = undefined;
    UiFramework._projectServices = undefined;
    UiFramework._iModelServices = undefined;
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
