/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { UiError } from "@itwin/appui-abstract";
import { ActionCreatorsObject, ActionsUnion, createAction, FrameworkReducer, ReducerRegistryInstance, SYSTEM_PREFERRED_COLOR_THEME, WIDGET_OPACITY_DEFAULT } from "../../appui-react";
import { StateManager } from "../../appui-react/redux/StateManager";
import { ConfigurableUiActions, ConfigurableUiReducer, ConfigurableUiState } from "../../appui-react/configurableui/state";
import { SnapMode } from "@itwin/core-frontend";

// Fake state for the host app
interface IAppState {
  selectedItem?: string;
  dialogVisible?: boolean;
}

class AppStateManager {
  private static _initialState: IAppState = {
    dialogVisible: false,
  };

  public static reducerName = "appState";

  public static SET_APP_DIALOG_VISIBLE = AppStateManager.createActionName("SET_APP_DIALOG_VISIBLE");
  public static SET_APP_SELECTED_ITEM = AppStateManager.createActionName("SET_APP_SELECTED");

  private static _appActions: ActionCreatorsObject = {
    setDialogVisible: (dialogVisible: boolean) =>
      createAction(AppStateManager.SET_APP_DIALOG_VISIBLE, dialogVisible),
    setSelectedItem: (selectedItem: string) =>
      createAction(AppStateManager.SET_APP_SELECTED_ITEM, selectedItem),
  };

  private static createActionName(name: string) {
    // convert to lower case so it can serve as a sync event when called via UiFramework.dispatchActionToStore
    return `${AppStateManager.reducerName}:${name}`.toLowerCase();
  }

  // reducer
  public static appReducer(
    state: IAppState = AppStateManager._initialState,
    action: any,
  ): IAppState {
    type AppActionsUnion = ActionsUnion<typeof AppStateManager._appActions>;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const appActionsParam = action as AppActionsUnion;

    switch (appActionsParam.type) {
      case AppStateManager.SET_APP_DIALOG_VISIBLE:
        return { ...state, dialogVisible: action.payload };
      case AppStateManager.SET_APP_SELECTED_ITEM:
        return { ...state, selectedItem: action.payload };
      default:
        return state;
    }
  }
}

// Fake state for a extension
interface ExtensionState {
  selectedItem?: string;
  dialogVisible?: boolean;
}

class ExtensionStateManager {
  private static _initialState: ExtensionState = {
    dialogVisible: false,
  };

  private static _reducerName = "extension_state";

  public static SET_EXTENSION_DIALOG_VISIBLE = ExtensionStateManager.createActionName("SET_EXTENSION_DIALOG_VISIBLE");
  public static SET_EXTENSION_SELECTED_ITEM = ExtensionStateManager.createActionName("SET_EXTENSION_SELECTED");

  private static _extensionActions: ActionCreatorsObject = {
    setDialogVisible: (dialogVisible: boolean) =>
      createAction(ExtensionStateManager.SET_EXTENSION_DIALOG_VISIBLE, dialogVisible),
    setSelectedItem: (selectedItem: string) =>
      createAction(ExtensionStateManager.SET_EXTENSION_SELECTED_ITEM, selectedItem),
  };

  private static createActionName(name: string) {
    // convert to lower case so it can serve as a sync event when called via UiFramework.dispatchActionToStore
    return `${ExtensionStateManager._reducerName}:${name}`.toLowerCase();
  }

  // reducer
  public static extensionReducer(
    state: ExtensionState = ExtensionStateManager._initialState,
    action: any,
  ): ExtensionState {
    type ExtensionActionsUnion = ActionsUnion<typeof ExtensionStateManager._extensionActions>;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const extensionActionsParam = action as ExtensionActionsUnion;

    switch (extensionActionsParam.type) {
      case ExtensionStateManager.SET_EXTENSION_DIALOG_VISIBLE:
        return { ...state, dialogVisible: action.payload };
      case ExtensionStateManager.SET_EXTENSION_SELECTED_ITEM:
        return { ...state, selectedItem: action.payload };
      default:
        return state;
    }
  }

