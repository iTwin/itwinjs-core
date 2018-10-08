/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { KnownRegions } from "../Client";
import { ImsActiveSecureTokenClient } from "../ImsClients";
import { AuthorizationToken, AccessToken } from "../Token";
import { Version, HubIModel, VersionQuery, IModelQuery } from "../imodelhub";
import { IModelHubClient, IModelClient } from "..";
import { ConnectClient, Project } from "../ConnectClients";
import { expect } from "chai";
import { loggingCategoryFullUrl } from "../Request";
import * as fs from "fs";

import { Logger, LogLevel, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
IModelJsConfig.init(true, Config.App);

export const whitelistPath = "./lib/test/assets/whitelist.txt";
export const logPath = "./lib/test/iModelClientsTests.log";

const fileStream = fs.createWriteStream(logPath, { flags: "a" });
const actx = new ActivityLoggingContext("");

// Initialize logger to file
Logger.initialize(
  (category: string, message: string): void => { fileStream.write("Error   |" + category + " | " + message + "\n"); },
  (category: string, message: string): void => { fileStream.write("Warning |" + category + " | " + message + "\n"); },
  (category: string, message: string): void => { fileStream.write("Info    |" + category + " | " + message + "\n"); },
  (category: string, message: string): void => { fileStream.write("Trace   |" + category + " | " + message + "\n"); });

// Log at minimum the full url category, so url validator test can execute
Logger.setLevel(loggingCategoryFullUrl, LogLevel.Trace);

// Note: Turn this off unless really necessary - it causes Error messages on the
// console with the existing suite of tests, and this is quite misleading,
// especially when diagnosing CI job failures.
const loggingConfigFile: string | undefined = process.env.imjs_test_logging_config;
if (!!loggingConfigFile) {
  // tslint:disable-next-line:no-var-requires
  Logger.configureLevels(require(loggingConfigFile));
}

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
 * Note: Setup test cases at both the DEV and QA environments, so that
 * the tests can be run at either place.
 * QA: https://qa-connect-webportal.bentley.com/
 * DEV: https://dev-webportal-eus.cloudapp.net/ and
 */
export class TestConfig {
  /** Name of project used by most tests */
  public static readonly projectName: string = "NodeJsTestProject";
  public static readonly enableMocks: boolean = isOfflineSet();

  public static get isDev() {
    return Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== Number(KnownRegions.DEV);
  }
  public static get isPerf() {
    return Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== Number(KnownRegions.PERF);
  }
  public static get isQA() {
    return Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== Number(KnownRegions.QA);
  }
  public static get isProd() {
    return Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== Number(KnownRegions.PROD);
  }
  /** Login the specified user and return the AuthorizationToken */
  public static async login(user: UserCredentials = TestUsers.regular): Promise<AuthorizationToken> {
    if (TestConfig.isDev || TestConfig.isPerf)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Dev requires that SSL certificate checks be bypassed

    const authToken: AuthorizationToken | undefined = await (new ImsActiveSecureTokenClient()).getToken(actx, user.email, user.password);
    expect(authToken);

    return authToken;
  }

  /** Query for the test file from connect/hub */
  public static async queryTestCase(accessToken: AccessToken, projectName: string, iModelName?: string, versionName?: string): Promise<{ project: Project, iModel?: HubIModel, version?: Version }> {
    const connectClient = new ConnectClient();
    const imodelHubClient: IModelClient = new IModelHubClient();

    const project: Project | undefined = await connectClient.getProject(actx, accessToken, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    expect(project);

    let iModel: HubIModel | undefined = undefined; // tslint:disable-line:no-unnecessary-initializer
    let version: Version | undefined = undefined; // tslint:disable-line:no-unnecessary-initializer
    if (iModelName) {
      const iModels = await imodelHubClient.IModels().get(actx, accessToken, project.wsgId, new IModelQuery().byName(iModelName));
      expect(iModels.length === 1);
      iModel = iModels[0];

      if (versionName) {
        version = (await imodelHubClient.Versions().get(actx, accessToken, iModel.id!, new VersionQuery().byName(versionName)))[0];
        expect(version);
      }
    }

    return { project, iModel, version };
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
