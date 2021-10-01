/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString } from "@bentley/bentleyjs-core";
import { RealityDataSourceKey, RealityDataSourceProps } from "@bentley/imodeljs-common";
import { RealityData, RealityDataClient } from "@bentley/reality-data-client";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { RealityDataSource, realityDataSourceKeyToString } from "./RealityDataSource";

export interface IRealityDataConnection {
  getRealityData(): RealityData | undefined;
  getRealityDataType(): string | undefined;
  getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined>;
  getSource(): RealityDataSource;
}

class RealityDataConnection implements IRealityDataConnection {
  private _rd: RealityData | undefined;
  private _rdSource: RealityDataSource;

  private constructor(props: RealityDataSourceProps) {
    this._rdSource = RealityDataSource.fromProps(props);
  }

  public static async createFromSourceKey(sk: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataConnection | undefined> {
    const props: RealityDataSourceProps = {sourceKey: sk};
    const rdConnection = new RealityDataConnection(props);
    let tilesetUrl: string | undefined;
    try {
      await rdConnection.queryRealityData(iTwinId);
      tilesetUrl = await rdConnection._rdSource.getServiceUrl(iTwinId);
    } catch (e) {
    }

    return (tilesetUrl !== undefined) ? rdConnection : undefined;
  }
  public static async createFromUrl(url: string, iTwinId: GuidString): Promise<RealityDataConnection | undefined>  {
    const sourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(url);
    return RealityDataConnection.createFromSourceKey(sourceKey, iTwinId);
  }

  public async queryRealityData(iTwinId: GuidString | undefined) {
    if (this._rdSource.isContextShare && !this._rd) {
      const token = await this._rdSource.getAccessToken();
      if (token && this._rdSource.realityDataId) {
        const client = new RealityDataClient();      // we need to resolve tilesetURl from realityDataId and iTwinId
        const requestContext = new AuthorizedFrontendRequestContext(token);
        this._rd = await client.getRealityData(requestContext,iTwinId, this._rdSource.realityDataId);
      }
    }
  }

  public getRealityData(): RealityData | undefined {
    return this._rd;
  }

  public getRealityDataType(): string | undefined {
    return this._rd?.type;
  }
  public async getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined> {
    return this._rdSource.getServiceUrl(iTwinId);
  }
  public getSource(): RealityDataSource {
    return this._rdSource;
  }
}

export class RealityDataConnectionManager {
  private _realityDataConnections = new Map<string, IRealityDataConnection>();
  // Singleton implementation
  private static _instance: RealityDataConnectionManager = new RealityDataConnectionManager();
  public static get instance(): RealityDataConnectionManager {
    return RealityDataConnectionManager._instance;
  }
  public async getFromSourceKey(rdSourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<IRealityDataConnection | undefined> {
    // search to see if it was already created
    const rdSourceKeyString = realityDataSourceKeyToString(rdSourceKey);
    let rdConnection = this._realityDataConnections.get(rdSourceKeyString);
    if (rdConnection)
      return rdConnection;
    // If not already in our list, create and add it to our list before returing it.
    rdConnection = await RealityDataConnection.createFromSourceKey(rdSourceKey,  iTwinId);
    if (rdConnection)
      this._realityDataConnections.set(rdSourceKeyString,rdConnection);
    return rdConnection;
  }
}
