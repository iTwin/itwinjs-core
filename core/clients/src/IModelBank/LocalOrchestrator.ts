/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import { IModelAccessContextProps, NamedIModelAccessContextProps } from "./IModelBankAccessContext";
import { DeploymentEnv } from "../Client";
import { IModelBankClient } from "./IModelBankClient";
import { FileHandler } from "../FileHandler";
import { IModelClient } from "../IModelClient";
import { ActivityLoggingContext, EnvMacroSubst, assert } from "@bentley/bentleyjs-core";
import { UrlFileHandler } from "../UrlFileHandler";
import { IModelOrchestrationClient } from "../IModelCloudEnvironment";
import { IModelBankFileSystemProject } from "./IModelBankFileSystemProject";

/** The format of a config file that imodel-bank's runWebServer program will read
 * in order to get the information needed to set up and run an iModelBank server.
 */
export interface IModelBankServerConfig {
  /** The protocol and hostname of the server. E.g., "https://localhost".
   * baseUrl will be used to form the upload and download URLs returned by the server to the client for
   * briefcase, seedfile, and changeset upload/download.
   */
  baseUrl: string;
  /** The port where the server should listen */
  port: number;
  /** The path to the .key file to be used by https. Path may be relative to the server config file.  */
  keyFile: string;
  /** The path to the .crt file to be used by https. Path may be relative to the server config file. */
  certFile: string;
  /** Access control URL - a server that performs the permissions check */
  accessControlUrl: string | undefined;
  /** admin user name - for ULAS */
  adminConnectUserName: string;
  /** admin user's password - for ULAS */
  adminConnectUserPassword: string;
}

// A running instance of iModelBank
class RunningBank {
  public client: IModelBankClient;
  public iModelId: string;
  public url: string;
  public proc: child_process.ChildProcess;

  constructor(iModelId: string, url: string, env: DeploymentEnv, handler: FileHandler | undefined) {
    this.iModelId = iModelId;
    this.client = new IModelBankClient(url, env, handler);
    this.url = url;
  }

  public static fromJson(obj: IModelAccessContextProps, handler: FileHandler): RunningBank | undefined {
    const props = obj.imodeljsCoreClientsIModelBankAccessContext;
    return new RunningBank(props.iModelId, props.url, props.env, handler);
  }
}

// Runs iModelBank server programs on this machine, one per iModel
export class IModelBankLocalOrchestrator implements IModelOrchestrationClient {
  public nextPort: number;
  public runningBanks: Map<string, RunningBank>;
  public serverConfig: IModelBankServerConfig;
  public serverLoggingConfigFile: string | undefined;
  public proj: IModelBankFileSystemProject;

  constructor(serverConfig: IModelBankServerConfig, serverLoggingConfigFile: string | undefined, proj: IModelBankFileSystemProject) {
    this.serverConfig = serverConfig;
    this.serverLoggingConfigFile = serverLoggingConfigFile;
    this.proj = proj;
    this.proj.onDeleteIModel.addListener((iModelId: string) => {
      const running: RunningBank | undefined = this.runningBanks.get(iModelId);
      if (running !== undefined) {
        this.killIModelBank(running);
        this.runningBanks.delete(iModelId);
      }
    });
    this.proj.onTerminate.addListener(() => {
      for (const running of this.runningBanks.values())
        this.killIModelBank(running);
    });
    this.nextPort = this.serverConfig.port;
    this.runningBanks = new Map<string, RunningBank>();
  }

  /** Make sure a bank server is running for the specified iModel */
  private queryContextPropsFor(iModelId: string): NamedIModelAccessContextProps {
    for (const context of this.proj.group.iModelBankProjectAccessContextGroup.contexts) {
      if (context.imodeljsCoreClientsIModelBankAccessContext.iModelId === iModelId) {
        return context;
      }
    }
    throw new Error(`iModel ${iModelId} not registered in this project.`);
  }

  public getClientForIModel(_actx: ActivityLoggingContext, _projectId: string | undefined, iModelId: string): Promise<IModelClient> {
    const running = this.runningBanks.get(iModelId);
    if (running !== undefined)
      return Promise.resolve(running.client);

    const props: NamedIModelAccessContextProps = this.queryContextPropsFor(iModelId);

    // Assign a port to this bank
    const port = this.nextPort++;
    props.imodeljsCoreClientsIModelBankAccessContext.url = `${this.serverConfig.baseUrl}:${port}`;

    // Prepare a client for this bank, pointing to the assigned url
    const bankToRun = RunningBank.fromJson(props, new UrlFileHandler())!;

    //  Run the bank
    const imodelDir = this.proj.fsAdmin.getIModelDir(this.proj.group.iModelBankProjectAccessContextGroup.name, iModelId);
    assert(fs.existsSync(imodelDir));

    const thisBankServerConfig: IModelBankServerConfig = Object.assign({}, this.serverConfig);
    thisBankServerConfig.port = port;
    EnvMacroSubst.replaceInProperties(thisBankServerConfig, true, undefined);   // replace ${IMODELJS_CLIENTS_TEST_IMODEL_BANK}

    const thisBankServerConfigFile = path.join(imodelDir, "server.config.json");
    fs.writeFileSync(thisBankServerConfigFile, JSON.stringify(thisBankServerConfig));

    const thisBankLoggingConfigFile = this.serverLoggingConfigFile || path.join(imodelDir, "logging.config.json");
    if (!fs.existsSync(thisBankLoggingConfigFile)) {
      fs.writeFileSync(thisBankLoggingConfigFile, "{}");
    }

    const runWebServerJs = path.join(process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK!, "lib", "runWebServer.js");

    const verboseArg = process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK_VERBOSE ?
      `--verbose=${process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK_VERBOSE}` : "";

    const cmdargs = [
      runWebServerJs,
      verboseArg,
      (imodelDir),
      (thisBankServerConfigFile),
      (thisBankLoggingConfigFile),
    ];

    bankToRun.proc = child_process.spawn("node", cmdargs, { stdio: "inherit" });

    this.runningBanks.set(iModelId, bankToRun);

    bankToRun.proc.on("exit", () => {
      this.runningBanks.delete(iModelId);
    });

    bankToRun.proc.on("error", (err: Error) => {
      this.runningBanks.delete(iModelId);
      throw err;
    });

    return Promise.resolve(bankToRun.client);
  }

  private killIModelBank(running: RunningBank): void {
    console.log(`killing ${running.url} - ${running.iModelId}`);
    running.proc.kill();
  }
}
