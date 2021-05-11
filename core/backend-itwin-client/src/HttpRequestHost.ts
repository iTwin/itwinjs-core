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
export class HttpRequestHost {
  private static _proxyUrl?: string;

  /** Initialize the configuration for all HTTP service requests made from the backend */
  public static async initialize() {
    // Route requests through any proxy identified by environment
    // NEEDS_WORK: Should validate the proxy, and throw an error if unreachable - isReachable call below doesn't seem to succeed for some proxies
    if (process.env.HTTPS_PROXY) {
      this.setupProxy(process.env.HTTPS_PROXY);
      return;
    }

    // Setup fiddler as a proxy automatically if it's reachable
    const fiddlerProxyUrl = "http://127.0.0.1:8888";
    const isProxyReachable = await HttpRequestHost.isHostReachable(fiddlerProxyUrl);
    if (isProxyReachable)
      this.setupProxy(fiddlerProxyUrl);
  }

  private static setupProxy(proxyUrl: string) {
    const createHttpsProxy = (additionalOptions?: https.AgentOptions): https.Agent | undefined => {
      if (HttpRequestHost._proxyUrl === undefined)
        return undefined;

      const proxyAgentOptions = url.parse(HttpRequestHost._proxyUrl);
      const mergedAgentOptions: HttpsProxyAgentOptions = additionalOptions !== undefined ? { ...additionalOptions, ...proxyAgentOptions } : { ...proxyAgentOptions };
      return new HttpsProxyAgent(mergedAgentOptions);
    };

    const unquoteString = (str: string) => str.replace(/(^["'`])|(["'`]$)/g, "");

    HttpRequestHost._proxyUrl = unquoteString(proxyUrl);
    const httpsProxy = createHttpsProxy();
    if (httpsProxy === undefined)
      return;

    RequestGlobalOptions.createHttpsProxy = createHttpsProxy;
    RequestGlobalOptions.httpsProxy = httpsProxy;

    // NEEDS_WORK: Temporary fix for Electron (DesktopAuthorizationClient)
    // - needs to be automatically configured based on Operating System settings on desktops
    // - global setting of agent may also not be needed except for DesktopAuthorizationClient
    (httpsProxy as HttpsProxyAgent).protocol = "https:";
    (https.globalAgent as any) = httpsProxy;

    const proxyUrlParts = url.parse(HttpRequestHost._proxyUrl);
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
