/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CheckpointConnection } from "@itwin/core-frontend";
import { IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { Project as ITwin, ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import { IModelData } from "../../common/Settings";
import { AccessToken } from "@itwin/core-bentley";

export class IModelSession {

  public iTwinId: string;
  public iModelId: string;
  public changesetId?: string;

  private _iModel?: CheckpointConnection;

  public constructor(iModelId: string, iTwinId: string, changesetId?: string) {
    this.iTwinId = iTwinId;
    this.iModelId = iModelId;
    this.changesetId = changesetId;
  }

  public static async create(requestContext: AccessToken, iModelData: IModelData): Promise<IModelSession> {
    let contextId;
    let imodelId;

    // Turn the iTwin name into an id
    if (iModelData.useITwinName && iModelData.iTwinName) {
      const client = new ProjectsAccessClient();
      const iTwinList: ITwin[] = await client.getAll(requestContext, {
        search: {
          searchString: iModelData.iTwinName,
          propertyName: ProjectsSearchableProperty.Name,
          exactMatch: true,
        },
      });

      if (iTwinList.length === 0)
        throw new Error(`ITwin ${iModelData.iTwinName} was not found for the user.`);
      else if (iTwinList.length > 1)
        throw new Error(`Multiple iTwins named ${iModelData.iTwinName} were found for the user.`);

      contextId = iTwinList[0].id;
    } else
      contextId = iModelData.iTwinId!;

    if (iModelData.useName) {
      const imodelClient = new IModelHubClient();
      const imodels = await imodelClient.iModels.get(requestContext, contextId, new IModelQuery().byName(iModelData.name!));
      if (undefined === imodels || imodels.length === 0)
        throw new Error(`The iModel ${iModelData.name} does not exist in project ${contextId}.`);
      imodelId = imodels[0].wsgId;
    } else
      imodelId = iModelData.id!;

    console.log(`Using iModel { name:${iModelData.name}, id:${imodelId}, iTwinId:${contextId}, changesetId:${iModelData.changesetId} }`); // eslint-disable-line no-console

    return new IModelSession(imodelId, contextId, iModelData.changesetId);
  }

  public async getConnection(): Promise<CheckpointConnection> {
    return undefined === this._iModel ? this.open() : this._iModel;
  }

  public async open(): Promise<CheckpointConnection> {
    try {
      // eslint-disable-next-line no-console
      console.log(`Environment: ${process.env.IMJS_URL_PREFIX}`);
      this._iModel = await CheckpointConnection.openRemote(this.iTwinId, this.iModelId);
      expect(this._iModel).to.exist;
    } catch (e: any) {
      throw new Error(`Failed to open test iModel. Error: ${e.message}`);
    }

    return this._iModel;
  }
}
