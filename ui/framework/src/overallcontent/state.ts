/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
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

/** An object with a function that creates each Overall Content Action that can be handled by our reducer. */ // tslint:disable-next-line:variable-name
export const OverallContentActions = {
  setOverallPage: (newPage: OverallContentPage | number) => createAction("OverallContent:SET_PAGE", newPage),
  setAccessToken: (accessToken: AccessToken) => createAction("OverallContent:SET_ACCESS_TOKEN", accessToken),
  clearAccessToken: () => createAction("OverallContent:CLEAR_ACCCESS_TOKEN"),
  goToConfigurableUi: () => createAction("OpenIModel:SETSELECTEDVIEWS"),
};

/** The union of all actions that are handled by our reducer. */
export type OverallContentActionsUnion = ActionsUnion<typeof OverallContentActions>;

/** The portion of state managed by the OverallContentReducer. */
export interface OverallContentState {
  currentPage: OverallContentPage | number;
  accessToken?: AccessToken;
}

const initialState: OverallContentState = {
  currentPage: OverallContentPage.SelectIModelPage,
};

/** Handles the OverallContentState portion of our state object. */
export function OverallContentReducer(state: OverallContentState = initialState, action: OverallContentActionsUnion): OverallContentState {
  switch (action.type) {
    case "OverallContent:SET_PAGE":
      return { ...state, currentPage: action.payload };
    case "OverallContent:SET_ACCESS_TOKEN":
      return { ...state, accessToken: action.payload as any };
    case "OverallContent:CLEAR_ACCCESS_TOKEN":
      return { ...state, accessToken: undefined };
    case "OpenIModel:SETSELECTEDVIEWS":
      return { ...state, currentPage: OverallContentPage.ConfigurableUiPage };
  }
  return state;
}
