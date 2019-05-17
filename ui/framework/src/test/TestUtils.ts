/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import {
  UiFramework,
  FrameworkReducer,
  FrameworkState,
  DeepReadonly,
  ActionsUnion,
  createAction,
  ConfigurableUiManager,
  ContentLayoutProps,
  ContentGroupProps,
} from "../ui-framework";
import { UiComponents } from "@bentley/ui-components";
import { UiCore } from "@bentley/ui-core";
import { Store, createStore, combineReducers } from "redux";
import { TestContentControl } from "./frontstage/FrontstageTestUtils";
import { ToolUiManager } from "../ui-framework/zones/toolsettings/ToolUiManager";
import { AccessToken, UserInfo } from "@bentley/imodeljs-clients";

// tslint:disable: completed-docs

export interface SampleAppState {
  placeHolder?: boolean;
}

const initialState: SampleAppState = {
  placeHolder: false,
};

export interface RootState {
  sampleAppState: SampleAppState;
  testDifferentFrameworkKey?: FrameworkState;
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

export class TestUtils {
  private static _i18n?: I18N;
  private static _uiFrameworkInitialized = false;
  public static store: Store<RootState>;

  private static _rootReducer: any;

  public static get i18n(): I18N {
    if (!TestUtils._i18n) {
      // const port = process.debugPort;
      TestUtils._i18n = new I18N();
    }
    return TestUtils._i18n;
  }

  public static async initializeUiFramework(testAlternateKey = false) {
    if (!TestUtils._uiFrameworkInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

      if (testAlternateKey) {
        // this is the rootReducer for the test application.
        this._rootReducer = combineReducers<RootState>({
          sampleAppState: SampleAppReducer,
          testDifferentFrameworkKey: FrameworkReducer,
        } as any);

      } else {
        // this is the rootReducer for the test application.
        this._rootReducer = combineReducers<RootState>({
          sampleAppState: SampleAppReducer,
          frameworkState: FrameworkReducer,
        } as any);
      }

      this.store = createStore(this._rootReducer,
        (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());

      if (testAlternateKey)
        await UiFramework.initialize(this.store, TestUtils.i18n, undefined, "testDifferentFrameworkKey");
      else
        await UiFramework.initialize(this.store, TestUtils.i18n);

      TestUtils.defineContentGroups();
      TestUtils.defineContentLayouts();

      await UiComponents.initialize(TestUtils.i18n);
      await UiCore.initialize(TestUtils.i18n);
      TestUtils._uiFrameworkInitialized = true;
    }
    ToolUiManager.clearCachedProperties();
  }

  public static terminateUiFramework() {
    UiCore.terminate();
    UiComponents.terminate();
    UiFramework.terminate();
    TestUtils._uiFrameworkInitialized = false;
  }

  /** Define Content Layouts referenced by Frontstages.
   */
  public static defineContentLayouts() {
    const contentLayouts: ContentLayoutProps[] = TestUtils.getContentLayouts();
    ConfigurableUiManager.loadContentLayouts(contentLayouts);
  }

  private static getContentLayouts(): ContentLayoutProps[] {
    const fourQuadrants: ContentLayoutProps = {
      id: "FourQuadrants",
      descriptionKey: "SampleApp:ContentLayoutDef.FourQuadrants",
      priority: 1000,
      horizontalSplit: {
        id: "FourQuadrants.MainHorizontal",
        percentage: 0.50,
        top: { verticalSplit: { id: "FourQuadrants.TopVert", percentage: 0.50, left: 0, right: 1 } },
        bottom: { verticalSplit: { id: "FourQuadrants.BottomVert", percentage: 0.50, left: 2, right: 3 } },
      },
    };

    const singleContent: ContentLayoutProps = {
      id: "SingleContent",
      descriptionKey: "SampleApp:ContentLayoutDef.SingleContent",
      priority: 100,
    };

    const contentLayouts: ContentLayoutProps[] = [];
    // in order to pick out by number of views for convenience.
    contentLayouts.push(singleContent, fourQuadrants);
    return contentLayouts;
  }

  /** Define Content Groups referenced by Frontstages.
   */
  private static defineContentGroups() {

    const testContentGroup1: ContentGroupProps = {
      id: "TestContentGroup1",
      contents: [
        {
          classId: TestContentControl,
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
        {
          classId: TestContentControl,
          applicationData: { label: "Content 2a", bgColor: "black" },
        },
        {
          classId: TestContentControl,
          applicationData: { label: "Content 3a", bgColor: "black" },
        },
        {
          classId: TestContentControl,
          applicationData: { label: "Content 4a", bgColor: "black" },
        },
      ],
    };

    const contentGroups: ContentGroupProps[] = [];
    contentGroups.push(testContentGroup1);
    ConfigurableUiManager.loadContentGroups(contentGroups);
  }

  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }

  /** Sleeps a specified number of milliseconds */
  public static sleep(milliseconds: number) {
    const start = new Date().getTime();
    for (let i = 0; i < 1e7; i++) {
      if ((new Date().getTime() - start) > milliseconds) {
        break;
      }
    }
  }

  /** Sleeps a specified number of milliseconds then flushes async operations */
  public static async tick(milliseconds: number) {
    TestUtils.sleep(milliseconds);
    await TestUtils.flushAsyncOperations();
  }

}

// cSpell:ignore testuser mailinator saml

export class MockAccessToken extends AccessToken {
  public constructor() { super(); this._samlAssertion = ""; }
  public getUserInfo(): UserInfo | undefined {
    const id = "596c0d8b-eac2-46a0-aa4a-b590c3314e7c";
    const email = { id: "testuser001@mailinator.com" };
    const profile = { firstName: "test", lastName: "user" };
    const organization = { id: "fefac5b-bcad-488b-aed2-df27bffe5786", name: "Bentley" };
    const featureTracking = { ultimateSite: "1004144426", usageCountryIso: "US" };
    return new UserInfo(id, email, profile, organization, featureTracking);
  }

  public toTokenString() { return ""; }
}

export default TestUtils;   // tslint:disable-line: no-default-export
