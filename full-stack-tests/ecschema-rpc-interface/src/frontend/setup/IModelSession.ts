/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CheckpointConnection } from "@itwin/core-frontend";
import { IModelsClient } from "@itwin/imodels-client-management";
import { ITwin, ITwinsAccessClient, ITwinsAPIResponse, ITwinSubClass } from "@itwin/itwins-client";
import { IModelData } from "../../common/Settings";
import { AccessToken } from "@itwin/core-bentley";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";

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

  public static async create(accessToken: AccessToken, iModelData: IModelData): Promise<IModelSession> {
    let iTwinId;
    let imodelId;

    // Turn the iTwin name into an id
    if (iModelData.useITwinName && iModelData.iTwinName) {
      const client = new ITwinsAccessClient();
      const iTwinListResponse: ITwinsAPIResponse<ITwin[]> = await client.queryAsync(accessToken, ITwinSubClass.Project , {
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
      const iModels = imodelClient.iModels.getRepresentationList({
        authorization: AccessTokenAdapter.toAuthorizationCallback(accessToken),
        urlParams: {
          iTwinId,
          name: iModelData.name,
        },
      });
      for await (const iModel of iModels) {
        imodelId = iModel.id;
        break;
      }
      if (!imodelId)
        throw new Error(`The iModel ${iModelData.name} does not exist in iTwin ${iTwinId}.`);
    } else
      imodelId = iModelData.id!;

    console.log(`Using iModel { name:${iModelData.name}, id:${imodelId}, iTwinId:${iTwinId}, changesetId:${iModelData.changesetId} }`); // eslint-disable-line no-console

    return new IModelSession(imodelId, iTwinId, iModelData.changesetId);
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
