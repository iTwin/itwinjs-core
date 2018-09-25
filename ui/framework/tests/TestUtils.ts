/*--------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *-------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { UiFramework } from "../src/index";
import { UiComponents } from "@bentley/ui-components";
import { UiCore } from "@bentley/ui-core";
import { Store, createStore, combineReducers } from "redux";
import { UserManagerSettings, WebStorageStateStore, InMemoryWebStorage } from "oidc-client";
import { DeepReadonly, ActionsUnion, createAction } from "../src/utils/redux-ts";

export interface SampleAppState {
  placeHolder?: boolean;
}

const initialState: SampleAppState = {
  placeHolder: false,
};

export interface RootState {
  sampleAppState: SampleAppState;
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

export default class TestUtils {
  private static _i18n?: I18N;
  private static _uiFrameworkInitialized = false;
  private static _store: Store<RootState>;
  private static _rootReducer: any;

  public static get i18n(): I18N {
    if (!TestUtils._i18n) {
      // const port = process.debugPort;
      // const i18nOptions = { urlTemplate: "http://localhost:" + port + "/locales/{{lng}}/{{ns}}.json" };
      TestUtils._i18n = new I18N([], "" /*, i18nOptions*/);
    }
    return TestUtils._i18n;
  }

  private static createOidcSettings(): UserManagerSettings {
    const oidcSettings: UserManagerSettings = {
      authority: "https://qa-imsoidc.bentley.com/",
      client_id: "imodeljs-spa-test-2686",
      redirect_uri: "http://localhost:3000/signin-oidc",
      response_type: "id_token token",
      scope: "openid email profile organization feature_tracking imodelhub rbac-service context-registry-service",
    };

    const stateStoreStorage = new InMemoryWebStorage();
    const userStoreStorage = new InMemoryWebStorage();

    (oidcSettings as any).stateStore = new WebStorageStateStore({ store: stateStoreStorage });
    (oidcSettings as any).userStore = new WebStorageStateStore({ store: userStoreStorage });

    return oidcSettings;
  }

  public static async initializeUiFramework() {
    if (!TestUtils._uiFrameworkInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

      this._rootReducer = combineReducers<RootState>({
        sampleAppState: SampleAppReducer,
      });

      this._store = createStore(this._rootReducer,
        (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());

      const oidcSettings = TestUtils.createOidcSettings();
      await UiFramework.initialize(this._store, TestUtils.i18n, oidcSettings);
      await UiComponents.initialize(TestUtils.i18n);
      await UiCore.initialize(TestUtils.i18n);
      TestUtils._uiFrameworkInitialized = true;
    }
  }
}
