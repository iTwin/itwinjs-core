/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { AuthorizedFrontendRequestContext, CheckpointConnection } from "@bentley/imodeljs-frontend";
import { IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/itwin-registry-client";
import { IModelData } from "../../common/Settings";
import { IModelVersion } from "@bentley/imodeljs-common";

export class IModelSession {

  public contextId: string;
  public iModelId: string;
  public changesetId?: string;
  private _imodelVersion: IModelVersion;

  private _iModel?: CheckpointConnection;

  private constructor(contextId: string, imodelId: string, changesetId?: string) {
    this.contextId = contextId;
    this.iModelId = imodelId;
    this.changesetId = changesetId;

    this._imodelVersion = changesetId ? IModelVersion.asOfChangeSet(changesetId) : IModelVersion.latest();
  }

  public static async create(requestContext: AuthorizedFrontendRequestContext, iModelData: IModelData): Promise<IModelSession> {
    let contextId;
    let imodelId;

    // Turn the project name into an id
    if (iModelData.useProjectName) {
      if (!iModelData.projectName)
        throw new Error(`The iModel has no project name, so it cannot get the project.`);
      const client = new ITwinAccessClient();
      const iTwinList: ITwin[] = await client.getAll(requestContext, {
        search: {
          searchString: iModelData.projectName,
          propertyName: ITwinSearchableProperty.Name,
          exactMatch: true,
        }});

      if (iTwinList.length === 0)
        throw new Error(`ITwin ${iModelData.projectName} was not found for the user.`);
      else if (iTwinList.length > 1)
        throw new Error(`Multiple iTwins named ${iModelData.projectName} were found for the user.`);

      contextId = iTwinList[0].id;
    } else
      contextId = iModelData.projectId!;

    if (iModelData.useName) {
      const imodelClient = new IModelHubClient();
      const imodels = await imodelClient.iModels.get(requestContext, contextId, new IModelQuery().byName(iModelData.name!));
      if (undefined === imodels || imodels.length === 0)
        throw new Error(`The iModel ${iModelData.name} does not exist in project ${contextId}.`);
      imodelId = imodels[0].wsgId;
    } else
      imodelId = iModelData.id!;

    console.log(`Using iModel { name:${iModelData.name}, id:${iModelData.id}, projectId:${iModelData.projectId}, changesetId:${iModelData.changeSetId} }`); // eslint-disable-line no-console

    return new IModelSession(contextId, imodelId, iModelData.changeSetId);
  }

  public async getConnection(): Promise<CheckpointConnection> {
    return undefined === this._iModel ? this.open() : this._iModel;
  }

  public async open(): Promise<CheckpointConnection> {
    try {
      const env = process.env.IMJS_BUDDI_RESOLVE_URL_USING_REGION ?? "";
      // eslint-disable-next-line no-console
      console.log(`Environment: ${env}`);
      this._iModel = await CheckpointConnection.openRemote(this.contextId, this.iModelId, this._imodelVersion);
      expect(this._iModel).to.exist;
    } catch (e) {
      throw new Error(`Failed to open test iModel. Error: ${e.message}`);
    }

    return this._iModel;
  }
}
