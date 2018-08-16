/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import { AccessToken } from "@bentley/imodeljs-clients";
import { ProjectInfo, ProjectScope } from "../clientservices/ProjectServices";
import { IModelInfo } from "../clientservices/IModelServices";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { Id64Props } from "@bentley/bentleyjs-core";
import { UiFramework } from "../UiFramework";

// @ts-ignore
import { Id64 } from "@bentley/bentleyjs-core";
// @ts-ignore
import { createAction, ActionsUnion, Action, ActionWithPayload, DeepReadonly, DeepReadonlyObject, DeepReadonlyArray } from "../utils/redux-ts";

/** The content that is displayed in the UI while in the process of selecting an iModel for opening. */
export enum OpenIModelPage {
  LoginPage = -2,
  SelectIModelPage = -1,
}

/** An object with a function that creates each OpenIModelAction that can be handled by our reducer. */  // tslint:disable-next-line:variable-name
export const OpenIModelActions = {
  setIModelPage: (newPage: OpenIModelPage) => createAction("OpenIModel:SETPAGE", newPage),
  setAccessToken: (loggedIn: boolean, accessToken: AccessToken) => createAction("OpenIModel:SETACCESSTOKEN", { loggedIn, accessToken }),
  setLoggedIn: (loggedIn: boolean, accessToken: AccessToken) => createAction("OpenIModel:SETLOGGEDIN", { loggedIn, accessToken }),
  setProjects: (projects: ProjectInfo[]) => createAction("OpenIModel:SETPROJECTS", projects),
  setRecentProjects: (projects: ProjectInfo[]) => createAction("OpenIModel:SETRECENTPROJECTS", projects),
  setCurrentProject: (newProject: ProjectInfo) => createAction("OpenIModel:SETCURRENTPROJECT", newProject),
  showRecentProjectList: () => createAction("OpenIModel:SHOWRECENTPROJECTS"),
  setIModels: (iModels: IModelInfo[]) => createAction("OpenIModel:SETIMODELS", iModels),
  setCurrentIModel: (newIModel: IModelInfo) => createAction("OpenIModel:SETCURRENTIMODEL", newIModel),
  setIModelConnection: (iModelConnection: IModelConnection, viewProps: ViewDefinitionProps[]) => createAction("OpenIModel:SETIMODELCONNECTION", { iModelConnection, viewProps }),
  setSelectedViews: (selectedViews: Id64Props[]) => createAction("OpenIModel:SETSELECTEDVIEWS", selectedViews),
};

/** The union of all actions that are handled by our reducer. */
export type OpenIModelActionsUnion = ActionsUnion<typeof OpenIModelActions>;

/** The portion of state managed by the OpenIModelReducer. */
export interface OpenIModelState {
  currentPage: OpenIModelPage;
  loggedIn: boolean;
  accessToken?: AccessToken;
  overlaySearchProjectList: boolean;
  projects?: ProjectInfo[];
  recentProjects?: ProjectInfo[];
  currentProject?: ProjectInfo;
  iModels?: IModelInfo[];
  currentIModel?: IModelInfo;
  currentViews?: Id64Props[];
  currentIModelConnection?: IModelConnection;
  showRecentProjects: boolean;
}

const initialState: OpenIModelState = {
  currentPage: OpenIModelPage.LoginPage,
  loggedIn: false,
  overlaySearchProjectList: false,
  showRecentProjects: false,
};

function getRecentProjects(state: OpenIModelState) {
  UiFramework.projectServices.getProjects(state.accessToken!, ProjectScope.MostRecentlyUsed, 40, 0).then((projectInfos: ProjectInfo[]) => {
    UiFramework.store.dispatch({ type: "OpenIModel:SETRECENTPROJECTS", payload: projectInfos });
    console.log("Done retrieving recentProjects", projectInfos); // tslint:disable-line:no-console
  });
}

/** Handles the OpenIModelState portion of our state object. */
export function OpenIModelReducer(state: OpenIModelState = initialState, action: OpenIModelActionsUnion): OpenIModelState {
  switch (action.type) {
    case "OpenIModel:SETPAGE": {
      return { ...state, currentPage: action.payload };
    }
    case "OpenIModel:SETACCESSTOKEN": {
      const newState: OpenIModelState = {
        ...state,
        loggedIn: action.payload.loggedIn,
        accessToken: action.payload.accessToken as AccessToken,
      };
      return newState;
    }
    case "OpenIModel:SETLOGGEDIN": {
      const newState: OpenIModelState = {
        ...state,
        currentPage: action.payload.loggedIn ? OpenIModelPage.SelectIModelPage : state.currentPage,
        loggedIn: action.payload.loggedIn,
        accessToken: action.payload.accessToken as AccessToken,
      };
      getRecentProjects(newState);
      return newState;
    }
    case "OpenIModel:SETRECENTPROJECTS": {
      const projects = action.payload;
      const newPartOfState: any = { recentProjects: projects, currentPage: OpenIModelPage.SelectIModelPage };
      if (projects && projects.length > 0)
        newPartOfState.currentProject = projects[0];
      return { ...state, ...newPartOfState };
    }
    case "OpenIModel:SETCURRENTPROJECT": {
      return { ...state, currentProject: action.payload, currentPage: OpenIModelPage.SelectIModelPage, currentIModel: undefined, currentViews: undefined, showRecentProjects: false, iModels: undefined };
    }
    case "OpenIModel:SHOWRECENTPROJECTS": {
      return { ...state, showRecentProjects: true };
    }
    case "OpenIModel:SETIMODELS": {
      return { ...state, iModels: action.payload as any };
    }
    case "OpenIModel:SETCURRENTIMODEL": {
      return { ...state, currentIModel: action.payload as any };
    }
    case "OpenIModel:SETIMODELCONNECTION": {
      return { ...state, currentIModelConnection: action.payload.iModelConnection as any, currentViews: action.payload.viewProps as any };
    }
    case "OpenIModel:SETSELECTEDVIEWS": {
      return { ...state, currentViews: action.payload as any };
    }

  }

  return state;
}
