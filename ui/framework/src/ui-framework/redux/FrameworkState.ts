/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module State
 */

import { ConfigurableUiReducer, ConfigurableUiState } from "../configurableui/state.js";
import { combineReducers } from "./redux-ts.js";
import { SessionState, SessionStateReducer } from "./SessionState.js";

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
export const FrameworkReducer = combineReducers({ // eslint-disable-line @typescript-eslint/naming-convention
  configurableUiState: ConfigurableUiReducer,
  sessionState: SessionStateReducer,
});
