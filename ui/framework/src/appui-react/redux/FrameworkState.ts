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
 * @public
 */
export interface FrameworkState {
  configurableUiState: ConfigurableUiState;
  sessionState: SessionState;
}

/** Framework reducer that combines the [[ConfigurableUiReducer]] and [[SessionStateReducer]].
 * @public
 */
export const FrameworkReducer = combineReducers({ // eslint-disable-line @typescript-eslint/naming-convention
  configurableUiState: ConfigurableUiReducer,
  sessionState: SessionStateReducer,
});
