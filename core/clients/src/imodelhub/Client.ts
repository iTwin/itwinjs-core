/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelClient } from "../IModelClient";
import { FileHandler } from "../imodeljs-clients";
import { AccessToken, AuthorizationToken } from "../Token";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";

/**
 * Class that allows access to different iModelHub class handlers. Handlers should be accessed through an instance of this class, rather than constructed directly.
 * @beta
 */
export class IModelHubClient extends IModelClient {
  /**
   * Create an instance of IModelHubClient.
   * @param fileHandler File handler to handle file upload/download and file system operations.
   * @param iModelBaseHandler WSG Client for iModel Hub operations.
   */
  public constructor(fileHandler?: FileHandler, iModelBaseHandler: IModelBaseHandler = new IModelBaseHandler()) {
    super(iModelBaseHandler, fileHandler);
  }

  /**
   * Get the (delegation) access token to access the service
   * @param requestContext The client request context
   * @param authorizationToken Authorization token.
   * @returns Resolves to the (delegation) access token.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if authorizationToken is undefined.
   * @throws [[ResponseError]] if request to delegation service failed.
   * @throws Error if failed to parse response.
   * @internal
   */
  public async getAccessToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken): Promise<AccessToken> {
    ArgumentCheck.defined("authorizationToken", authorizationToken);
    return this._handler.getAccessToken(requestContext, authorizationToken);
  }
}
