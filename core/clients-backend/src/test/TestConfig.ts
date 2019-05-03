/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { Logger, LogLevel, GuidString, ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import {
  ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AuthorizationToken, AccessToken, HubIModel,
  IModelHubClient, IModelClient, ConnectClient, Project, Config, IModelQuery, AuthorizedClientRequestContext,
  ImsUserCredentials, ClientsLoggerCategory,
} from "@bentley/imodeljs-clients";
import { TestUsers } from "./TestUsers";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

const logFilePath = path.join(__dirname, "./iModelClientsTests.log");
const logFileStream = fs.createWriteStream(logFilePath, { flags: "a" });
console.log("Log File created at: " + logFilePath);

// The Request URLs are captured separate. The log file is used by the Hub URL whitelist validation.
export const urlLogPath = path.join(__dirname, "./requesturls.log");
const urlLogFileStream = fs.createWriteStream(urlLogPath, { flags: "a" });
console.log("URL Log file created at: " + urlLogPath);

function logFunction(logLevel: string, category: string, message: string) {
  if (category === ClientsLoggerCategory.Request)
    urlLogFileStream.write(message + "\n");
  else
    logFileStream.write(logLevel + "|" + category + "|" + message + "\n");
}

// Initialize logger to file
Logger.initialize(
  (category: string, message: string): void => { logFunction("Error", category, message); },
  (category: string, message: string): void => { logFunction("Warning", category, message); },
  (category: string, message: string): void => { logFunction("Info", category, message); },
  (category: string, message: string): void => { logFunction("Trace", category, message); });

// Note: Turn this off unless really necessary - it causes Error messages on the
// console with the existing suite of tests, and this is quite misleading,
// especially when diagnosing CI job failures.
const loggingConfigFile: string = Config.App.get("imjs_test_logging_config", "");
if (!!loggingConfigFile) {
  // tslint:disable-next-line:no-var-requires
  Logger.configureLevels(require(loggingConfigFile));
}

// log all request URLs as this will be the input to the Hub URL whitelist test
Logger.setLevel(ClientsLoggerCategory.Request, LogLevel.Trace);

function isOfflineSet(): boolean {
  const index = process.argv.indexOf("--offline");
  return process.argv[index + 1] === "mock";
}

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of project used by most tests */
  public static readonly projectName: string = Config.App.get("imjs_test_project_name", "iModelJsTest");
  public static readonly enableMocks: boolean = isOfflineSet();
  public static readonly enableIModelBank: boolean = Config.App.has("imjs_test_imodel_bank_run_orchestrator");

  /** Login the specified user and return the AuthorizationToken */
  public static async login(user: ImsUserCredentials = TestUsers.regular): Promise<AuthorizationToken> {
    if (Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== 0)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Dev requires that SSL certificate checks be bypassed
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(new ClientRequestContext(), user);
    expect(authToken);
    return authToken;
  }

  /** Login the specified user and return the AccessToken */
  public static async getAccessToken(user: ImsUserCredentials = TestUsers.regular): Promise<AccessToken> {
    const authToken: AuthorizationToken = await TestConfig.login(user);
    const accessToken: AccessToken = await (new ImsDelegationSecureTokenClient()).getToken(new ClientRequestContext(), authToken);
    expect(accessToken);
    return accessToken;
  }

  /** Query for the specified project */
  public static async queryProjectId(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<string> {
    const connectClient = new ConnectClient();
    const project: Project | undefined = await connectClient.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    if (!project || !project.wsgId) {
      const userInfo = requestContext.accessToken.getUserInfo();
      throw new Error(`Project ${projectName} not found for user ${!userInfo ? "n/a" : userInfo.email}.`);
    }
    return project.wsgId;
  }

  /** Query for the specified iModel */
  public static async queryIModelId(requestContext: AuthorizedClientRequestContext, iModelName: string, projectId: GuidString): Promise<string> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModel: HubIModel = (await imodelHubClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName)))[0];
    if (!iModel || !iModel.wsgId || iModel.name !== iModelName) {
      const userInfo = requestContext.accessToken.getUserInfo();
      throw new Error(`iModel ${iModelName} not found for project ${projectId} for user ${!userInfo ? "n/a" : userInfo.email}.`);
    }

    return iModel.wsgId;
  }
}
