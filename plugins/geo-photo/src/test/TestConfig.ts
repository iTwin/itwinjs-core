/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { GuidString, ClientRequestContext } from "@bentley/bentleyjs-core";
import {
  ImsActiveSecureTokenClient, ImsUserCredentials, AuthorizationToken, HubIModel,
  IModelHubClient, IModelClient, ConnectClient, Project, Config,
  AuthorizedClientRequestContext,
} from "@bentley/imodeljs-clients";

/**
 * Basic configuration used by all tests
 */
export class TestConfig {
  /** Login the specified user and return the AuthorizationToken */
  public static async login(user: ImsUserCredentials = TestUsers.regular): Promise<AuthorizationToken> {
    if (Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== 0)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Dev requires that SSL certificate checks be bypassed

    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(new ClientRequestContext(), user);
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
  public static get serviceAccount1(): ImsUserCredentials {
    return {
      email: Config.App.getString("imjs_test_serviceAccount1_user_name"),
      password: Config.App.getString("imjs_test_serviceAccount1_user_password"),
    };
  }

}
