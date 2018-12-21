/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module FrameworkState */

import { createAction, ActionsUnion } from "../utils/redux-ts";
import { SnapMode } from "@bentley/imodeljs-frontend";

// cSpell:ignore configurableui snapmode toolprompt
/** Action Ids used by redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 *  Since these are also used as sync ids they should be in lowercase.
 */
export const enum ConfigurableUiActionId {
  SetSnapMode = "configurableui:set_snapmode",
  SetToolPrompt = "configurableui:set_toolprompt",
}

/** The portion of state managed by the ConfigurableUiReducer. */
export interface ConfigurableUiState {
  snapMode: number;
  toolPrompt: string;
}

/** used on first call of ConfigurableUiReducer */
const initialState: ConfigurableUiState = {
  snapMode: SnapMode.NearestKeypoint as number,
  toolPrompt: "",
};

/** An object with a function that creates each ConfigurableUiReducer that can be handled by our reducer. */ // tslint:disable-next-line:variable-name
export const ConfigurableUiActions = {
  setSnapMode: (snapMode: number) => createAction(ConfigurableUiActionId.SetSnapMode, snapMode),
  setToolPrompt: (toolPrompt: string) => createAction(ConfigurableUiActionId.SetToolPrompt, toolPrompt),
};

/** Union of ConfigurableUi Redux actions  */
export type ConfigurableUiActionsUnion = ActionsUnion<typeof ConfigurableUiActions>;

/** Handles actions to update ConfigurableUiState. */
export function ConfigurableUiReducer(state: ConfigurableUiState = initialState, _action: ConfigurableUiActionsUnion): ConfigurableUiState {
  switch (_action.type) {
    case ConfigurableUiActionId.SetSnapMode: {
      if (_action.payload)
        return { ...state, snapMode: _action.payload };
      break;
    }
    case ConfigurableUiActionId.SetToolPrompt: {
      if (_action.payload)
        return { ...state, toolPrompt: _action.payload };
      break;
    }

  }

  return state;
}
