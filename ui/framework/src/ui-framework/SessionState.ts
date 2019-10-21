/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module State */

// The following definitions are causing extract-api issues on linux so for now just using any until we can figure out the issue.
// import { IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
// import { AccessToken } from "@bentley/imodeljs-clients";
import { createAction, ActionsUnion, DeepReadonly } from "./utils/redux-ts";

import { XAndY } from "@bentley/geometry-core";
import { MenuItemProps } from "./shared/MenuItem";

// cSpell:ignore configurableui snapmode toolprompt sessionstate imodelid viewid viewportid rulesetid

/** PresentationSelectionScope holds the id and the localized label for a selection scope supported for a specific iModel.
 * Added to avoid an api-extract error caused by using SelectionScope.
 * @beta
 */
export interface PresentationSelectionScope {
  id: string;
  label: string;
}

/** Definition of data added to Redux store to define cursor menu.  If menuItems are empty the menu control is not displayed.
 * To close the menu clear the menuItems or pass in undefined as the CursorData.
 * @beta
 */
export interface CursorMenuData {
  items: MenuItemProps[];
  position: XAndY;
}

/** Action Ids used by Redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 *  Since these are also used as sync ids they should be in lowercase.
 * @beta
 */
export enum SessionStateActionId {
  SetNumItemsSelected = "sessionstate:set-num-items-selected",
  SetAvailableSelectionScopes = "sessionstate:set-available-selection-scopes",
  SetSelectionScope = "sessionstate:set-selection-scope",
  SetActiveIModelId = "sessionstate:set-active-imodelid",
  SetIModelConnection = "sessionstate:set-imodel-connection",
  SetAccessToken = "sessionstate:set-access-token",
  SetDefaultIModelViewportControlId = "sessionstate:set-default-viewportid",
  SetDefaultViewId = "sessionstate:set-default-viewid",
  SetDefaultViewState = "sessionstate:set-default-view-state",
  SetDefaultRulesetId = "sessionstate:set-default-rulesetid",
  UpdateCursorMenu = "sessionstate:update-cursor-menu",
}

/** The portion of state managed by the SessionStateReducer.
 * @beta
 */
export interface SessionState {
  numItemsSelected: number;
  availableSelectionScopes: PresentationSelectionScope[];
  activeSelectionScope: string;
  iModelId: string;
  defaultIModelViewportControlId: string | undefined;
  defaultViewId: string | undefined;
  defaultViewState: any | undefined;
  defaultRulesetId: string | undefined;
  iModelConnection: any | undefined;
  accessToken: any | undefined;
  cursorMenuData: CursorMenuData | undefined;
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
  defaultIModelViewportControlId: undefined,
  defaultViewId: undefined,
  defaultViewState: undefined,
  defaultRulesetId: undefined,
  iModelConnection: undefined,
  accessToken: undefined,
  cursorMenuData: undefined,
};

/** An object with a function that creates each SessionStateReducer that can be handled by our reducer.
 * @beta
 */
export const SessionStateActions = {  // tslint:disable-line:variable-name
  setNumItemsSelected: (numSelected: number) => createAction(SessionStateActionId.SetNumItemsSelected, numSelected),
  setAvailableSelectionScopes: (availableSelectionScopes: PresentationSelectionScope[]) => createAction(SessionStateActionId.SetAvailableSelectionScopes, availableSelectionScopes),
  setSelectionScope: (activeSelectionScope: string) => createAction(SessionStateActionId.SetSelectionScope, activeSelectionScope),
  setActiveIModelId: (iModelId: string) => createAction(SessionStateActionId.SetActiveIModelId, iModelId),
  setDefaultIModelViewportControlId: (iModelViewportControlId: string) => createAction(SessionStateActionId.SetDefaultIModelViewportControlId, iModelViewportControlId),
  setDefaultViewId: (viewId: string) => createAction(SessionStateActionId.SetDefaultViewId, viewId),
  setDefaultViewState: (viewState: any) => createAction(SessionStateActionId.SetDefaultViewState, viewState),
  setDefaultRulesetId: (rulesetid: string) => createAction(SessionStateActionId.SetDefaultRulesetId, rulesetid),
  setIModelConnection: (iModelConnection: any) => createAction(SessionStateActionId.SetIModelConnection, iModelConnection),
  setAccessToken: (accessToken: any) => createAction(SessionStateActionId.SetAccessToken, accessToken),
  updateCursorMenu: (cursorMenuData: CursorMenuData) => createAction(SessionStateActionId.UpdateCursorMenu, cursorMenuData),
};

/** Union of SessionState Redux actions
 * @beta
 */
export type SessionStateActionsUnion = ActionsUnion<typeof SessionStateActions>;

/** Handles actions to update SessionState.
 * @beta
 */
export function SessionStateReducer(state: SessionState = initialState, _action: SessionStateActionsUnion): DeepReadonly<SessionState> {
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
    case SessionStateActionId.SetDefaultIModelViewportControlId: {
      return { ...state, defaultIModelViewportControlId: _action.payload };
    }
    case SessionStateActionId.SetDefaultViewId: {
      return { ...state, defaultViewId: _action.payload };
    }
    case SessionStateActionId.SetDefaultViewState: {
      return { ...state, defaultViewState: _action.payload };
    }
    case SessionStateActionId.SetDefaultRulesetId: {
      return { ...state, defaultRulesetId: _action.payload };
    }
    case SessionStateActionId.SetIModelConnection: {
      return { ...state, iModelConnection: _action.payload };
    }
    case SessionStateActionId.SetAccessToken: {
      return { ...state, accessToken: _action.payload };
    }
    case SessionStateActionId.UpdateCursorMenu: {
      return { ...state, cursorMenuData: _action.payload };
    }
  }

  return state;
}
