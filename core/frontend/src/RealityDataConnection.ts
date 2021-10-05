/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString } from "@bentley/bentleyjs-core";
import { RealityDataSourceKey, RealityDataSourceProps } from "@bentley/imodeljs-common";
import { RealityData, RealityDataClient } from "@bentley/reality-data-client";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { RealityDataSource, realityDataSourceKeyToString } from "./RealityDataSource";

/**
 * This interface provide methods used to access a reality data from ContextShare
 * @alpha
 */
export interface RealityDataConnection {
  readonly realityData: RealityData | undefined;
  readonly realityDataType: string | undefined;
  getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined>;
  getSource(): RealityDataSource;
}

/**
 * This class encapsulates access to a reality data from ContextShare
 * There is a one to one relationship between a reality data and the instances of present class.
 * @alpha
 */
class RealityDataConnectionImpl implements RealityDataConnection {
  private _rd: RealityData | undefined;
  private _rdSource: RealityDataSource;

  private constructor(props: RealityDataSourceProps) {
    this._rdSource = RealityDataSource.fromProps(props);
  }
  /**
   * Create an instance of this class from a source key and iTwin context/
   * @alpha
   */
  public static async createFromSourceKey(sk: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataConnection | undefined> {
    const props: RealityDataSourceProps = {sourceKey: sk};
    const rdConnection = new RealityDataConnectionImpl(props);
    let tilesetUrl: string | undefined;
    try {
      await rdConnection.queryRealityData(iTwinId);
      tilesetUrl = await rdConnection._rdSource.getServiceUrl(iTwinId);
    } catch (e) {
    }

    return (tilesetUrl !== undefined) ? rdConnection : undefined;
  }
  /**
   * Query Reality Data from provider
   */
  private async queryRealityData(iTwinId: GuidString | undefined) {
    if (this._rdSource.isContextShare && !this._rd) {
      const token = await this._rdSource.getAccessToken();
      if (token && this._rdSource.realityDataId) {
        const client = new RealityDataClient();      // we need to resolve tilesetURl from realityDataId and iTwinId
        const requestContext = new AuthorizedFrontendRequestContext(token);
        this._rd = await client.getRealityData(requestContext,iTwinId, this._rdSource.realityDataId);
      }
    }
  }
  /**
   * Returns Reality Data if available
   */
  public get realityData(): RealityData | undefined {
    return this._rd;
  }
  /**
   * Returns Reality Data type if available
   */
  public get realityDataType(): string | undefined {
    return this._rd?.type;
  }
  /**
   * This method returns the URL to obtain the Reality Data details from PW Context Share.
   * Technically it should never be required as the RealityData object returned should have all the information to obtain the
   * data.
   * @param iTwinId id of associated iTwin project
   * @returns string containing the URL to reality data for indicated tile.
   */
  public async getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined> {
    return this._rdSource.getServiceUrl(iTwinId);
  }
  /**
  * Returns the source implementation associated to this reality data connection
  */
  public getSource(): RealityDataSource {
    return this._rdSource;
  }
}

/**
 * This class manage reality data connection instance used to access reality data from ContextShare
 * There will aways be only one reality data connection for a corresponding reality data source key
 * @alpha
 */
export class RealityDataConnectionManager {
  private _realityDataConnections = new Map<string, RealityDataConnection>();
  // Singleton implementation
  private static _instance: RealityDataConnectionManager = new RealityDataConnectionManager();
  public static get instance(): RealityDataConnectionManager {
    return RealityDataConnectionManager._instance;
  }
  public async getFromSourceKey(rdSourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataConnection | undefined> {
    // search to see if it was already created
    const rdSourceKeyString = realityDataSourceKeyToString(rdSourceKey);
    let rdConnection = this._realityDataConnections.get(rdSourceKeyString);
    if (rdConnection)
      return rdConnection;
    // If not already in our list, create and add it to our list before returing it.
    rdConnection = await RealityDataConnectionImpl.createFromSourceKey(rdSourceKey,  iTwinId);
    if (rdConnection)
      this._realityDataConnections.set(rdSourceKeyString,rdConnection);
    return rdConnection;
  }
}
