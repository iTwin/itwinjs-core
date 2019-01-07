/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "../Token";
import { UserInfo } from "../UserInfo";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelAuthorizationClient } from "../IModelCloudEnvironment";

/** Implements the user permission abstraction by creating a dummy AccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this dummy token.
 */
export class IModelBankDummyAuthorizationClient implements IModelAuthorizationClient {
  public async authorizeUser(_actx: ActivityLoggingContext, userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken> {
    if (!userInfo)
      userInfo = { id: "", email: { id: userCredentials.email }, profile: { name: "", firstName: "", lastName: "" } };
    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userInfo };
    return Promise.resolve(AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper))!);
  }
}
