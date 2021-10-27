/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString } from "@itwin/core-bentley";
import { RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";
import { IModelApp } from "./IModelApp";
import { RealityData } from "./RealityDataAccessProps";
import { RealityDataSource, realityDataSourceKeyToString } from "./RealityDataSource";

/**
 * This interface provide methods used to access a reality data from ContextShare
 * @internal
 */
export interface RealityDataConnection {
  /** Metadata on the reality data source */
  readonly realityData: RealityData | undefined;
  /** The reality data type (e.g.: "RealityMesh3DTiles", OPC, Terrain3DTiles, Cesium3DTiles, ... )*/
  readonly realityDataType: string | undefined;
  /** The source provides access to the reality data provider services.*/
  readonly source: RealityDataSource;
  /**
   * This method returns the URL to obtain the Reality Data properties.
   * @param iTwinId id of associated iTwin project
   * @returns string containing the URL to reality data.
   */
  getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined>;
}

/** @internal */
export namespace RealityDataConnection {
  /** Return an instance of a RealityDataConnection from a source key.
   * There will always be only one reality data connection for a corresponding reality data source key.
   * @internal
   */
  export async function fromSourceKey(rdSourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataConnection | undefined> {
    return RealityDataConnectionImpl.fromSourceKey(rdSourceKey, iTwinId);
  }
}

/**
 * This class encapsulates access to a reality data from ContextShare
 * There is a one to one relationship between a reality data and the instances of present class.
 * @internal
 */
class RealityDataConnectionImpl implements RealityDataConnection {
  private static _realityDataConnections = new Map<string, RealityDataConnection>();
  private _rd: RealityData | undefined;
  private _rdSource: RealityDataSource;

  private constructor(props: RealityDataSourceProps) {
    this._rdSource = RealityDataSource.fromProps(props);
  }
  public static async fromSourceKey(rdSourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataConnection | undefined> {
    // search to see if it was already created
    const rdSourceKeyString = realityDataSourceKeyToString(rdSourceKey);
    let rdConnection = RealityDataConnectionImpl._realityDataConnections.get(rdSourceKeyString);
    if (rdConnection)
      return rdConnection;
    // If not already in our list, create and add it to our list before returning it.
    rdConnection = await RealityDataConnectionImpl.createFromSourceKey(rdSourceKey,  iTwinId);
    if (rdConnection)
      RealityDataConnectionImpl._realityDataConnections.set(rdSourceKeyString,rdConnection);
    return rdConnection;
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
      const token = await IModelApp.getAccessToken();
      if (token && this._rdSource.realityDataId) {
        if (undefined === IModelApp.realityDataAccess)
          throw new Error("Missing an implementation of RealityDataAccess on IModelApp, it is required to access reality data. Please provide an implementation to the IModelApp.startup using IModelAppOptions.realityDataAccess.");
        this._rd = await IModelApp.realityDataAccess.getRealityData(token, iTwinId, this._rdSource.realityDataId);
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
   * This method returns the URL to obtain the Reality Data details.
   * @param iTwinId id of associated iTwin project
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined> {
    return this._rdSource.getServiceUrl(iTwinId);
  }
  /**
  * Returns the source implementation associated to this reality data connection
  */
  public get source(): RealityDataSource {
    return this._rdSource;
  }
}
