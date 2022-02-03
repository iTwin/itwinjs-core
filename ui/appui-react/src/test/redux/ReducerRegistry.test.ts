/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { UiError } from "@itwin/appui-abstract";
import type { ActionCreatorsObject, ActionsUnion, NameToReducerMap} from "../../appui-react";
import { createAction, ReducerRegistryInstance } from "../../appui-react";

// Manages the state for extension
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

    expect(ReducerRegistryInstance.getReducers().extension_state).not.to.exist;

    ExtensionStateManager.initialize();

    expect(reducerRegistryHasEntries).to.be.true;
    expect(ReducerRegistryInstance.getReducers().extension_state).to.exist;

    const myCurrentState: ExtensionState = { selectedItem: "selected", dialogVisible: false };
    let outState = ReducerRegistryInstance.getReducers().extension_state(myCurrentState, { type: ExtensionStateManager.SET_EXTENSION_DIALOG_VISIBLE, payload: true });
    expect(outState.dialogVisible).to.be.true;
    expect(outState.selectedItem).to.be.equal("selected");
    outState = ReducerRegistryInstance.getReducers().extension_state(outState, { type: ExtensionStateManager.SET_EXTENSION_SELECTED_ITEM, payload: "new-selection" });
    expect(outState.selectedItem).to.be.equal("new-selection");

    ReducerRegistryInstance.clearReducers();
    expect(reducerRegistryHasEntries).to.be.false;
  });

  it("should not be able to register duplicate reducer name ", () => {
    ExtensionStateManager.initialize();
    let keys = (Object.keys(ReducerRegistryInstance.getReducers()));
    expect(keys.length).to.be.equal(1);
    expect(() => ExtensionStateManager.initialize()).to.throw(UiError);
    keys = (Object.keys(ReducerRegistryInstance.getReducers()));
    expect(keys.length).to.be.equal(1);
  });

});
