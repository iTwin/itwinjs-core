/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module State */

import { ConfigurableUiState, ConfigurableUiReducer } from "./configurableui/state";
import { AppState, AppStateReducer } from "./AppState";
import { combineReducers } from "./utils/redux-ts";

/** Interface combining all the Framework state interfaces. */
export interface FrameworkState {
  configurableUiState: ConfigurableUiState;
  appState: AppState;
}

/** Framework reducer that combines the [[ConfigurableUiReducer]] and [[AppStateReducer]]. */
export const FrameworkReducer = combineReducers({ // tslint:disable-line:variable-name
  configurableUiState: ConfigurableUiReducer,
  appState: AppStateReducer,
});
