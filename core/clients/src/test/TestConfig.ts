/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ImsActiveSecureTokenClient, ImsUserCredentials } from "../ImsClients";
import { AuthorizationToken } from "../Token";
import { HubIModel } from "../imodelhub/iModels";
import { IModelHubClient, IModelClient } from "../imodeljs-clients";
import { ConnectClient, Project } from "../ConnectClients";
import { expect } from "chai";

import { Logger, GuidString, ClientRequestContext } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

// Note: Turn this off unless really necessary - it causes Error messages on the
// console with the existing suite of tests, and this is quite misleading,
// especially when diagnosing CI job failures.
const loggingConfigFile: string | undefined = process.env.imjs_test_logging_config;
if (!!loggingConfigFile) {
  // tslint:disable-next-line:no-var-requires
  Logger.configureLevels(require(loggingConfigFile));
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
  public static async login(user: ImsUserCredentials = TestUsers.regular): Promise<AuthorizationToken> {
    if (Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== 0)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Dev requires that SSL certificate checks be bypassed

    const authToken: AuthorizationToken | undefined =
      await (new ImsActiveSecureTokenClient()).getToken(new ClientRequestContext(), user);
    expect(authToken);

    return authToken;
  }

  public static async queryProject(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project> {
    const connectClient = new ConnectClient();
    const project: Project | undefined = await connectClient.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    if (!project || !project.wsgId)
      throw new Error(`Project ${projectName} not found for user.`);
    return project;
  }

  public static async queryIModel(requestContext: AuthorizedClientRequestContext, projectId: GuidString): Promise<HubIModel> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModel: HubIModel = await imodelHubClient.iModel.get(requestContext, projectId);
    if (!iModel || !iModel.wsgId)
      throw new Error(`Primary iModel not found for project ${projectId}`);
    return iModel;
  }
}

/** Test users with various permissions */
export class TestUsers {
  /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
  public static get regular(): ImsUserCredentials {
    return {
      email: Config.App.getString("imjs_test_regular_user_name"),
      password: Config.App.getString("imjs_test_regular_user_password"),
    };
  }

  /** User with typical permissions of the project administrator - Co-Admin: Yes, Connect-Services-Admin: No */
  public static get manager(): ImsUserCredentials {
    return {
      email: Config.App.getString("imjs_test_manager_user_name"),
      password: Config.App.getString("imjs_test_manager_user_password"),
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: No, Connect-Services-Admin: Yes */
  public static get super(): ImsUserCredentials {
    return {
      email: Config.App.getString("imjs_test_super_user_name"),
      password: Config.App.getString("imjs_test_super_user_password"),
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: Yes, Connect-Services-Admin: Yes */
  public static get superManager(): ImsUserCredentials {
    return {
      email: Config.App.getString("imjs_test_super_manager_user_name"),
      password: Config.App.getString("imjs_test_super_manager_user_password"),
    };
  }
  /** Just another user */
  public static get user1(): ImsUserCredentials {
    return {
      email: Config.App.getString("imjs_test_user1_user_name"),
      password: Config.App.getString("imjs_test_user1_user_password"),
    };
  }
  /** Just another user */
  public static get user3(): ImsUserCredentials {
    return {
      email: Config.App.getString("imjs_test_user3_user_name"),
      password: Config.App.getString("imjs_test_user3_user_password"),
    };
  }
  public static get serviceAccount1(): ImsUserCredentials {
    return {
      email: Config.App.getString("imjs_test_serviceAccount1_user_name"),
      password: Config.App.getString("imjs_test_serviceAccount1_user_password"),
    };
  }

}
