/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module State
 */

// The following definitions are causing extract-api issues on linux so for now just using any until we can figure out the issue.
import { XAndY } from "@itwin/core-geometry";
// import { IModelConnection, ViewState } from "@itwin/core-frontend";
import { MenuItemProps } from "../shared/MenuItem";
import { ActionsUnion, createAction, DeepReadonly } from "./redux-ts";

// cSpell:ignore configurableui snapmode toolprompt sessionstate imodelid viewid viewportid rulesetid

/** PresentationSelectionScope holds the id and the localized label for a selection scope supported for a specific iModel.
 * Added to avoid an api-extract error caused by using SelectionScope.
 * @public
 */
export interface PresentationSelectionScope {
  id: string;
  label: string;
}

/** Definition of data added to Redux store to define cursor menu.  If menuItems are empty the menu control is not displayed.
 * To close the menu clear the menuItems or pass in undefined as the CursorData.
 * @public
 */
export interface CursorMenuData {
  items: MenuItemProps[];
  position: XAndY;
  childWindowId?: string;
}

/** Action Ids used by Redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 *  Since these are also used as sync ids they should be in lowercase.
 * @public
 */
export enum SessionStateActionId {
  SetNumItemsSelected = "sessionstate:set-num-items-selected",
  SetAvailableSelectionScopes = "sessionstate:set-available-selection-scopes",
  SetSelectionScope = "sessionstate:set-selection-scope",
  SetActiveIModelId = "sessionstate:set-active-imodelid",
  SetIModelConnection = "sessionstate:set-imodel-connection",
  SetDefaultIModelViewportControlId = "sessionstate:set-default-viewportid",
  SetDefaultViewId = "sessionstate:set-default-viewid",
  SetDefaultViewState = "sessionstate:set-default-view-state",
  UpdateCursorMenu = "sessionstate:update-cursor-menu",
}

/** The portion of state managed by the SessionStateReducer.
 * @public
 */
export interface SessionState {
  numItemsSelected: number;
  availableSelectionScopes: PresentationSelectionScope[];
  activeSelectionScope: string;
  iModelId: string;
  defaultIModelViewportControlId: string | undefined;
  defaultViewId: string | undefined;
  defaultViewState: any | undefined;
  iModelConnection: any | undefined;
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
  iModelConnection: undefined,
  cursorMenuData: undefined,
};

/** An interface that allows redux connected object to dispatch changes to the SessionState reducer.
 * @beta
 */
export interface SessionStateActionsProps {
  setActiveIModelId: (typeof SessionStateActions.setActiveIModelId);
  setAvailableSelectionScopes: (typeof SessionStateActions.setAvailableSelectionScopes);
  setDefaultIModelViewportControlId: (typeof SessionStateActions.setDefaultIModelViewportControlId);
  setDefaultViewId: (typeof SessionStateActions.setDefaultViewId);
  setDefaultViewState: (typeof SessionStateActions.setDefaultViewState);
  setIModelConnection: (typeof SessionStateActions.setIModelConnection);
  setNumItemsSelected: (typeof SessionStateActions.setNumItemsSelected);
  setSelectionScope: (typeof SessionStateActions.setSelectionScope);
  updateCursorMenu: (typeof SessionStateActions.updateCursorMenu);
}

/** An object with a function that creates each SessionStateReducer that can be handled by our reducer.
 * @public
 */
export const SessionStateActions = {  // eslint-disable-line @typescript-eslint/naming-convention
  setActiveIModelId:
    // istanbul ignore next
    (iModelId: string) => createAction(SessionStateActionId.SetActiveIModelId, iModelId),
  setAvailableSelectionScopes:
    // istanbul ignore next
    (availableSelectionScopes: PresentationSelectionScope[]) => createAction(SessionStateActionId.SetAvailableSelectionScopes, availableSelectionScopes),
  setDefaultIModelViewportControlId: (iModelViewportControlId: string) => createAction(SessionStateActionId.SetDefaultIModelViewportControlId, iModelViewportControlId),
  setDefaultViewId: (viewId: string) => createAction(SessionStateActionId.SetDefaultViewId, viewId),
  setDefaultViewState:
    // istanbul ignore next
    (viewState: any) => createAction(SessionStateActionId.SetDefaultViewState, viewState),
  setNumItemsSelected: (numSelected: number) => createAction(SessionStateActionId.SetNumItemsSelected, numSelected),
  setIModelConnection:
    // istanbul ignore next
    (iModelConnection: any) => createAction(SessionStateActionId.SetIModelConnection, iModelConnection),
  setSelectionScope:
    // istanbul ignore next
    (activeSelectionScope: string) => createAction(SessionStateActionId.SetSelectionScope, activeSelectionScope),
  updateCursorMenu:
    // istanbul ignore next
    (cursorMenuData: CursorMenuData) => createAction(SessionStateActionId.UpdateCursorMenu, cursorMenuData),
};

/** Object that contains available actions that modify SessionState. Parent control's props should
 * extend from SessionStateActionsProps before using this in Redux 'connect' function.
 * @beta
 */
// ...SessionStateActionsProps
export const sessionStateMapDispatchToProps = { ...SessionStateActions };

/** Union of SessionState Redux actions
 * @public
 */
export type SessionStateActionsUnion = ActionsUnion<typeof SessionStateActions>;

/** Handles actions to update SessionState.
 * @public
 */
export function SessionStateReducer(state: SessionState = initialState, action: SessionStateActionsUnion): DeepReadonly<SessionState> {
  switch (action.type) {
    case SessionStateActionId.SetNumItemsSelected: {
      // istanbul ignore else
      if (undefined !== action.payload)
        return { ...state, numItemsSelected: action.payload };
      else
        return { ...state, numItemsSelected: 0 };
    }
    case SessionStateActionId.SetAvailableSelectionScopes: {
      const payloadArray: PresentationSelectionScope[] = [];
      action.payload.forEach((scope) => payloadArray.push(scope));
      // istanbul ignore else
      if (undefined !== action.payload)
        return { ...state, availableSelectionScopes: payloadArray };
      else
        return { ...state, availableSelectionScopes: [defaultSelectionScope] };
    }
    case SessionStateActionId.SetSelectionScope: {
      // istanbul ignore else
      if (undefined !== action.payload)
        return { ...state, activeSelectionScope: action.payload };
      else
        return { ...state, activeSelectionScope: defaultSelectionScope.id };
    }
    case SessionStateActionId.SetActiveIModelId: {
      // istanbul ignore else
      if (undefined !== action.payload)
        return { ...state, iModelId: action.payload };
      else
        return { ...state, iModelId: "" };
    }
    case SessionStateActionId.SetDefaultIModelViewportControlId: {
      return { ...state, defaultIModelViewportControlId: action.payload };
    }
    case SessionStateActionId.SetDefaultViewId: {
      return { ...state, defaultViewId: action.payload };
    }
    case SessionStateActionId.SetDefaultViewState: {
      return { ...state, defaultViewState: action.payload };
    }
    case SessionStateActionId.SetIModelConnection: {
      return { ...state, iModelConnection: action.payload };
    }
    case SessionStateActionId.UpdateCursorMenu: {
      return { ...state, cursorMenuData: action.payload };
    }
  }

  return state;
}
