/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { createAction, ActionsUnion, ActionCreatorsObject, ReducerRegistryInstance, FrameworkReducer } from "../../ui-framework";
import { StateManager } from "../../ui-framework/redux/StateManager";
import { UiError } from "@bentley/ui-abstract";

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

// Fake state for a plugin
interface IPluginState {
  selectedItem?: string;
  dialogVisible?: boolean;
}

class PluginStateManager {
  private static _initialState: IPluginState = {
    dialogVisible: false,
  };

  private static _reducerName = "plugin_state";

  public static SET_PLUGIN_DIALOG_VISIBLE = PluginStateManager.createActionName("SET_PLUGIN_DIALOG_VISIBLE");
  public static SET_PLUGIN_SELECTED_ITEM = PluginStateManager.createActionName("SET_PLUGIN_SELECTED");

  private static _pluginActions: ActionCreatorsObject = {
    setDialogVisible: (dialogVisible: boolean) =>
      createAction(PluginStateManager.SET_PLUGIN_DIALOG_VISIBLE, dialogVisible),
    setSelectedItem: (selectedItem: string) =>
      createAction(PluginStateManager.SET_PLUGIN_SELECTED_ITEM, selectedItem),
  };

  private static createActionName(name: string) {
    // convert to lower case so it can serve as a sync event when called via UiFramework.dispatchActionToStore
    return `${PluginStateManager._reducerName}:${name}`.toLowerCase();
  }

  // reducer
  public static pluginReducer(
    state: IPluginState = PluginStateManager._initialState,
    action: any,
  ): IPluginState {
    type PluginActionsUnion = ActionsUnion<typeof PluginStateManager._pluginActions>;

    const pluginActionsParam = action as PluginActionsUnion;

    switch (pluginActionsParam.type) {
      case PluginStateManager.SET_PLUGIN_DIALOG_VISIBLE:
        return { ...state, dialogVisible: action.payload };
      case PluginStateManager.SET_PLUGIN_SELECTED_ITEM:
        return { ...state, selectedItem: action.payload };
      default:
        return state;
    }
  }

  public static initialize() {
    ReducerRegistryInstance.registerReducer(
      PluginStateManager._reducerName,
      PluginStateManager.pluginReducer,
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
    expect(currentState!.hasOwnProperty("frameworkState")).to.be.true;
  });

  it("should allow initialization with app Reducer", () => {
    const testState = new StateManager({ appState: AppStateManager.appReducer });
    expect(testState).to.exist;
    const currentState = StateManager.state;
    expect(currentState!.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState!.hasOwnProperty("appState")).to.be.true;
  });

  it("should allow initialization with defaults that include frameworkState", () => {
    const testState = new StateManager({ appState: AppStateManager.appReducer, frameworkState: FrameworkReducer });
    expect(testState).to.exist;
    const currentState = StateManager.state;
    expect(currentState!.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState!.hasOwnProperty("appState")).to.be.true;
  });

  it("should see plugin state once plugin reducer is registered", () => {
    const testState = new StateManager({ appState: AppStateManager.appReducer });
    expect(testState).to.exist;
    let currentState = StateManager.state;
    expect(currentState!.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState!.hasOwnProperty("appState")).to.be.true;

    PluginStateManager.initialize();
    currentState = StateManager.state;
    expect(currentState!.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState!.hasOwnProperty("appState")).to.be.true;
    expect(currentState!.hasOwnProperty("plugin_state")).to.be.true;
  });

  it("should see plugin state once plugin reducer is registered (using store property)", () => {
    const testState = new StateManager({ appState: AppStateManager.appReducer });
    expect(testState).to.exist;
    let currentState = StateManager.store.getState();
    expect(currentState!.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState!.hasOwnProperty("appState")).to.be.true;

    PluginStateManager.initialize();
    currentState = StateManager.store.getState();
    expect(currentState!.hasOwnProperty("frameworkState")).to.be.true;
    expect(currentState!.hasOwnProperty("appState")).to.be.true;
    expect(currentState!.hasOwnProperty("plugin_state")).to.be.true;
  });

});
