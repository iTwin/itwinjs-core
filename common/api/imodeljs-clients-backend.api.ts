// @public
class AzureFileHandler implements FileHandler {
  constructor(threshold?: number);
  // (undocumented)
  agent: https.Agent;
  basename(filePath: string): string;
  downloadFile(alctx: ActivityLoggingContext, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
  exists(filePath: string): boolean;
  getFileSize(filePath: string): number;
  isDirectory(filePath: string): boolean;
  join(...paths: string[]): string;
  uploadFile(alctx: ActivityLoggingContext, uploadUrlString: string, uploadFromPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
}

// @public
class IOSAzureFileHandler implements FileHandler {
  constructor();
  // (undocumented)
  agent: any;
  basename(filePath: string): string;
  downloadFile(alctx: ActivityLoggingContext, downloadUrl: string, downloadToPathname: string): Promise<void>;
  exists(filePath: string): boolean;
  getFileSize(filePath: string): number;
  isDirectory(filePath: string): boolean;
  join(...paths: string[]): string;
  uploadFile(alctx: ActivityLoggingContext, uploadUrlString: string, uploadFromPathname: string): Promise<void>;
}

// @public
class OidcAgentClient extends OidcBackendClient {
  constructor(agentConfiguration: OidcAgentClientConfiguration);
  getToken(actx: ActivityLoggingContext): Promise<AccessToken>;
  refreshToken(actx: ActivityLoggingContext, jwt: AccessToken): Promise<AccessToken>;
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
  discoverEndpoints(actx: ActivityLoggingContext): Promise<Issuer>;
  // WARNING: The type "OpenIdClient" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected getClient(actx: ActivityLoggingContext): Promise<OpenIdClient>;
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
  getJwtFromJwt(actx: ActivityLoggingContext, accessToken: AccessToken): Promise<AccessToken>;
  getJwtFromSaml(actx: ActivityLoggingContext, accessToken: AccessToken): Promise<AccessToken>;
  getSamlFromJwt(actx: ActivityLoggingContext, jwt: AccessToken): Promise<AccessToken>;
}

// @public (undocumented)
class OidcDeviceClient extends OidcClient, implements IOidcFrontendClient {
  constructor(clientConfiguration: OidcFrontendClientConfiguration);
  dispose(): void;
  getAccessToken(actx: ActivityLoggingContext): Promise<AccessToken | undefined>;
  // (undocumented)
  getIsSignedIn(): boolean;
  initialize(actx: ActivityLoggingContext): Promise<void>;
  readonly onUserStateChanged: BeEvent<(token: AccessToken | undefined) => void>;
  signIn(actx: ActivityLoggingContext): void;
  signOut(actx: ActivityLoggingContext): void;
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
  downloadFile(alctx: ActivityLoggingContext, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
  exists(filePath: string): boolean;
  getFileSize(filePath: string): number;
  isDirectory(filePath: string): boolean;
  join(...paths: string[]): string;
  // (undocumented)
  uploadFile(_alctx: ActivityLoggingContext, uploadUrlString: string, uploadFromPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
}

// WARNING: Unsupported export: OidcDelegationClientConfiguration
// WARNING: Unsupported export: OidcAgentClientConfiguration
// (No @packagedocumentation comment for this package)
