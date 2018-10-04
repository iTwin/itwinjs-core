/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as path from "path";
import * as child_process from "child_process";
import { IModelBankDummyAuthorizationClient } from "../../IModelBank/IModelBankDummyAuthorizationClient";
import { TestIModelHubCloudEnv } from "./IModelHubCloudEnv";
import { IModelClient } from "../../IModelClient";
import { UrlFileHandler } from "../../UrlFileHandler";
import { IModelBankClient } from "../../IModelBank";
import { workDir } from "./TestUtils";
import { IModelBankFileSystemContextClient } from "../../IModelBank/IModelBankFileSystemContextClient";

export function getIModelBankCloudEnv(): [TestIModelHubCloudEnv, IModelClient] {

  const bankFsRoot = path.join(workDir, "bankfs");

  if (fs.existsSync(bankFsRoot))
    fsextra.removeSync(bankFsRoot);
  fsextra.mkdirpSync(bankFsRoot);

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

  // TODO this should be of type OrchestratorConfig, imported from imodel-bank
  const cfg = require(path.resolve(__dirname, "../assets/LocalOrchestrator.config.json"));
  cfg.baseUrl = "https://localhost";
  cfg.port = 4000;
  cfg.firstBankPort = cfg.port + 1;
  cfg.firstContextPort = cfg.port + 20;
  cfg.firstBackendPort = 0;
  cfg.bankfsRoot = bankFsRoot;

  const serverConfigFile = path.join(workDir, "LocalOrchestrator.config.json");
  fs.writeFileSync(serverConfigFile, JSON.stringify(cfg));
  const loggingConfigFile = path.resolve(__dirname, "../assets/LocalOrchestrator.logging.config.json");
  const backendRegistryFile = path.resolve(__dirname, "../assets/backend.registry.json");

  const runOrchestratorJs = path.join(process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK!, "lib", "HubApi", "LocalOrchestrator", "server.js");

  const cmdargs = [
    runOrchestratorJs,
    serverConfigFile,
    loggingConfigFile,
    backendRegistryFile,
  ];

  // const proc =
  child_process.spawn("node", cmdargs, { stdio: "inherit" });

  const orchestratorUrl = `${cfg.baseUrl}:${cfg.port}`;
  const bankClient = new IModelBankClient(orchestratorUrl, new UrlFileHandler());
  const contextMgr = new IModelBankFileSystemContextClient(orchestratorUrl);

  const cloudEnv = {
    isIModelHub: false,
    authorization: new IModelBankDummyAuthorizationClient(),
    contextMgr,
  };

  return [cloudEnv, bankClient];
}
