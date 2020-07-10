/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module State
 */

import { ConfigurableUiReducer, ConfigurableUiState } from "../configurableui/state";
import { combineReducers } from "./redux-ts";
import { SessionState, SessionStateReducer } from "./SessionState";

/** Interface combining all the Framework state interfaces.
 * @beta
 */
export interface FrameworkState {
  configurableUiState: ConfigurableUiState;
  sessionState: SessionState;
}

/** Framework reducer that combines the [[ConfigurableUiReducer]] and [[SessionStateReducer]].
 * @beta
 */
export const FrameworkReducer = combineReducers({ // tslint:disable-line:variable-name
  configurableUiState: ConfigurableUiReducer,
  sessionState: SessionStateReducer,
});
