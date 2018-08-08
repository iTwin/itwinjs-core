/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module FrameworkState */

// @ts-ignore
import { createAction, ActionsUnion, Action } from "../utils/redux-ts";

/** The portion of state managed by the ConfigurableUIReducer. */
export interface ConfigurableUIState {
  placeHolder: string;
}

const initialState: ConfigurableUIState = {
  placeHolder: "placeholder",
};

/** An object with a function that creates each ConfigurableUIReducer that can be handled by our reducer. */ // tslint:disable-next-line:variable-name
export const ConfigurableUIActions = {
  doNothing: () => createAction("ConfigurableUI:DO_NOTHING"),
};

/** Union of ConfigurableUI Redux actions  */
export type ConfigurableUIActionsUnion = ActionsUnion<typeof ConfigurableUIActions>;

/** Handles the OpenIModelState portion of our state object. */
export function ConfigurableUIReducer(state: ConfigurableUIState = initialState, _action: ConfigurableUIActionsUnion): ConfigurableUIState {
  return state;
}
