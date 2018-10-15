/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module FrameworkState */

import { OverallContentState, OverallContentReducer } from "./overallcontent/state";
import { ConfigurableUiState, ConfigurableUiReducer } from "./configurableui/state";
import { combineReducers } from "./utils/redux-ts";
import { reducer as OidcReducer } from "redux-oidc";

/** Interface combining all the state Framework state interfaces. */
export interface FrameworkState {
  overallContentState: OverallContentState;
  configurableUiState: ConfigurableUiState;
}

/** Framework reducer that combines the [[OverallContentReducer]],  [[ConfigurableUiReducer]] and OidcReducer. */
export const FrameworkReducer = combineReducers({   // tslint:disable-line:variable-name
  overallContentState: OverallContentReducer,
  configurableUiState: ConfigurableUiReducer,
  oidcState: OidcReducer,
});
