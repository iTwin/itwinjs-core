/*--------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *-------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { UiFramework, FrameworkReducer, FrameworkState } from "../src/index";
import { UiComponents } from "@bentley/ui-components";
import { UiCore } from "@bentley/ui-core";
import { Store, createStore, combineReducers } from "redux";
import { WebStorageStateStore, InMemoryWebStorage } from "oidc-client";
import { DeepReadonly, ActionsUnion, createAction } from "../src/utils/redux-ts";
import { OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import { Config } from "@bentley/imodeljs-clients";

export interface SampleAppState {
  placeHolder?: boolean;
}

const initialState: SampleAppState = {
  placeHolder: false,
};

export interface RootState {
  sampleAppState: SampleAppState;
  frameworkState?: FrameworkState;
}

// tslint:disable-next-line:variable-name
export const SampleAppActions = {
  example: () => createAction("SampleApp:EXAMPLE"),
};

export type SampleAppActionsUnion = ActionsUnion<typeof SampleAppActions>;

function SampleAppReducer(state: SampleAppState = initialState, action: SampleAppActionsUnion): DeepReadonly<SampleAppState> {
  switch (action.type) {
    case "SampleApp:EXAMPLE": {
      return { ...state, placeHolder: true };
    }
  }

  return state;
}

// TODO: Temporary fix to failing tests
Config.App.merge({
  frontend_test_oidc_client_id: "imodeljs-spa-test-2686",
  frontend_test_oidc_redirect_path: "/signin-oidc",
  imjs_oidc_url: "https://qa-imsoidc.bentley.com/",
});

export default class TestUtils {
  private static _i18n?: I18N;
  private static _uiFrameworkInitialized = false;
  public static store: Store<RootState>;

  private static _rootReducer: any;

  public static get i18n(): I18N {
    if (!TestUtils._i18n) {
      // const port = process.debugPort;
      // const i18nOptions = { urlTemplate: "http://localhost:" + port + "/locales/{{lng}}/{{ns}}.json" };
      TestUtils._i18n = new I18N([], "" /*, i18nOptions*/);
    }
    return TestUtils._i18n;
  }

  private static createOidcConfiguration(): OidcFrontendClientConfiguration {
    const oidcConfig: OidcFrontendClientConfiguration = {
      clientId: Config.App.get("frontend_test_oidc_client_id"),
      redirectUri: "http://localhost:3000" + Config.App.get("frontend_test_oidc_redirect_path"),
      userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
      stateStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    };
    return oidcConfig;
  }

  public static async initializeUiFramework() {
    if (!TestUtils._uiFrameworkInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

      // this is the rootReducer for the sample application.
      this._rootReducer = combineReducers<RootState>({
        sampleAppState: SampleAppReducer,
        frameworkState: FrameworkReducer,
      } as any);

      this.store = createStore(this._rootReducer,
        (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());

      const oidcConfig = TestUtils.createOidcConfiguration();
      await UiFramework.initialize(this.store, TestUtils.i18n, oidcConfig);
      await UiComponents.initialize(TestUtils.i18n);
      await UiCore.initialize(TestUtils.i18n);
      TestUtils._uiFrameworkInitialized = true;
    }
  }
}
