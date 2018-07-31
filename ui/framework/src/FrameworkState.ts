/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module FrameworkState */

// The ts-ignore is needed because otherwise OverallContentPage is identified as unused. But if you leave it out,
// you get a different error saying that FrameworkReducer has or is using OverallContentPage from external file but cannot be named.
// @ts-ignore
import { Id64 } from "@bentley/bentleyjs-core";
// @ts-ignore
import { AccessToken } from "@bentley/imodeljs-clients";
// @ts-ignore
import { IModelConnection } from "@bentley/imodeljs-frontend";
// @ts-ignore
import { IModelInfo } from "./clientservices/IModelServices";
// @ts-ignore
import { ProjectInfo } from "./clientservices/ProjectServices";
// @ts-ignore
import { ViewDefinitionProps } from "@bentley/imodeljs-common";

// @ts-ignore
import { OverallContentState, OverallContentReducer, OverallContentPage } from "./overallcontent/state";
// @ts-ignore
import { OpenIModelState, OpenIModelReducer, OpenIModelPage } from "./openimodel/state";
import { ConfigurableUIState, ConfigurableUIReducer } from "./configurableui/state";
// @ts-ignore
import { combineReducers, DeepReadonlyObject, DeepReadonlyArray, Action, ActionWithPayload } from "./utils/redux-ts";

// interface combining all the state Framework state interfaces.
export interface FrameworkState {
  overallContentState: OverallContentState;
  openIModelState: OpenIModelState;
  configurableUIState: ConfigurableUIState;
}

// framework reducer
// tslint:disable-next-line:variable-name
export const FrameworkReducer = combineReducers({
  overallContentState: OverallContentReducer,
  openIModelState: OpenIModelReducer,
  configurableUIState: ConfigurableUIReducer,
});
