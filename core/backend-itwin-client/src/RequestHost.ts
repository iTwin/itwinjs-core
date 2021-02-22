/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RequestGlobalOptions } from "@bentley/itwin-client";
import * as http from "http";
import * as https from "https";
import { HttpsProxyAgent, HttpsProxyAgentOptions } from "https-proxy-agent";
import * as url from "url";

/** Utility to configure all HTTP service requests make from the backend
 * @internal
 */
export class RequestHost {
  private static _proxyUrl?: string;

  /** Initialize the configuration for all HTTP service requests made from the backend */
  public static async initialize() {
    // Route requests through any user setup proxy
    if (process.env.HTTPS_PROXY) {
      this.setupProxy(process.env.HTTPS_PROXY);
      return;
    }

    // Setup fiddler as a proxy automatically if it's reachable
    const fiddlerProxyUrl = "http://127.0.0.1:8888";
    const isProxyReachable = await RequestHost.isHostReachable(fiddlerProxyUrl);
    if (isProxyReachable)
      this.setupProxy(fiddlerProxyUrl);
  }

  /** Sets up the supplied proxy is reachable */
  private static setupProxy(proxyUrl: string) {
    const createHttpsProxy = (additionalOptions?: https.AgentOptions): https.Agent | undefined => {
      if (RequestHost._proxyUrl === undefined)
        return undefined;

      const proxyAgentOptions = url.parse(RequestHost._proxyUrl);
      const mergedAgentOptions: HttpsProxyAgentOptions = additionalOptions !== undefined ? { ...additionalOptions, ...proxyAgentOptions } : { ...proxyAgentOptions };
      return new HttpsProxyAgent(mergedAgentOptions);
    };

    const unquoteString = (str: string) => str.replace(/(^["'`])|(["'`]$)/g, "");

    RequestHost._proxyUrl = unquoteString(proxyUrl);
    const httpsProxy = createHttpsProxy();
    if (httpsProxy === undefined)
      return;

    RequestGlobalOptions.createHttpsProxy = createHttpsProxy;
    RequestGlobalOptions.httpsProxy = httpsProxy;

    // NEEDS_WORK: Temporary fix for Electron (DesktopAuthorizationClient)
    // - needs to be automatically configured based on system proxy.
    // - global setting otherwise not needed
    (httpsProxy as HttpsProxyAgent).protocol = "https:";
    (https.globalAgent as any) = httpsProxy;

    const proxyUrlParts = url.parse(RequestHost._proxyUrl);
    if (this.isHttp(proxyUrlParts.protocol))
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.log(`Routing requests through HTTPS_PROXY: ${proxyUrl}`); // eslint-disable-line no-console
  }

  private static isHttps(protocol?: string): boolean {
    return protocol !== undefined ? /^https:?$/i.test(protocol) : false;
  }

  private static isHttp(protocol?: string): boolean {
    return protocol !== undefined ? /^http:?$/i.test(protocol) : false;
  }

  /** Returns true if the supplied host URL is reachable */
  private static async isHostReachable(hostUrl: string): Promise<boolean> {
    return new Promise<boolean>(((resolve) => {
      const urlParts = url.parse(hostUrl);
      const protocol = urlParts.protocol;
      const parseResponse = (response: http.IncomingMessage) => {
        resolve(response.statusCode === 200);
      };
      let request: any;
      if (this.isHttps(protocol))
        request = https.request(hostUrl, parseResponse);
      else if (this.isHttp(protocol))
        request = http.request(hostUrl, parseResponse);
      else
        resolve(false);

      request.on("error", (_err: any) => {
        resolve(false);
      });
      request.end();
    }));
  }
}
