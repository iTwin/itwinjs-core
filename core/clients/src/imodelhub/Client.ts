/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DeploymentEnv } from "../Client";
import { AccessToken, AuthorizationToken } from "../Token";
import { IModelClient } from "../IModelClient";
import { FileHandler } from "../";
import { IModelBaseHandler } from "./BaseHandler";

/** Class that allows access to different iModel Hub class handlers.
 * Handlers should be accessed through an instance of this class, rather than constructed directly.
 */
export class IModelHubClient extends IModelClient {
  /**
   * Creates an instance of IModelHubClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv = "PROD", fileHandler?: FileHandler) {
    super(new IModelBaseHandler(deploymentEnv), deploymentEnv, fileHandler);
  }

  /**
   * Gets the (delegation) access token to access the service
   * @param authorizationToken Authorization token.
   * @returns Resolves to the (delegation) access token.
   */
  public async getAccessToken(authorizationToken: AuthorizationToken): Promise<AccessToken> {
    return this._handler.getAccessToken(authorizationToken);
  }
}
