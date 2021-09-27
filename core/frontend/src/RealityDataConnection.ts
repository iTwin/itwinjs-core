/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString, Logger } from "@bentley/bentleyjs-core";
import { RealityDataConnectionProps, RealityDataProvider, RealityDataSourceProps } from "@bentley/imodeljs-common";
import { AccessToken } from "@bentley/itwin-client";
import { RealityData, RealityDataClient } from "@bentley/reality-data-client";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { IModelApp } from "./IModelApp";

export class RealityDataSource {
  protected readonly _props: RealityDataSourceProps;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  public readonly provider: RealityDataProvider;
  /** Identifier that can be used to elide a request to the reality data service. */
  public readonly realityDataId?: string;
  /** The iTwin id that identify the "context" for the provider. */
  public readonly iTwinId?: GuidString;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  protected _tilesetUrl: string;
  protected _isUrlResolved: boolean = false;
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  protected constructor(props: RealityDataSourceProps) {
    this._props = props;
    this.provider = props.provider;
    this.realityDataId = props.realityDataId;
    this.iTwinId = props.iTwinId;
    this._tilesetUrl = props.tilesetUrl ?? "";
    if (this.provider === RealityDataProvider.TilesetUrl)
      this._isUrlResolved=true;
  }
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public static fromProps(props: RealityDataSourceProps): RealityDataSource {
    return new RealityDataSource(props);
  }
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public static fromUrl(url: string): RealityDataSource {
    const props: RealityDataSourceProps = {
      provider: RealityDataProvider.TilesetUrl,
      tilesetUrl: url,
    };
    return new RealityDataSource(props);
  }
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public toProps(): RealityDataSourceProps {
    const props: RealityDataSourceProps = {
      provider: this.provider,
      realityDataId: this.realityDataId,
      iTwinId: this.iTwinId,
      tilesetUrl: this._tilesetUrl,
    };
    return props;
  }
  protected async getAccessToken(): Promise<AccessToken | undefined> {
    if (!IModelApp.authorizationClient || !IModelApp.authorizationClient.hasSignedIn)
      return undefined; // Not signed in
    let accessToken: AccessToken;
    try {
      accessToken = await IModelApp.authorizationClient.getAccessToken();
    } catch (error) {
      return undefined;
    }
    return accessToken;
  }
  /**
   * This method returns the URL to access the actual 3d tiles from the service provider.
   * @returns string containing the URL to reality data.
   */
  public async getTilesetUrl(): Promise<string> {
    // If url was not resolved - resolve it
    if (this.provider === RealityDataProvider.ContextShare && !this._isUrlResolved && this.realityDataId) {
      // we need to resolve tilesetURl from realityDataId and iTwinId
      const client = new RealityDataClient();
      try {
        const accessToken = await this.getAccessToken();
        if (accessToken) {
          const authRequestContext = new AuthorizedFrontendRequestContext(accessToken);
          authRequestContext.enter();
          this._tilesetUrl = await client.getRealityDataUrl(authRequestContext, this.iTwinId, this.realityDataId);
          this._isUrlResolved=true;
        }
      } catch (e) {
        const errMsg = `Error getting URL from ContextShare using realityDataId=${this.realityDataId} and iTwinId=${this.iTwinId}`;
        Logger.logError(FrontendLoggerCategory.RealityData, errMsg);
      }
    }
    return this._tilesetUrl;
  }

  /**
   * This method returns the URL to obtain the Reality Data details from PW Context Share.
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(): Promise<string> {
    // If url was not resolved - resolve it
    if (this.provider === RealityDataProvider.ContextShare && !this._isUrlResolved && this.realityDataId) {
      // we need to resolve tilesetURl from realityDataId and iTwinId
      const client = new RealityDataClient();
      try {
        const accessToken = await this.getAccessToken();
        if (accessToken) {
          const authRequestContext = new AuthorizedFrontendRequestContext(accessToken);
          authRequestContext.enter();
          this._tilesetUrl = await client.getRealityDataUrl(authRequestContext, this.iTwinId,this.realityDataId);
          this._isUrlResolved=true;
        }
      } catch (e) {
        const errMsg = `Error getting URL from ContextShare using realityDataId=${this.realityDataId} and iTwinId=${this.iTwinId}`;
        Logger.logError(FrontendLoggerCategory.RealityData, errMsg);
      }
    }
    return this._tilesetUrl;
  }

  public static equal(lhsProps: RealityDataSourceProps, rhsProps: RealityDataSourceProps): boolean {
    if (lhsProps.iTwinId !== rhsProps.iTwinId)
      return false;
    if (lhsProps.provider !== rhsProps.provider)
      return false;
    if (lhsProps.realityDataId !== rhsProps.realityDataId)
      return false;
    if (lhsProps.tilesetUrl !== rhsProps.tilesetUrl)
      return false;
    return true;
  }
}

export class RealityDataConnection extends RealityDataSource {
  private _rd: RealityData | undefined;

  private constructor(props: RealityDataSourceProps) {
    super(props);
  }

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  // public static override fromProps(props: RealityDataSourceProps | RealityDataConnectionProps): RealityDataConnection {
  //   return new RealityDataConnection(props);
  // }
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public static override fromUrl(url: string): RealityDataConnection {
    const props: RealityDataSourceProps = {
      provider: RealityDataProvider.TilesetUrl,
      tilesetUrl: url,
    };
    return new RealityDataConnection(props);
  }
  /** Create a new RealityDataConnection object from a set of properties.
   * @param props JSON representation of the reality data source or RealityDataConnectionProps
   */
  public static async createFromProps(props: RealityDataSourceProps | RealityDataConnectionProps): Promise<RealityDataConnection | undefined>  {
    const rdConnection = new RealityDataConnection(props);
    let tilesetUrl: string | undefined;
    try {
      await rdConnection.queryRealityData();
      tilesetUrl = await rdConnection.getTilesetUrl();
    } catch (e) {
    }

    return (tilesetUrl !== undefined) ? rdConnection : undefined;
  }
  public static async createFromUrl(url: string): Promise<RealityDataConnection | undefined>  {
    const rdConnection =  RealityDataConnection.fromUrl(url);
    let tilesetUrl: string | undefined;
    try {
      await rdConnection.queryRealityData();
      tilesetUrl = await rdConnection.getTilesetUrl();
    } catch (e) {
    }
    return tilesetUrl ? rdConnection : undefined;
  }

  public async queryRealityData() {
    if (this.provider === RealityDataProvider.ContextShare && this._rd === undefined) {
      const token = await this.getAccessToken();
      if (token && this.realityDataId) {
        const client = new RealityDataClient();      // we need to resolve tilesetURl from realityDataId and iTwinId
        const requestContext = new AuthorizedFrontendRequestContext(token);
        this._rd = await client.getRealityData(requestContext,this.iTwinId, this.realityDataId);
      }
    }
  }

  public get realityData(): RealityData | undefined {
    return this._rd;
  }

  public get realityDataType(): string | undefined {
    return this._rd?.type;
  }

  /** Serialize a RealityDataConnection to JSON. The returned JSON can later be passed to [deserializeViewState] to reinstantiate the ViewState.
   * @beta
   */
  public override toProps(): RealityDataConnectionProps {
    const props: RealityDataConnectionProps = {
      provider: this.provider,
      realityDataId: this.realityDataId,
      iTwinId: this.iTwinId,
      realityDataType: this.realityDataType,
      tilesetUrl: this._tilesetUrl,
    };
    return props;
  }
}
