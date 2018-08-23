/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module FrameworkState */

// @ts-ignore
import { createAction, Action, ActionsUnion, ActionWithPayload, DeepReadonlyObject, DeepReadonly } from "../utils/redux-ts";
import { SnapMode } from "@bentley/imodeljs-frontend";

/** The portion of state managed by the ConfigurableUIReducer. */
export interface ConfigurableUIState {
  placeHolder: string;
  snapMode: number;
}

/* used on first call of ConfigurableUIReducer */
const initialState: ConfigurableUIState = {
  placeHolder: "placeholder",
  snapMode: SnapMode.NearestKeypoint as number,
};

/** An object with a function that creates each ConfigurableUIReducer that can be handled by our reducer. */ // tslint:disable-next-line:variable-name
export const ConfigurableUIActions = {
  setSnapMode: (snapMode: number) => createAction("ConfigurableUI:SET_SNAPMODE", snapMode),
};

/** Union of ConfigurableUI Redux actions  */
export type ConfigurableUIActionsUnion = ActionsUnion<typeof ConfigurableUIActions>;

/** Handles actions to update ConfigurableUIState. */
export function ConfigurableUIReducer(state: ConfigurableUIState = initialState, _action: ConfigurableUIActionsUnion): ConfigurableUIState {
  switch (_action.type) {
    case "ConfigurableUI:SET_SNAPMODE": {
      if (_action.payload)
        return { ...state, snapMode: _action.payload };
    }
  }

  return state;
}
