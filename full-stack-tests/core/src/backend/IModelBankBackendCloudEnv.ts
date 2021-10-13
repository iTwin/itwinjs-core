/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

import * as child_process from "child_process";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { IModelBankClient, IModelBankFileSystemITwinClient, IModelCloudEnvironment } from "@bentley/imodelhub-client";
import { IModelBankBasicAuthorizationClient } from "@bentley/imodelhub-client/lib/cjs/imodelbank/IModelBankBasicAuthorizationClient";
import { IModelBankDummyAuthorizationClient } from "@bentley/imodelhub-client/lib/cjs/imodelbank/IModelBankDummyAuthorizationClient";
import { UrlFileHandler } from "@bentley/imodelhub-client/lib/cjs/itwin-client/file-handlers";
import { Logger } from "@itwin/core-bentley";

export const assetsPath = `${__dirname}/../../../lib/test/assets/`;
export const workDir = `${__dirname}/../../../lib/test/output/`;

// To run tests with imodel-bank integration:
// set NODE_EXTRA_CA_CERTS=D:\dev\imodeljs\full-stack-tests\rpc\local_dev_server.crt
// set IMJS_TEST_IMODEL_BANK to true to run tests with imodel-bank. Then either:
// set IMJS_TEST_IMODEL_BANK_URL to specify the url to locally deployed orchestrator
// or set the following so the tests would deploy a local orchestrator themselves:
// set IMJS_TEST_IMODEL_BANK_RUN_ORCHESTRATOR=%SrcRoot%\imodel-bank\local-orchestrator\lib\server.js
// set IMJS_TEST_IMODEL_BANK_LOGGING_CONFIG=<somewhere>logging.config.json

export function getIModelBankCloudEnv(): IModelCloudEnvironment {
  if (process.env.IMJS_TEST_IMODEL_BANK_RUN_ORCHESTRATOR)
    return launchLocalOrchestrator();

  const orchestratorUrl: string = process.env.IMJS_TEST_IMODEL_BANK_URL ?? "";

  const basicAuthentication: boolean = !!JSON.parse(process.env.IMJS_TEST_IMODEL_BANK_BASIC_AUTHENTICATION ?? "");
  const getAuthorizationClient = (userCredentials: any) => {
    return basicAuthentication
      ? new IModelBankBasicAuthorizationClient(userCredentials)
      : new IModelBankDummyAuthorizationClient(userCredentials);
  };

  const bankClient = new IModelBankClient(orchestratorUrl, new UrlFileHandler());
  const iTwinMgr = new IModelBankFileSystemITwinClient(orchestratorUrl);

  const cloudEnv = {
    isIModelHub: false,
    iTwinMgr,
    imodelClient: bankClient,
    getAuthorizationClient,
    shutdown: async () => 0,
    startup: async () => { },
  };

  return cloudEnv;
}

function launchLocalOrchestrator(): IModelCloudEnvironment {

  const loggingCategory = "backend-itwin-client.IModelBankCloudEnv";

  const bankFsRoot = path.join(workDir, "bankfs");

  if (fs.existsSync(bankFsRoot))
    fsextra.removeSync(bankFsRoot);
  fsextra.mkdirpSync(bankFsRoot);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require(path.resolve(__dirname, "../assets/local_orchestrator.config.json"));
  cfg.baseUrl = "https://localhost";
  cfg.port = 4000;
  cfg.imodelfsRoot = bankFsRoot;
  cfg.certFile = path.resolve(__dirname, "../assets/local_dev_server.crt");
  cfg.keyFile = path.resolve(__dirname, "../assets/local_dev_server.key");

  const serverConfigFile = path.join(workDir, "local_orchestrator.config.json");
  fs.writeFileSync(serverConfigFile, JSON.stringify(cfg));
  const loggingConfigFile = process.env.IMJS_TEST_IMODEL_BANK_LOGGING_CONFIG ?? "";
  const backendRegistryFile = path.resolve(__dirname, "../assets/local_orchestrator.backend.registry.json");

  const runOrchestratorJs = process.env.IMJS_TEST_IMODEL_BANK_RUN_ORCHESTRATOR ?? "";

  const cmdargs = [
    runOrchestratorJs,
    serverConfigFile,
    loggingConfigFile,
    backendRegistryFile,
  ];

  const proc = child_process.spawn("node", cmdargs, { stdio: "inherit" });

  async function pingServer(url: string, maxConnectAttempts: number, pauseBeforePingMillis: number): Promise<void> {
    let attempt = 1;
    do {
      try {
        await pingServerOnce(url, attempt * pauseBeforePingMillis);
      } catch (err: any) {
        if (err.errno === "ECONNREFUSED") {
          continue;
        } else {
          throw err;
        }
      }
      return;
    } while (++attempt < maxConnectAttempts);
    throw new Error("ECONNREFUSED");
  }

  async function pingServerOnce(url: string, pauseMillis: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        https.get(`${url}/sv1.1/Plugins`, (response: http.IncomingMessage) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Unexpected response. Not an iModelBank or iModelManager server? statusCode=${response.statusCode}`));
          } else {
            response.setEncoding("utf8"); // nodejs docs say "the callback must take care to consume the response data" (https://nodejs.org/api/http.html#http_http_get_options_callback)
            response.on("data", () => { });
            response.on("end", () => { resolve(); });
          }
        }).on("error", (err: Error) => {  // connection error
          reject(err);
        });
      }, pauseMillis);
    });
  }

  async function doStartup(): Promise<void> {
    const url = `${cfg.baseUrl}:${cfg.port}`;
    try {
      await pingServer(url, 10, 1000);
    } catch (err) {
      Logger.logError(loggingCategory, `Error pinging ${url}, server did not startup in time.`);
      throw err;
    }
  }

  async function doShutdown(): Promise<number> {
    return new Promise((resolve, reject) => {
      proc.on("exit", (code: number | null, _signal: string | null) => {
        resolve(code ? code : 0);
      });
      proc.on("error", (err: Error) => {
        reject(err);
      });
      proc.kill();
    });
  }

  const basicAuthentication: boolean = !!JSON.parse(process.env.IMJS_TEST_IMODEL_BANK_BASIC_AUTHENTICATION ?? "");
  const getAuthorizationClient = (userCredentials: any) => {
    return basicAuthentication
      ? new IModelBankBasicAuthorizationClient(userCredentials)
      : new IModelBankDummyAuthorizationClient(userCredentials);
  };

  const orchestratorUrl = `${cfg.baseUrl}:${cfg.port}`;
  const bankClient = new IModelBankClient(orchestratorUrl, new UrlFileHandler());
  const iTwinMgr = new IModelBankFileSystemITwinClient(orchestratorUrl);

  const cloudEnv = {
    isIModelHub: false,
    iTwinMgr,
    imodelClient: bankClient,
    getAuthorizationClient,
    shutdown: doShutdown,
    startup: doStartup,
  };

  return cloudEnv;
}
