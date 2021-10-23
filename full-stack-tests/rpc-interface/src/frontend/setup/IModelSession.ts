/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CheckpointConnection } from "@itwin/core-frontend";
import { IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { Project as ITwin, ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import { IModelData } from "../../common/Settings";
import { IModelVersion } from "@itwin/core-common";
import { AccessToken } from "@itwin/core-bentley";

export class IModelSession {

  public iTwinId: string;
  public iModelId: string;
  public changesetId?: string;
  private _imodelVersion: IModelVersion;

  private _iModel?: CheckpointConnection;

  private constructor(iTwinId: string, imodelId: string, changesetId?: string) {
    this.iTwinId = iTwinId;
    this.iModelId = imodelId;
    this.changesetId = changesetId;

    this._imodelVersion = changesetId ? IModelVersion.asOfChangeSet(changesetId) : IModelVersion.latest();
  }

  public static async create(requestContext: AccessToken, iModelData: IModelData): Promise<IModelSession> {
    let iTwinId;
    let imodelId;

    // Turn the iTwin name into an id
    if (iModelData.useITwinName) {
      if (!iModelData.iTwinName)
        throw new Error(`The iModel has no iTwin name, so it cannot get the iTwin.`);

      const client = new ProjectsAccessClient();
      const iTwinList: ITwin[] = await client.getAll(requestContext, {
        search: {
          searchString: iModelData.iTwinName,
          propertyName: ProjectsSearchableProperty.Name,
          exactMatch: true,
        }});

      if (iTwinList.length === 0)
        throw new Error(`ITwin ${iModelData.iTwinName} was not found for the user.`);
      else if (iTwinList.length > 1)
        throw new Error(`Multiple iTwins named ${iModelData.iTwinName} were found for the user.`);

      iTwinId = iTwinList[0].id;
    } else
      iTwinId = iModelData.iTwinId!;

    if (iModelData.useName) {
      const imodelClient = new IModelHubClient();
      const imodels = await imodelClient.iModels.get(requestContext, iTwinId, new IModelQuery().byName(iModelData.name!));
      if (undefined === imodels || imodels.length === 0)
        throw new Error(`The iModel ${iModelData.name} does not exist in iTwin ${iTwinId}.`);
      imodelId = imodels[0].wsgId;
    } else
      imodelId = iModelData.id!;

    console.log(`Using iModel { name:${iModelData.name}, id:${iModelData.id}, iTwinId:${iModelData.iTwinId}, changesetId:${iModelData.changeSetId} }`); // eslint-disable-line no-console

    return new IModelSession(iTwinId, imodelId, iModelData.changeSetId);
  }

  public async getConnection(): Promise<CheckpointConnection> {
    return undefined === this._iModel ? this.open() : this._iModel;
  }

  public async open(): Promise<CheckpointConnection> {
    try {
      // eslint-disable-next-line no-console
      console.log(`Environment: ${process.env.IMJS_URL_PREFIX}`);
      this._iModel = await CheckpointConnection.openRemote(this.iTwinId, this.iModelId, this._imodelVersion);
      expect(this._iModel).to.exist;
    } catch (e: any) {
      throw new Error(`Failed to open test iModel. Error: ${e.message}`);
    }

    return this._iModel;
  }
}
