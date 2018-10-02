/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken } from "../Token";
import { UserProfile } from "../UserProfile";
import { DeploymentEnv } from "../Client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelAuthorizationClient } from "../IModelCloudEnvironment";

/** Implements the user permission abstraction by creating a dummy AccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this dummy token.
 */
export class IModelBankDummyAuthorizationClient implements IModelAuthorizationClient {
  public authorizeUser(_actx: ActivityLoggingContext, userProfile: UserProfile | undefined, userCredentials: any, _env: DeploymentEnv): Promise<AccessToken> {
    if (!userProfile)
      userProfile = { email: userCredentials.email, userId: "", firstName: "", lastName: "", organization: "", ultimateSite: "", organizationId: "", usageCountryIso: "" };
    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userProfile };
    return Promise.resolve(AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper))!);
  }
}
