/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, HubIModel, Project } from "@bentley/imodeljs-clients/lib";
import { IModelConnection, ViewState, Viewport } from "@bentley/imodeljs-frontend/lib/frontend";
import { ViewDefinitionProps } from "@bentley/imodeljs-common/lib/common";

/** Global information on the currently opened iModel and the state of the view. */
export class SimpleViewState {
  public accessToken?: AccessToken;
  public project?: Project;
  public iModel?: HubIModel;
  public iModelConnection?: IModelConnection;
  public viewDefinition?: ViewDefinitionProps;
  public viewState?: ViewState;
  public viewPort?: Viewport;
  constructor() { }
}
