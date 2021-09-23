/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String, Logger } from "@bentley/bentleyjs-core";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/itwin-registry-client";
import { IModelQuery } from "@bentley/imodelhub-client";
import { AuthorizedFrontendRequestContext, CheckpointConnection, IModelConnection, IModelHubFrontend } from "@bentley/imodeljs-frontend";
import { SampleAppIModelApp } from "..";

/* eslint-disable deprecation/deprecation */

/** Opens External IModel */
export class ExternalIModel {
  public viewId: Id64String | undefined;
  public iModelConnection: IModelConnection | undefined;

  constructor(public iTwinName: string, public imodelName: string) {
  }

  /** Open IModelConnection and get ViewId */
  public async openIModel(): Promise<void> {
    const info = await this.getIModelInfo();

    if (info.iTwinId && info.iModelId) {
      // open the imodel
      Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
        `openIModel (external): iTwinId=${info.iTwinId}&iModelId=${info.iModelId} mode=${SampleAppIModelApp.allowWrite ? "ReadWrite" : "Readonly"}`);

      this.iModelConnection = await CheckpointConnection.openRemote(info.iTwinId, info.iModelId);
      this.viewId = await this.onIModelSelected(this.iModelConnection);
    }
  }

  /** Finds iTwin and iModel ids using their names */
  private async getIModelInfo(): Promise<{ iTwinId: string, iModelId: string }> {
    const iTwinName = this.iTwinName;
    const imodelName = this.imodelName;

    const requestContext: AuthorizedFrontendRequestContext = await AuthorizedFrontendRequestContext.create();

    const iTwinClient = new ITwinAccessClient();
    const iTwinList: ITwin[] = await iTwinClient.getAll(requestContext, {
      search: {
        searchString: iTwinName,
        propertyName: ITwinSearchableProperty.Name,
        exactMatch: true,
      }});

    if (iTwinList.length === 0)
      throw new Error(`ITwin ${iTwinName} was not found for the user.`);
    else if (iTwinList.length > 1)
      throw new Error(`Multiple iTwins named ${iTwinName} were found for the user.`);

    const imodelQuery = new IModelQuery();
    imodelQuery.byName(imodelName);
    const imodels = await IModelHubFrontend.iModelClient.iModels.get(requestContext, iTwinList[0].id, imodelQuery);
    if (imodels.length === 0) {
      throw new Error(`iModel with name "${imodelName}" does not exist in project "${iTwinName}"`);
    }
    return { iTwinId: iTwinList[0].id, iModelId: imodels[0].wsgId };
  }

  /** Handle iModel open event */
  private async onIModelSelected(imodel: IModelConnection | undefined): Promise<Id64String | undefined> {
    let viewDefinitionId: Id64String | undefined;

    try {
      // attempt to get a view definition
      viewDefinitionId = imodel ? await this.getFirstViewDefinitionId(imodel) : undefined;
    } catch (e) {
      if (imodel)
        await imodel.close();
    }

    return viewDefinitionId;
  }

  /** Pick the first available spatial view definition in the imodel */
  private async getFirstViewDefinitionId(imodel: IModelConnection): Promise<Id64String> {
    const viewSpecs = await imodel.views.queryProps({});
    const acceptedViewClasses = [
      "BisCore:SpatialViewDefinition",
      "BisCore:DrawingViewDefinition",
    ];
    const acceptedViewSpecs = viewSpecs.filter((spec) => (-1 !== acceptedViewClasses.indexOf(spec.classFullName)));
    if (0 === acceptedViewSpecs.length) {
      throw new Error("No valid view definitions in imodel");
    }

    // Prefer spatial view over drawing.
    const spatialViews = acceptedViewSpecs.filter((v) => {
      return v.classFullName === "BisCore:SpatialViewDefinition";
    });

    if (spatialViews.length > 0)
      return spatialViews[0].id!;

    return acceptedViewSpecs[0].id!;
  }
}
