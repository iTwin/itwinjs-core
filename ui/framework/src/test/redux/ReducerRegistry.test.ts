/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { createAction, ActionsUnion, ActionCreatorsObject, ReducerRegistryInstance, NameToReducerMap } from "../../ui-framework";
import { UiError } from "@bentley/ui-abstract";

// Manages the state for plugin
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

describe("ReducerRegistry", () => {
  afterEach(() => ReducerRegistryInstance.clearReducers());

  it("should be able to register and get reducer ", () => {
    let reducerRegistryHasEntries = false;

    ReducerRegistryInstance.setChangeListener((newDynamicReducers: NameToReducerMap) => {
      const keys = (Object.keys(newDynamicReducers));
      if (keys.length) {
        reducerRegistryHasEntries = true;
      } else {
        reducerRegistryHasEntries = false;
      }
    });

    expect(reducerRegistryHasEntries).to.be.false;

    expect(ReducerRegistryInstance.getReducers().plugin_state).not.to.exist;

    PluginStateManager.initialize();

    expect(reducerRegistryHasEntries).to.be.true;
    expect(ReducerRegistryInstance.getReducers().plugin_state).to.exist;

    const myCurrentState: IPluginState = { selectedItem: "selected", dialogVisible: false };
    let outState = ReducerRegistryInstance.getReducers().plugin_state(myCurrentState, { type: PluginStateManager.SET_PLUGIN_DIALOG_VISIBLE, payload: true });
    expect(outState.dialogVisible).to.be.true;
    expect(outState.selectedItem).to.be.equal("selected");
    outState = ReducerRegistryInstance.getReducers().plugin_state(outState, { type: PluginStateManager.SET_PLUGIN_SELECTED_ITEM, payload: "new-selection" });
    expect(outState.selectedItem).to.be.equal("new-selection");

    ReducerRegistryInstance.clearReducers();
    expect(reducerRegistryHasEntries).to.be.false;
  });

  it("should not be able to register duplicate reducer name ", () => {
    PluginStateManager.initialize();
    let keys = (Object.keys(ReducerRegistryInstance.getReducers()));
    expect(keys.length).to.be.equal(1);
    expect(() => PluginStateManager.initialize()).to.throw(UiError);
    keys = (Object.keys(ReducerRegistryInstance.getReducers()));
    expect(keys.length).to.be.equal(1);
  });

});
