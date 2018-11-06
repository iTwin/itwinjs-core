/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ImsActiveSecureTokenClient } from "../ImsClients";
import { AuthorizationToken, AccessToken } from "../Token";
import { HubIModel, IModelQuery } from "../imodelhub";
import { IModelHubClient, IModelClient } from "..";
import { ConnectClient, Project } from "../ConnectClients";
import { expect } from "chai";
import * as fs from "fs";

import { Logger, LogLevel, ActivityLoggingContext, GuidString, Guid } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { loggingCategoryFullUrl } from "../Request";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

const actx = new ActivityLoggingContext(Guid.createValue());

const logFileStream = fs.createWriteStream("./lib/test/iModelClientsTests.log", { flags: "a" });

// The Request URLs are captured separate. The log file is used by the Hub URL whitelist validation.
export const urllogPath = "./lib/test/requesturls.log";
const urlLogFileStream = fs.createWriteStream(urllogPath, { flags: "a" });

function logFunction(logLevel: string, category: string, message: string) {
  if (category === loggingCategoryFullUrl)
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
const loggingConfigFile: string | undefined = process.env.imjs_test_logging_config;
if (!!loggingConfigFile) {
  // tslint:disable-next-line:no-var-requires
  Logger.configureLevels(require(loggingConfigFile));
}

// log all request URLs as this will be the input to the Hub URL whitelist test
Logger.setLevel(loggingCategoryFullUrl, LogLevel.Trace);

/** Credentials for test users */
export interface UserCredentials {
  email: string;
  password: string;
}

function isOfflineSet(): boolean {
  const index = process.argv.indexOf("--offline");
  return process.argv[index + 1] === "mock";
}

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of project used by most tests */
  public static readonly projectName: string = "iModelJsTest";
  public static readonly enableMocks: boolean = isOfflineSet();

  /** Login the specified user and return the AuthorizationToken */
  public static async login(user: UserCredentials = TestUsers.regular): Promise<AuthorizationToken> {
    if (Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== 0)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Dev requires that SSL certificate checks be bypassed

    const authToken: AuthorizationToken | undefined = await (new ImsActiveSecureTokenClient()).getToken(actx, user.email, user.password);
    expect(authToken);

    return authToken;
  }

  public static async queryProject(accessToken: AccessToken, projectName: string): Promise<Project> {
    const connectClient = new ConnectClient();

    const project: Project | undefined = await connectClient.getProject(actx, accessToken, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    if (!project)
      throw new Error(`Project ${projectName} not found for user ${!accessToken.getUserInfo() ? "n/a" : accessToken.getUserInfo()!.email}.`);

    return project;
  }

  public static async queryIModel(accessToken: AccessToken, projectId: GuidString): Promise<HubIModel> {
    const imodelHubClient: IModelClient = new IModelHubClient();

    const iModels = await imodelHubClient.IModels().get(actx, accessToken, projectId, new IModelQuery().primary());
    if (iModels.length === 0)
      throw new Error(`Primary iModel ${projectId} not found for project ${projectId} for user ${!accessToken.getUserInfo() ? "n/a" : accessToken.getUserInfo()!.email}.`);

    return iModels[0];
  }
}

/** Test users with various permissions */
export class TestUsers {
  /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
  public static get regular(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_regular_user_name"),
      password: Config.App.getString("imjs_test_regular_user_password"),
    };
  }

  /** User with typical permissions of the project administrator - Co-Admin: Yes, Connect-Services-Admin: No */
  public static get manager(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_manager_user_name"),
      password: Config.App.getString("imjs_test_manager_user_password"),
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: No, Connect-Services-Admin: Yes */
  public static get super(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_super_user_name"),
      password: Config.App.getString("imjs_test_super_user_password"),
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: Yes, Connect-Services-Admin: Yes */
  public static get superManager(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_super_manager_user_name"),
      password: Config.App.getString("imjs_test_super_manager_user_password"),
    };
  }
  /** Just another user */
  public static get user1(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_user1_user_name"),
      password: Config.App.getString("imjs_test_user1_user_password"),
    };
  }
  /** Just another user */
  public static get user3(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_user3_user_name"),
      password: Config.App.getString("imjs_test_user3_user_password"),
    };
  }
  public static get serviceAccount1(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_serviceAccount1_user_name"),
      password: Config.App.getString("imjs_test_serviceAccount1_user_password"),
    };
  }

}
