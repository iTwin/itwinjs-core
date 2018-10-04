/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */
/** Information on the host used for REST queries. */
export class Host {
  constructor(
    public name: string,
    public version: string,
    public guid: string,
    public deviceId: string,
    public description: string,
    public relyingPartyUri: string,
  ) { }
}

export enum RuntimeEnv {
  Uninitialized,
  Browser,
  Server,
}

// @todo Needs to be refactored for the service
/** Common configuration related utliities */
export class Config {
  public static host = new Host(
    "ConnectClientJsApi",
    "1.0",
    "ConnectClientJsApiGuid",
    "ConnectClientJsApiDeviceId",
    "JavaScript Client API for various Bentley Connect services",
    "https://connect-wsg20.bentley.com", // sso://wsfed_desktop/1654
  );

  /** Returns true if the code is currently executing in a browser, or false if it is executing on the server */
  public static get isBrowser(): boolean {
    return (typeof window !== "undefined");
  }

  /** Setup a proxy CORS server URL. All REST requests are then sent to this server, and the actual
   * request is appended to it. See https://www.npmjs.com/package/cors-anywhere
   */
  private static _devCorsProxyServer: string;
  public static get devCorsProxyServer(): string {
    return Config._devCorsProxyServer;
  }
  public static set devCorsProxyServer(url: string) {
    Config._devCorsProxyServer = url.replace(/\/?$/, "/");
  }

}
