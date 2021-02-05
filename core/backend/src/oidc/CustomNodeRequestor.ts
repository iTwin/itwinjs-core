/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Code based on @ https://github.com/openid/AppAuth-JS/blob/master/src/node_support/node_requestor.ts

/** @packageDocumentation
 * @module Authentication
 */
import { AppAuthError, log } from "@openid/appauth";
import { NodeRequestor } from "@openid/appauth/built/node_support";
import * as Url from "url";
import {http, https} from "follow-redirects";
import { RequestGlobalOptions } from "@bentley/itwin-client";

export class CustomNodeRequestor extends NodeRequestor {
  public async xhr<T>(settings: JQueryAjaxSettings): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // implementing a subset that is required.
      const url = Url.parse(settings.url!);
      const data = settings.data;

      const options: any = {
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        method: settings.method,
      };

      if(settings.headers){
        options.headers = {
          "content-Type": settings.headers["Content-Type"],
        };
      }

      if(RequestGlobalOptions.httpsProxy)
        options.agent = RequestGlobalOptions.httpsProxy;

      let protocol: any = https;
      if (url.protocol && url.protocol.toLowerCase() === "http:") {
        protocol = http;
      }

      const request = protocol.request(options, (response: any) => {
        const chunks: string[] = [];
        response.on("data", (chunk: any) => {
          chunks.push(chunk.toString());
        });
        response.on("end", () => {
          const body = chunks.join("");
          if (settings.dataType === "json") {
            try {
              resolve((JSON.parse(body) ) as T);
            } catch (err) {
              log("Could not parse json response", body);
            }
          } else {
            resolve((body as any) as T);
          }
        });
      });

      request.on("error", (e: Error) => {
        reject(new AppAuthError(e.toString()));
      });

      if (data) {
        request.write(data);
      }
      request.end();
    });

  }
}
