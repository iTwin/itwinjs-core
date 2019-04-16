/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module State */

import { createAction, ActionsUnion } from "./utils/redux-ts";

// cSpell:ignore configurableui snapmode toolprompt appstate
/** Action Ids used by Redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 *  Since these are also used as sync ids they should be in lowercase.
 * @beta
 */
export const enum AppStateActionId {
  SetNumItemsSelected = "appstate:set-num-items-selected",
  SetCurrentProperty = "appstate:set-current-property",
}

/** The portion of state managed by the AppStateReducer.
 * @beta
 */
export interface AppState {
  numItemsSelected: number;
  property?: any;
}

/** used on first call of AppStateReducer */
const initialState: AppState = {
  /** number of selected items in Presentation Selection */
  numItemsSelected: 0,
  /** Current property selected in the property grid - used in Find Similar Widget */
  property: undefined,
};

/** An object with a function that creates each AppStateReducer that can be handled by our reducer.
 * @beta
 */
export const AppStateActions = {  // tslint:disable-line:variable-name
  setNumItemsSelected: (numSelected: number) => createAction(AppStateActionId.SetNumItemsSelected, numSelected),
  setCurrentProperty: (property: any) => createAction(AppStateActionId.SetCurrentProperty, property),
};

/** Union of AppState Redux actions
 * @beta
 */
export type AppStateActionsUnion = ActionsUnion<typeof AppStateActions>;

/** Handles actions to update AppState.
 * @beta
 */
export function AppStateReducer(state: AppState = initialState, _action: AppStateActionsUnion): AppState {
  switch (_action.type) {
    case AppStateActionId.SetNumItemsSelected: {
      // istanbul ignore else
      if (undefined !== _action.payload)
        return { ...state, numItemsSelected: _action.payload };
      break;
    }
    case AppStateActionId.SetCurrentProperty: {
      return { ...state, property: _action.payload };
    }
  }

  return state;
}
