/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OverallContent */

// @ts-ignore
import { createAction, Action, ActionsUnion, ActionWithPayload } from "../utils/redux-ts";

/** The overall content that is displayed in the UI. */
export enum OverallContentPage {
  SelectIModelPage = -2,
  ConfigurableUIPage = -1,
}

/** An object with a function that creates each Overall Content Action that can be handled by our reducer. */ // tslint:disable-next-line:variable-name
export const OverallContentActions = {
  setOverallPage: (newPage: OverallContentPage | number) => createAction("OverallContent:SET_PAGE", newPage),
  goToConfigurableUI: () => createAction("OpenIModel:SETSELECTEDVIEWS"),
};

/** The union of all actions that are handled by our reducer. */
export type OverallContentActionsUnion = ActionsUnion<typeof OverallContentActions>;

/** The portion of state managed by the OverallContentReducer. */
export interface OverallContentState {
  currentPage: OverallContentPage | number;
}

const initialState: OverallContentState = {
  currentPage: OverallContentPage.SelectIModelPage,
};

/** Handles the OverallContentState portion of our state object. */
export function OverallContentReducer(state: OverallContentState = initialState, action: OverallContentActionsUnion): OverallContentState {
  switch (action.type) {
    case "OverallContent:SET_PAGE":
      return { currentPage: action.payload };
    case "OpenIModel:SETSELECTEDVIEWS":
      return { currentPage: OverallContentPage.ConfigurableUIPage };
  }
  return state;
}
