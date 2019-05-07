/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as path from "path";
import * as child_process from "child_process";
import * as http from "http";
import * as https from "https";
import { IModelClient, IModelBankClient, IModelBankFileSystemContextClient, Config } from "@bentley/imodeljs-clients";
import { IModelBankDummyAuthorizationClient } from "@bentley/imodeljs-clients/lib/imodelbank/IModelBankDummyAuthorizationClient";
import { UrlFileHandler } from "../../UrlFileHandler";
import { TestIModelHubCloudEnv } from "./IModelHubCloudEnv";
import { workDir } from "./TestUtils";
import { Logger } from "@bentley/bentleyjs-core";

// To run tests with imodel-bank integration:
// set NODE_EXTRA_CA_CERTS=d:\imjs\imodeljs\core\clients-backend\src\test\assets\local_dev_server.crt
// set imjs_test_imodel_bank_run_orchestrator=%SrcRoot%\imodel-bank\local-orchestrator\lib\server.js
// To control logging, specifying a logger config .json file:
// set imjs_test_imodel_bank_logging_config=<somewhere>logging.config.json

export function getIModelBankCloudEnv(): [TestIModelHubCloudEnv, IModelClient] {

  const loggingCategory = "imodeljs-clients-backend.IModelBankCloudEnv";

  const bankFsRoot = path.join(workDir, "bankfs");

  if (fs.existsSync(bankFsRoot))
    fsextra.removeSync(bankFsRoot);
  fsextra.mkdirpSync(bankFsRoot);

  const cfg = require(path.resolve(__dirname, "../assets/local_orchestrator.config.json"));
  cfg.baseUrl = "https://localhost";
  cfg.port = 4000;
  cfg.imodelfsRoot = bankFsRoot;
  cfg.certFile = path.resolve(__dirname, "../assets/local_dev_server.crt");
  cfg.keyFile = path.resolve(__dirname, "../assets/local_dev_server.key");

  const serverConfigFile = path.join(workDir, "local_orchestrator.config.json");
  fs.writeFileSync(serverConfigFile, JSON.stringify(cfg));
  const loggingConfigFile = Config.App.get("imjs_test_imodel_bank_logging_config", "");
  const backendRegistryFile = path.resolve(__dirname, "../assets/local_orchestrator.backend.registry.json");

  const runOrchestratorJs = Config.App.get("imjs_test_imodel_bank_run_orchestrator");

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
      } catch (err) {
        if (err.errno === "ECONNREFUSED") {
          continue;
        } else {
          return Promise.reject(err);
        }
      }
      return Promise.resolve();
    } while (++attempt < maxConnectAttempts);
    return Promise.reject(new Error("ECONNREFUSED"));
  }

  async function pingServerOnce(url: string, pauseMillis: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        https.get(url + "/sv1.1/Plugins", (response: http.IncomingMessage) => {
          if (response.statusCode !== 200) {
            reject(new Error("Unexpected response. Not an iModelBank or iModelManager server? statusCode=" + response.statusCode));
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
      return Promise.reject(err);
    }

    return Promise.resolve();
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

  const orchestratorUrl = `${cfg.baseUrl}:${cfg.port}`;
  const bankClient = new IModelBankClient(orchestratorUrl, new UrlFileHandler());
  const contextMgr = new IModelBankFileSystemContextClient(orchestratorUrl);

  const cloudEnv = {
    isIModelHub: false,
    authorization: new IModelBankDummyAuthorizationClient(),
    contextMgr,
    shutdown: doShutdown,
    startup: doStartup,
  };

  return [cloudEnv, bankClient];
}
