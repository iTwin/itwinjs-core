/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module AppState */

import { createAction, ActionsUnion } from "./utils/redux-ts";

// cSpell:ignore configurableui snapmode toolprompt
/** Action Ids used by redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 *  Since these are also used as sync ids they should be in lowercase.
 */
export const enum AppStateActionId {
  SetNumItemsSelected = "appstate:set-num-items-selected",
}

/** The portion of state managed by the AppStateReducer. */
export interface AppState {
  numItemsSelected: number;
}

/** used on first call of AppStateReducer */
const initialState: AppState = {
  /** number of selected items in Presentation Selection */
  numItemsSelected: 0,
};

/** An object with a function that creates each AppStateReducer that can be handled by our reducer. */ // tslint:disable-next-line:variable-name
export const AppStateActions = {
  setNumItemsSelected: (numSelected: number) => createAction(AppStateActionId.SetNumItemsSelected, numSelected),
};

/** Union of AppState Redux actions  */
export type AppStateActionsUnion = ActionsUnion<typeof AppStateActions>;

/** Handles actions to update AppState. */
export function AppStateReducer(state: AppState = initialState, _action: AppStateActionsUnion): AppState {
  switch (_action.type) {
    case AppStateActionId.SetNumItemsSelected: {
      if (undefined !== _action.payload)
        return { ...state, numItemsSelected: _action.payload };
      break;
    }

  }

  return state;
}