  public static initialize() {
    ReducerRegistryInstance.registerReducer(
      ExtensionStateManager._reducerName,
      ExtensionStateManager.extensionReducer,
    );
  }
}

describe("StateManager", () => {
  afterEach(() => {
    ReducerRegistryInstance.clearReducers();
    StateManager.clearStore();
  });

  it("should not be to access store if StateManager has not been created", () => {
    expect(() => StateManager.store).to.throw(UiError);
  });

  it("should return undefined if StateManager has not been created", () => {
    expect(StateManager.state).to.be.undefined;
  });

  it("should have access to Framework Reducer by default", () => {
    const testState = new StateManager();
    expect(testState).to.exist;
    const currentState = StateManager.state;
    expect(currentState.hasOwnProperty("frameworkState")).to.be.true;
  });

  it("should allow initialization with app Reducer", () => {
    const testState = new StateManager({ appState: AppStateManager.appReducer });
    expect(testState).to.exist;
    const currentState = StateManager.state;
    expect(currentState.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState.hasOwnProperty("appState")).to.be.true;
  });

  it("should allow initialization with defaults that include frameworkState", () => {
    const testState = new StateManager({ appState: AppStateManager.appReducer, frameworkState: FrameworkReducer });
    expect(testState).to.exist;
    const currentState = StateManager.state;
    expect(currentState.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState.hasOwnProperty("appState")).to.be.true;
  });

  it("should see extension state once extension reducer is registered", () => {
    const testState = new StateManager({ appState: AppStateManager.appReducer });
    expect(testState).to.exist;
    let currentState = StateManager.state;
    expect(currentState.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState.hasOwnProperty("appState")).to.be.true;

    ExtensionStateManager.initialize();
    currentState = StateManager.state;
    expect(currentState.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState.hasOwnProperty("appState")).to.be.true;
    expect(currentState.hasOwnProperty("extension_state")).to.be.true;
  });

  it("should see extension state once extension reducer is registered (using store property)", () => {
    const testState = new StateManager({ appState: AppStateManager.appReducer });
    expect(testState).to.exist;
    let currentState = StateManager.store.getState();
    expect(currentState.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState.hasOwnProperty("appState")).to.be.true;

    ExtensionStateManager.initialize();
    currentState = StateManager.store.getState();
    expect(currentState.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState.hasOwnProperty("appState")).to.be.true;
    expect(currentState.hasOwnProperty("extension_state")).to.be.true;
  });

});

describe("ConfigurableUiReducer", () => {
  it("should process actions", () => {
    // exercise the ConfigurableUiActions
    const initialState: ConfigurableUiState = {
      snapMode: SnapMode.NearestKeypoint as number,
      toolPrompt: "",
      theme: SYSTEM_PREFERRED_COLOR_THEME,
      widgetOpacity: WIDGET_OPACITY_DEFAULT,
      useDragInteraction: false,
      frameworkVersion: "2",
    };

    let outState = ConfigurableUiReducer(initialState, ConfigurableUiActions.setDragInteraction(true));
    expect(outState.useDragInteraction).to.be.true;

    outState = ConfigurableUiReducer(initialState, ConfigurableUiActions.setToolPrompt("Hello-From-Tool"));
    expect(outState.toolPrompt).to.be.eql("Hello-From-Tool");

    outState = ConfigurableUiReducer(initialState, ConfigurableUiActions.setTheme("dark"));
    expect(outState.theme).to.be.eql("dark");

    outState = ConfigurableUiReducer(initialState, ConfigurableUiActions.setWidgetOpacity(.75));
    expect(outState.widgetOpacity).to.be.eql(.75);

    outState = ConfigurableUiReducer(initialState, ConfigurableUiActions.setSnapMode(SnapMode.Center));
    expect(outState.snapMode).to.be.eql(SnapMode.Center);

    outState = ConfigurableUiReducer(initialState, ConfigurableUiActions.setFrameworkVersion("1"));
    expect(outState.frameworkVersion).to.be.eql("1");
  });
});
