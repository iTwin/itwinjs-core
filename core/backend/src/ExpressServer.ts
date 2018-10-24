/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as bodyParser from "body-parser";
import { WebAppRpcProtocol } from "@bentley/imodeljs-common/lib/rpc/web/WebAppRpcProtocol";

// Note that we're never actually importing express here - we're only using import types, so the generated .js never includes `require("express")`
// This way, the imodeljs-backend package doesn't need to have a dependency on express.
// tslint:disable:whitespace -- FIXME: This is a bug in TSLint: https://github.com/palantir/tslint/issues/3987
type ExpressApp = import("express").Application;
type HttpServer = import("http").Server;
// tslint:enable:whitespace
/**
 * An express web server with some reasonable defaults for web applications built with @bentley/webpack-tools.
 */
export class IModelJsExpressServer {
  private _protocol: WebAppRpcProtocol;
  protected _app: ExpressApp;

  constructor(app: ExpressApp, protocol: WebAppRpcProtocol) {
    this._app = app;
    this._protocol = protocol;
  }

  protected _configureMiddleware() {
    this._app.use(bodyParser.text());
  }

  protected _configureHeaders() {
    // enable CORS for all apis
    this._app.all("/*", (_req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "X-Requested-With");
      next();
    });
  }

  protected _configureRoutes() {
    this._app.get("/v3/swagger.json", (req, res) => this._protocol.handleOpenApiDescriptionRequest(req, res));
    this._app.post("*", async (req, res) => this._protocol.handleOperationPostRequest(req, res));
  }

  /**
   * Configure the express application with necessary headers, routes, and middleware, then starts listening on the given port.
   * @param port The port to listen on
   */
  public initialize(port: number): Promise<HttpServer> {
    this._configureMiddleware();
    this._configureHeaders();
    this._configureRoutes();

    this._app.set("port", port);
    return new Promise((resolve) => {
      const server = this._app.listen(this._app.get("port"), () => resolve(server));
    });
  }
}
