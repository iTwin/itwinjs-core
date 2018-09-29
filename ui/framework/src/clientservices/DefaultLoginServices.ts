/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ClientServices */

import { ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AuthorizationToken, AccessToken } from "@bentley/imodeljs-clients";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Logger, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core/";
import { IModelVersion } from "@bentley/imodeljs-common";
import { LoginServices } from "./LoginServices";

/**
 * Provides default [[LoginServices]] that are needed by the application framework. They are supplied as props.
 */
export class DefaultLoginServices implements LoginServices {
  /** The current open IModelConnection. Will be `undefined` until [[openIModel]] is called. */
  private readonly _authClient = new ImsActiveSecureTokenClient("QA");
  private readonly _accessClient = new ImsDelegationSecureTokenClient("QA");

  /** Logs in to IMS and returns an AccessToken. Called from the Login page */
  public async imsLogin(userName: string, password: string): Promise<AccessToken> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const authToken: AuthorizationToken = await this._authClient.getToken(alctx, userName, password);
    const accessToken: AccessToken = await this._accessClient.getToken(alctx, authToken);
    return accessToken;
  }

  /** Opens an IModelConnection to the iModel of the specified name. */
  public async openIModel(accessToken: AccessToken, projectId: string, iModelId: string): Promise<IModelConnection> {
    const iModel: IModelConnection = await IModelConnection.open(accessToken, projectId, iModelId, OpenMode.Readonly, IModelVersion.latest());
    Logger.logInfo("SampleFrontEnd", "Opened: " + iModel ? iModel!.name : "Failed");
    return iModel;
  }
}
