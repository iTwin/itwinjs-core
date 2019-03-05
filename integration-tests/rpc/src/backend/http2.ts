/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import * as http2 from "http2";
import { BentleyCloudRpcManager, BentleyCloudRpcConfiguration, HttpServerRequest, HttpServerResponse } from "@bentley/imodeljs-common";
import { rpcInterfaces } from "../common/TestRpcInterface";

import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import "./CommonBackendSetup";

registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "http2");

async function init() {
  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "integration-test", version: "v1.0" } }, rpcInterfaces);
  // create a basic express web server
  const port = Number(process.env.PORT || 3021);
  await initHttpForConfig(rpcConfig, port);
  // tslint:disable-next-line:no-console
  console.log("HTTP2 Web backend for integration-tests listening on port " + port);
}

async function initHttpForConfig(rpcConfig: BentleyCloudRpcConfiguration, port: number) {
  const http2Options = { key: fs.readFileSync(path.join(__dirname, "../../local_dev_server.key")), cert: fs.readFileSync(path.join(__dirname, "../../local_dev_server.crt")) };
  http2.createSecureServer(http2Options, (req2, res2) => {
    if (req2.method === "GET") {
      handleHttp2Get(req2, res2);
    } else if (req2.method === "POST") {
      handleHttp2Post(req2, res2); // tslint:disable-line:no-floating-promises
    }
  }).listen(port);

  function handleHttp2Get(req2: http2.Http2ServerRequest, res2: http2.Http2ServerResponse) {
    const { req, res } = wrapHttp2API(req2, res2);

    if (req2.url.indexOf("/v3/swagger.json") === 0) {
      rpcConfig.protocol.handleOpenApiDescriptionRequest(req, res);
    } else if (req2.url.match(/\/imodel\//)) {
      rpcConfig.protocol.handleOperationGetRequest(req, res); // tslint:disable-line:no-floating-promises
    } else {
      // serve static assets...
      const p = path.join(__dirname, "/public", req2.url); // FYI: path.join(...req.url) is NOT safe for a production server
      if (fs.existsSync(p)) {
        fs.createReadStream(p).pipe(req2.stream);
      } else {
        res2.statusCode = 404;
        res2.end("");
      }
    }
  }

  async function handleHttp2Post(req2: http2.Http2ServerRequest, res2: http2.Http2ServerResponse) {
    const { req, res } = wrapHttp2API(req2, res2);

    try {
      req.body = await readHttp2Body(req2);
      rpcConfig.protocol.handleOperationPostRequest(req, res); // tslint:disable-line:no-floating-promises
    } catch (err) {
      res2.end(`Fatal testbed error: ${err.toString()}`);
    }
  }

  async function readHttp2Body(req2: http2.Http2ServerRequest) {
    return new Promise<string | Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req2.on("data", (chunk) => {
        chunks.push(chunk);
      }).on("end", () => {
        const body = Buffer.concat(chunks);
        resolve((req2.headers["content-type"] === "application/octet-stream") ? body : body.toString());
      }).on("error", (err) => {
        reject(err);
      });
    });
  }

  function wrapHttp2API(req2: http2.Http2ServerRequest, res2: http2.Http2ServerResponse) {
    const req: HttpServerRequest = req2 as any;
    const res: HttpServerResponse = res2 as any;

    req.path = req2.url;

    req.header = (field: string) => {
      const value = req2.headers[field.toLowerCase()];
      if (Array.isArray(value)) return value.join(",");
      return value;
    };

    res.send = (body?: any) => {
      res2.end(body);
      return res;
    };

    res.set = (field: string, value: string) => {
      res2.setHeader(field, value);
    };

    res.status = (code: number) => {
      res2.statusCode = code;
      return res;
    };

    return { req, res };
  }
}

module.exports = init();
