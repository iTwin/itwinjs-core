/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module State */

import { createAction, ActionsUnion } from "./utils/redux-ts";
import { PresentationSelectionScope } from "./UiFramework";

// cSpell:ignore configurableui snapmode toolprompt sessionstate imodelid
/** Action Ids used by Redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 *  Since these are also used as sync ids they should be in lowercase.
 * @beta
 */
export enum SessionStateActionId {
  SetNumItemsSelected = "sessionstate:set-num-items-selected",
  SetAvailableSelectionScopes = "sessionstate:set-available-selection-scopes",
  SetSelectionScope = "sessionstate:set-selection-scope",
  SetActiveIModelId = "sessionstate:set-active-imodelid",
}

/** The portion of state managed by the SessionStateReducer.
 * @beta
 */
export interface SessionState {
  numItemsSelected: number;
  availableSelectionScopes: PresentationSelectionScope[];
  activeSelectionScope: string;
  iModelId: string;
}

const defaultSelectionScope = { id: "element", label: "Element" } as PresentationSelectionScope;

/** used on first call of SessionStateReducer */
const initialState: SessionState = {
  /** number of selected items in Presentation Selection */
  numItemsSelected: 0,
  /** initialize to only support "Element" scope, this will be overwritten when iModelConnection is established */
  availableSelectionScopes: [defaultSelectionScope],
  /** initialize to active selection scope to "Element", this will be overwritten when iModelConnection is established */
  activeSelectionScope: defaultSelectionScope.id,
  /** set to iModelId if an iModel is active else it is an empty string, so initialize to empty string */
  iModelId: "",
};

/** An object with a function that creates each SessionStateReducer that can be handled by our reducer.
 * @beta
 */
export const SessionStateActions = {  // tslint:disable-line:variable-name
  setNumItemsSelected: (numSelected: number) => createAction(SessionStateActionId.SetNumItemsSelected, numSelected),
  setAvailableSelectionScopes: (availableSelectionScopes: PresentationSelectionScope[]) => createAction(SessionStateActionId.SetAvailableSelectionScopes, availableSelectionScopes),
  setSelectionScope: (activeSelectionScope: string) => createAction(SessionStateActionId.SetSelectionScope, activeSelectionScope),
  setActiveIModelId: (iModelId: string) => createAction(SessionStateActionId.SetActiveIModelId, iModelId),
};

/** Union of SessionState Redux actions
 * @beta
 */
export type SessionStateActionsUnion = ActionsUnion<typeof SessionStateActions>;

/** Handles actions to update SessionState.
 * @beta
 */
export function SessionStateReducer(state: SessionState = initialState, _action: SessionStateActionsUnion): SessionState {
  switch (_action.type) {
    case SessionStateActionId.SetNumItemsSelected: {
      // istanbul ignore else
      if (undefined !== _action.payload)
        return { ...state, numItemsSelected: _action.payload };
      else
        return { ...state, numItemsSelected: 0 };
    }
    case SessionStateActionId.SetAvailableSelectionScopes: {
      const payloadArray: PresentationSelectionScope[] = [];
      _action.payload.forEach((scope) => payloadArray.push(scope));
      // istanbul ignore else
      if (undefined !== _action.payload)
        return { ...state, availableSelectionScopes: payloadArray };
      else
        return { ...state, availableSelectionScopes: [defaultSelectionScope] };
    }
    case SessionStateActionId.SetSelectionScope: {
      // istanbul ignore else
      if (undefined !== _action.payload)
        return { ...state, activeSelectionScope: _action.payload };
      else
        return { ...state, activeSelectionScope: defaultSelectionScope.id };
    }
    case SessionStateActionId.SetActiveIModelId: {
      // istanbul ignore else
      if (undefined !== _action.payload)
        return { ...state, iModelId: _action.payload };
      else
        return { ...state, iModelId: "" };
    }
  }

  return state;
}
