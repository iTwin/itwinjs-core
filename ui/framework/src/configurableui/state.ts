/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module FrameworkState */

import { createAction, ActionsUnion } from "../utils/redux-ts";
import { SnapMode } from "@bentley/imodeljs-frontend";

/** The portion of state managed by the ConfigurableUiReducer. */
export interface ConfigurableUiState {
  placeHolder: string;
  snapMode: number;
  toolPrompt: string;
}

/* used on first call of ConfigurableUiReducer */
const initialState: ConfigurableUiState = {
  placeHolder: "placeholder",
  snapMode: SnapMode.NearestKeypoint as number,
  toolPrompt: "",
};

/** An object with a function that creates each ConfigurableUiReducer that can be handled by our reducer. */ // tslint:disable-next-line:variable-name
export const ConfigurableUiActions = {
  setSnapMode: (snapMode: number) => createAction("ConfigurableUi:SET_SNAPMODE", snapMode),
  setToolPrompt: (toolPrompt: string) => createAction("ConfigurableUi:SET_TOOLPROMPT", toolPrompt),
};

/** Union of ConfigurableUi Redux actions  */
export type ConfigurableUiActionsUnion = ActionsUnion<typeof ConfigurableUiActions>;

/** Handles actions to update ConfigurableUiState. */
export function ConfigurableUiReducer(state: ConfigurableUiState = initialState, _action: ConfigurableUiActionsUnion): ConfigurableUiState {
  switch (_action.type) {
    case "ConfigurableUi:SET_SNAPMODE": {
      if (_action.payload)
        return { ...state, snapMode: _action.payload };
      break;
    }
    case "ConfigurableUi:SET_TOOLPROMPT": {
      if (_action.payload)
        return { ...state, toolPrompt: _action.payload };
      break;
    }

  }

  return state;
}
