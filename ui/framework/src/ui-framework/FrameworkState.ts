/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module FrameworkState */

import { OverallContentState, OverallContentReducer } from "./overallcontent/state";
import { ConfigurableUiState, ConfigurableUiReducer } from "./configurableui/state";
import { AppState, AppStateReducer } from "./AppState";
import { combineReducers } from "./utils/redux-ts";

/** Interface combining all the state Framework state interfaces. */
export interface FrameworkState {
  overallContentState: OverallContentState;
  configurableUiState: ConfigurableUiState;
  appState: AppState;
}

/** Framework reducer that combines the [[OverallContentReducer]],  [[ConfigurableUiReducer]] and OidcReducer. */
export const FrameworkReducer = combineReducers({   // tslint:disable-line:variable-name
  overallContentState: OverallContentReducer,
  configurableUiState: ConfigurableUiReducer,
  appState: AppStateReducer,
});
