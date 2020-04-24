/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, BeEvent } from "@bentley/bentleyjs-core";
import { ContextManagerClient, IModelCloudEnvironment } from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext, UserInfo } from "@bentley/itwin-client";
import { TestUtility } from "@bentley/oidc-signin-tool";
import { getImodelHubClient } from "./TestUtils";
import { ContextRegistryClient, Project, Asset } from "@bentley/context-registry-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/iTwin project */
class TestContextManagerClient implements ContextManagerClient {
  public async queryProjectByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Project> {
    const client = new ContextRegistryClient();
    return client.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }

  public async queryAssetByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<Asset> {
    const client = new ContextRegistryClient();
    return client.getAsset(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${name}'`,
    });
  }
}

class TestIModelHubUserMgr implements FrontendAuthorizationClient {
  private _token: AccessToken | undefined;

  public constructor(_userInfo: UserInfo | undefined, private _userCredentials: any) {
  }

  public async signIn(_requestContext: ClientRequestContext): Promise<void> {
    _requestContext.enter();
    this._token = await TestUtility.getAccessToken(this._userCredentials);
    return Promise.resolve();
  }

  public async signOut(_requestContext: ClientRequestContext): Promise<void> {
    _requestContext.enter();
    this._token = undefined;
    this.onUserStateChanged.raiseEvent(this._token);
    return Promise.resolve();
  }

  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();
  public get isAuthorized(): boolean {
    return !!this._token;
  }
  public get hasExpired(): boolean {
    return !this._token;
  }
  public get hasSignedIn(): boolean {
    return !!this._token;
  }

  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (!this._token) {
      return Promise.reject("User is not signed in.");
    }
    return Promise.resolve(this._token);
  }
}

export class TestIModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly contextMgr = new TestContextManagerClient();
  public readonly imodelClient = getImodelHubClient();
  public async startup(): Promise<void> { return Promise.resolve(); }
  public async shutdown(): Promise<number> { return Promise.resolve(0); }

  public getAuthorizationClient(userInfo: UserInfo | undefined, userCredentials: any) {
    return new TestIModelHubUserMgr(userInfo, userCredentials);
  }
}
