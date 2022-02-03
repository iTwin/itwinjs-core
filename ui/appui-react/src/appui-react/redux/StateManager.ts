/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module State
 */

// cSpell:ignore DEVTOOLS

import type { ReducersMapObject, Store } from "redux";
import { combineReducers, createStore } from "redux";
import { Logger } from "@itwin/core-bentley";
import { UiError } from "@itwin/appui-abstract";
import type { FrameworkState } from "./FrameworkState";
import { FrameworkReducer } from "./FrameworkState";
import type { NameToReducerMap} from "./ReducerRegistry";
import { ReducerRegistryInstance } from "./ReducerRegistry";

/** Generic 'root' state for the appui-react package. Since this state contains common values needed by many applications
 * it is automatically added to the Redux store when using [[StateManager]].
 * @beta
 */
export interface FrameworkRootState {
  frameworkState: FrameworkState;
}

/**
 * Centralized state management class using  Redux actions, reducers and store. This class monitors the ReducerRegistry and will
 * automatically update the store when a new reducer is registered.  This allows the store to be incrementally constructed as modules
 * and/or extensions are loaded.
 * @public
 */
export class StateManager {
  private static _LOG_CATEGORY = "StateManager";
  private _store: Store<any>;
  private _defaultReducers: NameToReducerMap;

  private static _singletonStore: Store<any> | undefined;

  /**
   * StateManager construct.
   * @param defaultReducers Default set of Reducers used by the current application. If this object does not contain the [[FrameworkReducer]] it will automatically be added.
   */
  constructor(defaultReducers?: NameToReducerMap) {
    if (defaultReducers) {
      this._defaultReducers = defaultReducers;
      const keys = (Object.keys(defaultReducers));
      // ensure frameworkState is included in the set of defaultReducers
      if (-1 === keys.findIndex((key) => key === "frameworkState"))
        this._defaultReducers = { ...defaultReducers, frameworkState: FrameworkReducer };
    } else {
      this._defaultReducers = { frameworkState: FrameworkReducer };
    }

    const dynamicallyRegisteredReducers = ReducerRegistryInstance.getReducers();
    let allReducers: any = this.combineDynamicAndDefaultReducers(
      dynamicallyRegisteredReducers,
      this._defaultReducers,
    );

    // create the Redux Store.
    // istanbul ignore next
    this._store = createStore(allReducers, (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());

    ReducerRegistryInstance.setChangeListener((newDynamicReducers) => {
      allReducers = this.combineDynamicAndDefaultReducers(newDynamicReducers, this._defaultReducers);
      this._store.replaceReducer(allReducers);
    });
    StateManager._singletonStore = this._store;
  }

  /** Method to test if the StateManager has been initialized.
   * @param suppressErrorLog If true and the StateManager is not initialized a log message will be output.
   */

  public static isInitialized(suppressErrorLog = false): boolean {
    if (!StateManager._singletonStore) {
      if (!suppressErrorLog)
        Logger.logError(StateManager._LOG_CATEGORY, "Accessing store before it is created.");
      return false;
    } else {
      return true;
    }
  }

  /** Return the current Redux store. Useful when using connect method to connect a Ui Component to the store. */
  public static get store(): Store<any> {
    if (StateManager.isInitialized()) {
      return StateManager._singletonStore!;
    } else {
      throw new UiError(StateManager._LOG_CATEGORY, `Redux Store has not been initialized`);
    }
  }

  /** Return the current state from the Redux store. */
  public static get state(): any {
    if (StateManager.isInitialized()) {
      return StateManager._singletonStore!.getState();
    } else {
      return undefined;
    }
  }

  private combineDynamicAndDefaultReducers(
    dynamicallyRegisteredReducers: ReducersMapObject,
    defaultReducers: ReducersMapObject,
  ) {
    const allReducers = {
      ...defaultReducers,
      ...dynamicallyRegisteredReducers,
    };

    return combineReducers(allReducers);
  }

  /** To be used only in unit test
   * @internal
   */
  public static clearStore() {
    StateManager._singletonStore = undefined;
  }

}
