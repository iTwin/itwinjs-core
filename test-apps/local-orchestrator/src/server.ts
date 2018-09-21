/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:no-console
// tslint:disable:no-var-requires
import { URL } from "url";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
const httpProxy = require("http-proxy");
import { EnvMacroSubst, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelBankServerConfig, IModelBankLocalOrchestrator, RunningBank } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankLocalOrchestrator";
import { IModelBankFileSystemContextOptions, IModelBankFileSystemContext } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankFileSystemContext";
import { AccessToken, IModelRepository, IModelQuery } from "@bentley/imodeljs-clients";
import { WsgInstances, WsgIModel, makeWsgImodelInstanceContent } from "./WsgTypes";

interface OrchestratorConfig {
  baseUrl: string;
  port: number;
  verbose: boolean;
  bankfsRoot: string;
  bankPackage: string;
}

if (process.argv.length !== 6) {
  console.error(`syntax: ${process.argv0} lib/server.js orchestratorConfigJsonFileName bankServerConfigJsonFileName bankServerLoggingConfigJsonFileName backendRegistryJsonFileName`);
  process.exit(1);
}

const configFile = path.resolve(process.argv[2]);
const bankConfigFile = path.resolve(process.argv[3]);
const bankLogConfigFileName = path.resolve(process.argv[4]);
const regFile = path.resolve(process.argv[5]);

const config = require(configFile) as OrchestratorConfig;
const bankConfig = require(bankConfigFile) as IModelBankServerConfig;
EnvMacroSubst.replaceInProperties(bankConfig, true);
const reg = require(regFile);
console.log(`reg = ${JSON.stringify(reg)}`);
const env = "PROD";

const options: IModelBankFileSystemContextOptions = {
  rootDir: config.bankfsRoot,
};
const bankContext = new IModelBankFileSystemContext(options);
const localOrchestrator = new IModelBankLocalOrchestrator(bankConfig, bankLogConfigFileName, bankContext);

const ssl = {
  key: fs.readFileSync(path.resolve(path.dirname(bankConfigFile), bankConfig.keyFile)),
  cert: fs.readFileSync(path.resolve(path.dirname(bankConfigFile), bankConfig.certFile)),
};

const proxyOptions = {
  ssl,
  secure: false,
  timeout: 999999,
  proxyTimeout: 9999999,
};
const proxy = httpProxy.createProxyServer(proxyOptions);
proxy.on("error", (err: Error, _req: http.IncomingMessage, _res: http.ServerResponse) => {
  // res1.writeHead(500, {
  //   "Content-Type": "text/plain",
  // });
  // res1.end(err.stack);
  console.error(err.stack);
});
proxy.on("close", (_res: any, _socket: any, _head: any) => {
  console.log("Client disconnected");
});

function handleIModelQuery(_url: URL, req: http.IncomingMessage, res: http.ServerResponse, iModelId: string) {
  const alctx = new ActivityLoggingContext(iModelId);
  const projectId = bankContext.getContextIdForIModel(iModelId);
  if (projectId === undefined) {
    res.statusCode = 404;
    res.end();
    return;
  }
  localOrchestrator.getRunningBankFor(alctx, projectId, iModelId, env)
    .then((bank: RunningBank) => {
      proxy.web(req, res, { target: bank.url });
    })
    .catch((err: Error) => {
      res.statusCode = 500;
      res.end(JSON.stringify(err));
    });
}

function handleIModelsGetOperationWithQuery(_url: URL, _req: http.IncomingMessage, res: http.ServerResponse, projectId: string, query: IModelQuery | undefined) {
  const actx = new ActivityLoggingContext("");
  const response: WsgInstances<WsgIModel> = { instances: [] };
  bankContext.queryIModels(actx, {} as AccessToken, projectId, query)
    .then((repos: IModelRepository[]) => {
      for (const repo of repos)
        response.instances.push(makeWsgImodelInstanceContent(repo.wsgId, repo));
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(response));
    });
}

function handelIModelGetInstanceOperation(url: URL, req: http.IncomingMessage, res: http.ServerResponse, projectId: string) {
  const pathComponents = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/");
  const iModelId = pathComponents.slice(-1)[0];
  const query = new IModelQuery();
  query.byId(iModelId);
  handleIModelsGetOperationWithQuery(url, req, res, projectId, query);
}

function handelIModelsGetOperation(url: URL, req: http.IncomingMessage, res: http.ServerResponse, projectId: string) {
  let query: IModelQuery | undefined;
  const match = /[$]filter=[$]id[+]eq[+]'(.+)'/.exec(url.search);   // TODO: For now, this is the only query we support
  if (match) {
    const iModelId = match[1];
    query = new IModelQuery();
    query.byId(iModelId);
  }
  handleIModelsGetOperationWithQuery(url, req, res, projectId, query);
}

function handleProjectQuery(url: URL, req: http.IncomingMessage, res: http.ServerResponse, projectId: string) {
  if (/\/ProjectScope\/iModel\/.+/.test(url.pathname)) {      // ProjectScope/iModel/{instanceId}
    handelIModelGetInstanceOperation(url, req, res, projectId);
  } else if (/\/ProjectScope\/iModel\/?$/.test(url.pathname)) { // ProjectScope/iModel
    handelIModelsGetOperation(url, req, res, projectId);
  } else {
    console.error(`TODO handleProjectQuery ${url.pathname} - projectId=${projectId}`);

    res.statusCode = 503;
    res.end();
  }
}

function handleGlobalQuery(url: URL, _req: http.IncomingMessage, res: http.ServerResponse) {
  console.error(`TODO handleGlobalQuery ${url.pathname}`);
  res.statusCode = 503;
  res.end();
}

async function routeIModelServerReq(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url!, config.baseUrl + "/");

  const pathComponents = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/");
  let scope: string;
  let id: string;
  [scope, id] = pathComponents[2].split("--");

  switch (scope) {
    case "iModel":
      handleIModelQuery(url, req, res, id);
      break;
    case "Project":
      handleProjectQuery(url, req, res, id);
      break;
    case "Global":
      handleGlobalQuery(url, req, res);
      break;
    default:
      console.error(`ERROR! unsupported iModelHub query ${url.pathname}`);
      res.statusCode = 503;
      res.end();
  }
}

const server = https.createServer(ssl, (req: http.IncomingMessage, res: http.ServerResponse) => {
  console.error(`${req.method} ${req.url!}`);
  if (req.url!.indexOf("v2.0/Plugins") !== -1) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Server", "Bentley-WSG/01.02.00.00,Bentley-WebAPI/02.05.00.00");
    res.end("");
    return;
  }
  if (/^\/([^\/]+)\/Repositories\//.test(req.url!)) {
    routeIModelServerReq(req, res);
  } else {
    // TODO RpcInterface req
    console.error(`Not handled: ${req.url}`);
    res.statusCode = 503;
    res.end();
  }
});

console.log(`listening on port ${config.port}`);
server.listen(config.port);
