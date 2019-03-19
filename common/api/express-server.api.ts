// @public
class IModelJsExpressServer {
  constructor(protocol: WebAppRpcProtocol);
  // (undocumented)
  protected _app: import("express").Application;
  // (undocumented)
  protected _configureHeaders(): void;
  // (undocumented)
  protected _configureMiddleware(): void;
  // (undocumented)
  protected _configureRoutes(): void;
  initialize(port: number | string): Promise<HttpServer>;
}

// (No @packagedocumentation comment for this package)
