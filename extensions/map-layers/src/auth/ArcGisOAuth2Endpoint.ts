/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MapLayerTokenEndpoint } from "@itwin/core-frontend";

/** @internal */
export enum ArcGisOAuth2EndpointType {Authorize,Token}

/** @internal */
export class ArcGisOAuth2Endpoint implements MapLayerTokenEndpoint {
  private _url: string;
  private _loginUrl: string;
  private _isArcgisOnline: boolean;

  constructor(url: string, loginUrl: string, isArcgisOnline: boolean) {
    this._url = url;
    this._loginUrl = loginUrl;
    this._isArcgisOnline = isArcgisOnline;
  }

  // Returns the actual endpoint url
  public getUrl() {
    return this._url;
  }

  // Returns the URL used to login and generate the Oauth token.
  public getLoginUrl(stateData?: string) {
    const urlObj = new URL(this._loginUrl);

    if (stateData !== undefined)
      urlObj.searchParams.set("state", stateData);

    return urlObj.toString();
  }

  public get isArcgisOnline() {return this._isArcgisOnline;}

}
