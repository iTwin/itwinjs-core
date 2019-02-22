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
}
