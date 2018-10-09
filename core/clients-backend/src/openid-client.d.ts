/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/// <reference types="node" />

declare module 'openid-client' {

  export interface TokenSet {
    access_token: string;
    claims: any;
    expires_at: number;
    expires_in: number;
    id_token: string;
    refresh_token: string;
    session_state: string;
    token_type: string;
  }

  export interface UserInfo {
    family_name: string;
    given_name: string;
    name: string;
    preferred_username: string;
    sub: string;

    email?: string;
    org?: string;
    org_name?: string;
    ultimate_site?: string;
    usage_country_iso?: string;
  }

  export interface ClientConfiguration {
    client_id: string;
    client_secret?: string;
  }

  export interface GrantParams {
    grant_type: string;
    scope: string;
    assertion?: string;
  }

  export class Client {
    constructor(metadata: ClientConfiguration, keystore?: any);

    authorizationUrl(params: any): string;

    authorizationPost(params: any): string;

    authorizationCallback(redirectUri: string, parameters: any, checks?: any): Promise<any>;

    refresh(refreshToken: string): Promise<TokenSet>;

    userinfo(accessToken: string, options?: any): Promise<UserInfo>;

    grant(params: GrantParams): Promise<TokenSet>;
  }

  export class Issuer {
    static discover(uri: string): Promise<Issuer>;
    readonly Client: new (metadata: any, keystore?: any) => Client;
    readonly token_endpoint: string;
    readonly authorization_endpoint: string;
    readonly introspection_endpoint: string;
    readonly userinfo_endpoint: string;
  }

  export class Strategy {
    constructor(settings: any, verify: (tokenSet: TokenSet, userInfo: UserInfo, done: any) => any);
    authenticate(req: any, options: any): void;
  }
}

