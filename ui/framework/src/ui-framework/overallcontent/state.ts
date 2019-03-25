/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OverallContent */

import { createAction, ActionsUnion } from "../utils/redux-ts";
import { AccessToken } from "@bentley/imodeljs-clients";

/** The overall content that is displayed in the UI. */
export enum OverallContentPage {
  OfflinePage = -3,
  SelectIModelPage = -2,
  ConfigurableUiPage = -1,
}

/** Enum for the Color Theme string. */
export enum ColorTheme {
  Light = "light",
  Dark = "dark",
}

/** The default color theme. */
export const COLOR_THEME_DEFAULT = ColorTheme.Light;

/** Action Ids used by Redux. Typically used to refresh visibility or enable state of control.
 */
export enum OverallContentActionId {
  SetOverallPage = "OverallContent:SET_PAGE",
  SetAccessToken = "OverallContent:SET_ACCESS_TOKEN",
  ClearAccessToken = "OverallContent:CLEAR_ACCESS_TOKEN",
  GoToConfigurableUi = "OpenIModel:SET_SELECTED_VIEWS",
  SetTheme = "Content:SET_THEME",
}

/** An object with a function that creates each Overall Content Action that can be handled by our reducer. */ // tslint:disable-next-line:variable-name
export const OverallContentActions = {
  setOverallPage: (newPage: OverallContentPage | number) => createAction(OverallContentActionId.SetOverallPage, newPage),
  setAccessToken: (accessToken: AccessToken) => createAction(OverallContentActionId.SetAccessToken, accessToken),
  clearAccessToken: () => createAction(OverallContentActionId.ClearAccessToken),
  goToConfigurableUi: () => createAction(OverallContentActionId.GoToConfigurableUi),
  setTheme: (theme: string) => createAction(OverallContentActionId.SetTheme, theme),
};

/** The union of all actions that are handled by our reducer. */
export type OverallContentActionsUnion = ActionsUnion<typeof OverallContentActions>;

/** The portion of state managed by the OverallContentReducer. */
export interface OverallContentState {
  currentPage: OverallContentPage | number;
  accessToken?: AccessToken;
  theme: string;
}

const initialState: OverallContentState = {
  theme: COLOR_THEME_DEFAULT,
  currentPage: OverallContentPage.SelectIModelPage,
};

/** Handles the OverallContentState portion of our state object. */
export function OverallContentReducer(state: OverallContentState = initialState, action: OverallContentActionsUnion): OverallContentState {
  switch (action.type) {
    case OverallContentActionId.SetOverallPage:
      return { ...state, currentPage: action.payload };
    case OverallContentActionId.SetAccessToken:
      return { ...state, accessToken: action.payload as any };
    case OverallContentActionId.ClearAccessToken:
      return { ...state, accessToken: undefined };
    case OverallContentActionId.GoToConfigurableUi:
      return { ...state, currentPage: OverallContentPage.ConfigurableUiPage };
    case OverallContentActionId.SetTheme:
      return { ...state, theme: action.payload };
  }
  return state;
}
