/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as http from "http";
import * as https from "https";
import * as url from "url";
import { RequestGlobalOptions } from "@bentley/itwin-client";

import HttpsProxyAgent = require("https-proxy-agent");
/** Utility to configure all HTTP service requests make from the backend
 * @internal
 */
export class RequestHost {

  /** Initialize the configuration for all HTTP service requests made from the backend */
  public static async initialize(): Promise<void> {
    /* Set up requests to be routed through any proxy server identified by the HTTPS_PROXY
     * environment variable. If the environment is not defined, checks if the fiddler proxy
     * is reachable and can be setup for debugging. */
    if (process.env.HTTPS_PROXY)
      await this.setupProxyIfReachable(process.env.HTTPS_PROXY, true);
    else
      await this.setupProxyIfReachable("http://127.0.0.1:8888", false); // Fiddler proxy
  }

  /** Sets up the supplied proxy is reachable */
  private static async setupProxyIfReachable(proxyUrl: string, errorIfUnreachable: boolean = false): Promise<boolean> {
    const isProxyReachable = await RequestHost.isHostReachable(proxyUrl);
    if (!isProxyReachable) {
      if (errorIfUnreachable)
        console.log(`Unable to reach proxy server defined by HTTPS_PROXY: ${process.env.HTTPS_PROXY}. Proxy server not setup!`); // eslint-disable-line no-console
      return false;
    }

    RequestGlobalOptions.httpsProxy = new HttpsProxyAgent(proxyUrl);
    const protocol = RequestHost.getProtocol(proxyUrl);
    if (protocol === "http")
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.log(`Routing requests through HTTPS_PROXY: ${proxyUrl}`); // eslint-disable-line no-console
    return true;
  }

  /** Gets the protocol of the specified url */
  private static getProtocol(hostUrl: string): string {
    return (url.parse(hostUrl).protocol || ":").slice(0, -1);
  }

  /** Returns true if the supplied host URL is reachable */
  private static async isHostReachable(hostUrl: string): Promise<boolean> {
    return new Promise<boolean>(((resolve) => {
      const protocol = RequestHost.getProtocol(hostUrl);
      const parseResponse = (response: http.IncomingMessage) => {
        resolve(response.statusCode === 200);
      };

      let request: any;
      try {
        if (protocol === "http")
          request = http.request(hostUrl, parseResponse);
        else if (protocol === "https")
          request = https.request(hostUrl, parseResponse);
        else
          resolve(false);
      } catch (error) {
        resolve(false);
      }
      request.on("error", (_err: any) => {
        resolve(false);
      });
      request.end();
    }));
  }
}
