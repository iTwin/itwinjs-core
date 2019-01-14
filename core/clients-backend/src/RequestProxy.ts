
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RequestGlobalOptions } from "@bentley/imodeljs-clients";
import HttpsProxyAgent = require("https-proxy-agent");
import * as http from "http";

/** Utility to setup global options for backend HTTP requests */
export class RequestProxy {

  /** Returns true if the fiddler proxy is reachable */
  public static async setupFiddlerProxyIfReachable() {
    const url = "http://127.0.0.1:8888";
    if (await RequestProxy.isHostReachable(url)) {
      console.log("Detected fiddler session - routing requests through proxy"); // tslint:disable-line:no-console
      RequestGlobalOptions.HTTPS_PROXY = new HttpsProxyAgent(url);
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
  }

  private static async isHostReachable(url: string): Promise<boolean> {
    return new Promise<boolean>(((resolve) => {
      const request = http.request(url, (response) => {
        if (response.statusCode === 200)
          resolve(true);
        else
          resolve(false);
      });
      request.on("error", (_err) => {
        resolve(false);
      });
      request.end();
    }));
  }
}
