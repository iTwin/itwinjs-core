/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CheckpointConnection, IModelApp } from "@itwin/core-frontend";
import { ITwin, ITwinsAccessClient, ITwinsAPIResponse, ITwinSubClass } from "@itwin/itwins-client";
import { IModelData } from "../../common/Settings";
import { IModelVersion } from "@itwin/core-common";
import { AccessToken } from "@itwin/core-bentley";
import { IModelsClient } from "@itwin/imodels-client-management";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";

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

      const client = new ITwinsAccessClient();
      const iTwinListResponse: ITwinsAPIResponse<ITwin[]> = await client.queryAsync(requestContext, ITwinSubClass.Project , {
        displayName: iModelData.iTwinName,
      });
      const iTwinList = iTwinListResponse.data;
      if (!iTwinList) {
        throw new Error(`ITwin ${iModelData.iTwinName} returned with no data when queried.`);
      }
      if (iTwinList.length === 0)
        throw new Error(`ITwin ${iModelData.iTwinName} was not found for the user.`);
      else if (iTwinList.length > 1)
        throw new Error(`Multiple iTwins named ${iModelData.iTwinName} were found for the user.`);

      iTwinId = iTwinList[0].id ?? iModelData.iTwinId!;
    } else
      iTwinId = iModelData.iTwinId!;

    if (iModelData.useName) {
      const imodelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels`}});
      const imodels = imodelClient.iModels.getRepresentationList({
        authorization: AccessTokenAdapter.toAuthorizationCallback(await IModelApp.getAccessToken()),
        urlParams: {
          iTwinId,
          name: iModelData.name,
        },
      });
      for await (const iModel of imodels) {
        imodelId = iModel.id;
        break;
      }
      if (!imodelId)
        throw new Error(`The iModel ${iModelData.name} does not exist in iTwin ${iTwinId}.`);
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
