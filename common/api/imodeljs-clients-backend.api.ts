// @public
class AzureFileHandler implements FileHandler {
  constructor(threshold?: number);
  // (undocumented)
  agent: https.Agent;
  basename(filePath: string): string;
  downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
  exists(filePath: string): boolean;
  getFileSize(filePath: string): number;
  isDirectory(filePath: string): boolean;
  join(...paths: string[]): string;
  uploadFile(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, uploadFromPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
}

// @public
class IOSAzureFileHandler implements FileHandler {
  constructor();
  // (undocumented)
  agent: any;
  basename(filePath: string): string;
  downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, downloadToPathname: string): Promise<void>;
  exists(filePath: string): boolean;
  getFileSize(filePath: string): number;
  isDirectory(filePath: string): boolean;
  join(...paths: string[]): string;
  uploadFile(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, uploadFromPathname: string): Promise<void>;
}

// @public
class OidcAgentClient extends OidcBackendClient {
  constructor(agentConfiguration: OidcAgentClientConfiguration);
  getToken(requestContext: ClientRequestContext): Promise<AccessToken>;
  refreshToken(requestContext: ClientRequestContext, jwt: AccessToken): Promise<AccessToken>;
}

// @public
class OidcBackendClient extends OidcClient {
  constructor(configuration: OidcBackendClientConfiguration);
  // (undocumented)
  protected _configuration: OidcBackendClientConfiguration;
  // WARNING: The type "TokenSet" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected createToken(tokenSet: TokenSet, userInfo?: UserInfo): AccessToken;
  // WARNING: The type "Issuer" needs to be exported by the package (e.g. added to index.ts)
  discoverEndpoints(requestContext: ClientRequestContext): Promise<Issuer>;
  // WARNING: The type "OpenIdClient" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected getClient(requestContext: ClientRequestContext): Promise<OpenIdClient>;
  // (undocumented)
  static parseUserInfo(jwt: string): UserInfo | undefined;
}

// @public
interface OidcBackendClientConfiguration {
  clientId: string;
  clientSecret: string;
  scope: string;
}

// @public
class OidcDelegationClient extends OidcBackendClient {
  constructor(configuration: OidcDelegationClientConfiguration);
  getJwtFromJwt(requestContext: ClientRequestContext, accessToken: AccessToken): Promise<AccessToken>;
  getJwtFromSaml(requestContext: ClientRequestContext, accessToken: AccessToken): Promise<AccessToken>;
  getSamlFromJwt(requestContext: ClientRequestContext, jwt: AccessToken): Promise<AccessToken>;
}

// @public (undocumented)
class OidcDeviceClient extends OidcClient, implements IOidcFrontendClient {
  constructor(clientConfiguration: OidcFrontendClientConfiguration);
  dispose(): void;
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
  readonly hasExpired: boolean;
  readonly hasSignedIn: boolean;
  initialize(requestContext: ClientRequestContext): Promise<void>;
  readonly isAuthorized: boolean;
  readonly onUserStateChanged: BeEvent<(token: AccessToken | undefined, message: string) => void>;
  signIn(requestContext: ClientRequestContext): Promise<AccessToken>;
  signOut(requestContext: ClientRequestContext): Promise<void>;
}

// @public
class RequestHost {
  static initialize(): Promise<void>;
}

// @public
class UrlFileHandler implements FileHandler {
  constructor();
  // (undocumented)
  agent: https.Agent;
  basename(filePath: string): string;
  // (undocumented)
  downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
  exists(filePath: string): boolean;
  getFileSize(filePath: string): number;
  isDirectory(filePath: string): boolean;
  join(...paths: string[]): string;
  // (undocumented)
  uploadFile(_requestContext: AuthorizedClientRequestContext, uploadUrlString: string, uploadFromPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
}

// WARNING: Unsupported export: OidcDelegationClientConfiguration
// WARNING: Unsupported export: OidcAgentClientConfiguration
// (No @packagedocumentation comment for this package)
