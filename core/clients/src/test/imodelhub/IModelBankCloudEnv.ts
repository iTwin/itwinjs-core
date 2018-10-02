/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as path from "path";
import * as child_process from "child_process";
import { IModelBankDummyAuthorizationClient } from "../../IModelBank/IModelBankDummyAuthorizationClient";
import { IModelHubError } from "../../imodelhub";
import { TestIModelHubCloudEnv } from "./IModelHubCloudEnv";
import { IModelClient } from "../../IModelClient";
import { ContextManagerClient } from "../../IModelCloudEnvironment";
import { ActivityLoggingContext, IModelHubStatus, Guid, assert } from "@bentley/bentleyjs-core";
import { AccessToken } from "../../Token";
import { Project } from "../../ConnectClients";
import { UrlFileHandler } from "../../UrlFileHandler";
import { IModelBankClient } from "../../IModelBank";
import { TestConfig } from "../TestConfig";
import { workDir } from "./TestUtils";

class IModelBankFileSystemContextClient implements ContextManagerClient {
  constructor(public bankFsRoot: string) {
  }

  private findContextByName(name: string) {     // *** TODO: Remove this when we can import IModelBankFileSystemAdmin from imodel-bank
    for (const contextId of fs.readdirSync(this.bankFsRoot)) {
      try {
        const contextProps = require(path.join(this.bankFsRoot, contextId, "imodelContext.json"));
        if (contextProps.name === name)
          return contextProps;
      } catch (_err) {
      }
    }
  }

  public async queryContextByName(_alctx: ActivityLoggingContext, _accessToken: AccessToken, name: string): Promise<Project> {
    const props = this.findContextByName(name);
    if (props === undefined)
      return Promise.reject(new IModelHubError(IModelHubStatus.FileNotFound)); // TODO: What error to return?
    const project = new Project();
    project.wsgId = project.ecId = props.id;
    project.name = props.name;
    return Promise.resolve(project);
  }

  public createContextByName(name: string) {  // *** TODO: Remove this when we can import IModelBankFileSystemAdmin from imodel-bank
    const newContextId = Guid.createValue();
    const newContextDir = path.join(this.bankFsRoot, newContextId);
    fsextra.mkdirpSync(newContextDir);

    const contextProps: /*IModelFileSystemContextProps*/any = {
      name,
      id: newContextId,
      description: "",
    };
    fs.writeFileSync(path.join(this.bankFsRoot, contextProps.id, "imodelContext.json"), JSON.stringify(contextProps));

    assert(this.findContextByName(name) !== undefined);
  }

  public recreateBankFs() {
    if (fs.existsSync(this.bankFsRoot))
      fsextra.removeSync(this.bankFsRoot);
    fsextra.mkdirpSync(this.bankFsRoot);
  }
}

export function getIModelBankCloudEnv(): [TestIModelHubCloudEnv, IModelClient] {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

  const contextMgr = new IModelBankFileSystemContextClient(path.join(workDir, "bankfs"));

  contextMgr.recreateBankFs();
  contextMgr.createContextByName(TestConfig.projectName);

  // TODO this should be of type OrchestratorConfig, imported from imodel-bank
  const cfg = require(path.resolve(__dirname, "../assets/LocalOrchestrator.config.json"));
  cfg.baseUrl = "https://localhost";
  cfg.port = 4000;
  cfg.firstBankPort = cfg.port + 1;
  cfg.firstContextPort = cfg.port + 20;
  cfg.firstBackendPort = 0;
  cfg.bankfsRoot = contextMgr.bankFsRoot;

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

  // proc.stderr.setEncoding("utf8");
  // proc.stderr.on("data", (data: string) => {
  //   console.error(`LocalOrchestrator: ${data}`);
  // });
  // proc.stdout.setEncoding("utf8");
  // proc.stdout.on("data", (data: string) => {
  //   console.log(`LocalOrchestrator: ${data}`);
  // });
  // proc.on("exit", () => {
  //   console.log(`LocalOrchestrator exited`);
  // });

  // proc.on("error", (err: Error) => {
  //   console.log(`LocalOrchestrator error: ${err.stack}`);
  // });

  // proc.on("uncaughtException", (err: Error) => {
  //   console.log(`LocalOrchestrator uncaughtException: ${err.stack}`);
  // });

  const cloudEnv = {
    isIModelHub: false,
    authorization: new IModelBankDummyAuthorizationClient(),
    contextMgr,
  };

  const bankClient = new IModelBankClient(`${cfg.baseUrl}:${cfg.port}`, TestConfig.deploymentEnv, new UrlFileHandler());

  return [cloudEnv, bankClient];
}
