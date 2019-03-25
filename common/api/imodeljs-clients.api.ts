// @public
class AccessToken extends Token {
  // (undocumented)
  static foreignProjectAccessTokenJsonProperty: string;
  // (undocumented)
  static fromForeignProjectAccessTokenJson(foreignJsonStr: string): AccessToken | undefined;
  // (undocumented)
  static fromJson(jsonObj: any): AccessToken | undefined;
  static fromJsonWebTokenString(jwt: string, startsAt?: Date, expiresAt?: Date, userInfo?: UserInfo): AccessToken;
  // (undocumented)
  static fromSamlAssertion(samlAssertion: string): AccessToken;
  static fromSamlTokenString(accessTokenString: string, includesPrefix?: IncludePrefix): AccessToken;
  // (undocumented)
  static fromTokenString(tokenStr: string): AccessToken;
  readonly isJwt: boolean;
  // (undocumented)
  toTokenString(includePrefix?: IncludePrefix): string;
}

// @public
export function addSelectFileAccessKey(query: RequestQueryOptions): void;

// @public
class AggregateResponseError extends Error {
  errors: ResponseError[];
}

// @public
class AllCodesDeletedEvent extends BriefcaseEvent {
}

// @public
class AllLocksDeletedEvent extends BriefcaseEvent {
}

// @public (undocumented)
class ArgumentCheck {
  // (undocumented)
  static defined(argumentName: string, argument?: any): void;
  // (undocumented)
  static definedNumber(argumentName: string, argument?: number): void;
  // (undocumented)
  static nonEmptyArray(argumentName: string, argument?: any[]): void;
  // (undocumented)
  static valid(argumentName: string, argument?: any): void;
  static validBriefcaseId(argumentName: string, argument?: number): void;
  // (undocumented)
  static validChangeSetId(argumentName: string, argument?: string): void;
  // (undocumented)
  static validGuid(argumentName: string, argument?: string): void;
}

// @public
class AuthenticationError extends ResponseError {
}

// @public
class AuthorizationToken extends Token {
  // (undocumented)
  static clone(unTypedObj: any): AuthorizationToken;
  // (undocumented)
  static fromSamlAssertion(samlAssertion: string): AuthorizationToken;
  // (undocumented)
  toTokenString(includePrefix?: IncludePrefix): string;
}

// @public
class AuthorizedClientRequestContext extends ClientRequestContext {
  constructor(accessToken: AccessToken, activityId?: string, applicationId?: string, applicationVersion?: string, sessionId?: string);
  accessToken: AccessToken;
}

// @public
class Briefcase extends WsgInstance {
  // (undocumented)
  accessMode?: BriefcaseAccessMode;
  acquiredDate?: string;
  briefcaseId?: number;
  downloadUrl?: string;
  fileDescription?: string;
  fileId?: GuidString;
  fileName?: string;
  fileSize?: string;
  // (undocumented)
  iModelId?: GuidString;
  isReadOnly?: boolean;
  // (undocumented)
  lastAccessedAt?: Date;
  // (undocumented)
  localPathname?: string;
  mergedChangeSetId?: string;
  userId?: string;
}

// @public
enum BriefcaseAccessMode {
  // (undocumented)
  Exclusive = 1,
  // (undocumented)
  Shared = 0
}

// @public
class BriefcaseDeletedEvent extends BriefcaseEvent {
}

// @public
class BriefcaseEvent extends IModelHubEvent {
  briefcaseId?: number;
  fromJson(obj: any): void;
}

// @public
class BriefcaseHandler {
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler);
  create(requestContext: AuthorizedClientRequestContext, imodelId: GuidString): Promise<Briefcase>;
  delete(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, briefcaseId: number): Promise<void>;
  download(requestContext: AuthorizedClientRequestContext, briefcase: Briefcase, path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
  get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query?: BriefcaseQuery): Promise<Briefcase[]>;
}

// @public
class BriefcaseQuery extends Query {
  byId(id: number): this;
  getId(): number | undefined;
  selectDownloadUrl(): this;
}

// @public
class ChangeSet extends WsgInstance {
  briefcaseId?: number;
  changesType?: ChangesType;
  description?: string;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: string;
  id?: string;
  index?: string;
  isUploaded?: boolean;
  parentId?: string;
  pathname?: string;
  pushDate?: string;
  seedFileId?: GuidString;
  uploadUrl?: string;
  userCreated?: string;
}

// @public
class ChangeSetCreatedEvent extends IModelHubGlobalEvent {
  // (undocumented)
  briefcaseId?: number;
  // (undocumented)
  changeSetId?: string;
  // (undocumented)
  changeSetIndex?: string;
  fromJson(obj: any): void;
}

// @public
class ChangeSetHandler {
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler);
  create(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changeSet: ChangeSet, path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<ChangeSet>;
  download(requestContext: AuthorizedClientRequestContext, changeSets: ChangeSet[], path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
  get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query?: ChangeSetQuery): Promise<ChangeSet[]>;
}

// @public
class ChangeSetPostPushEvent extends BriefcaseEvent {
  changeSetId?: string;
  changeSetIndex?: string;
  fromJson(obj: any): void;
}

// @public
class ChangeSetPrePushEvent extends IModelHubEvent {
}

// @public
class ChangeSetQuery extends StringIdQuery {
  afterVersion(versionId: GuidString): this;
  betweenChangeSets(firstChangeSetId: string, secondChangeSetId?: string): this;
  betweenVersionAndChangeSet(versionId: GuidString, changeSetId: string): this;
  betweenVersions(sourceVersionId: GuidString, destinationVersionId: GuidString): this;
  bySeedFileId(seedFileId: GuidString): this;
  // (undocumented)
  protected checkValue(id: string): void;
  fromId(id: string): this;
  getVersionChangeSets(versionId: GuidString): this;
  latest(): this;
  selectDownloadUrl(): this;
}

// @public
enum ChangesType {
  Regular = 0,
  Schema = 1
}

// @public (undocumented)
interface ClassKeyMapInfo {
  classKeyPropertyName?: string;
  classPropertyName?: string;
  schemaPropertyName?: string;
}

// @public
class Client {
  protected constructor();
  // (undocumented)
  protected _url?: string;
  protected delete(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string): Promise<void>;
  getUrl(requestContext: ClientRequestContext): Promise<string>;
  protected abstract getUrlSearchKey(): string;
  protected setupOptionDefaults(options: RequestOptions): Promise<void>;
}

// @public
class CodeBase extends WsgInstance {
  briefcaseId?: number;
  codeScope?: string;
  codeSpecId?: Id64String;
  createdDate?: string;
  queryOnly?: boolean;
  state?: CodeState;
}

// @public
class CodeEvent extends BriefcaseEvent {
  codeScope?: string;
  codeSpecId?: Id64String;
  fromJson(obj: any): void;
  state?: CodeState;
  values?: string[];
}

// @public
class CodeHandler {
  constructor(handler: IModelBaseHandler);
  deleteAll(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, briefcaseId: number): Promise<void>;
  get(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, query?: CodeQuery): Promise<HubCode[]>;
  readonly sequences: CodeSequenceHandler;
  update(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, codes: HubCode[], updateOptions?: CodeUpdateOptions): Promise<HubCode[]>;
}

// @public
class CodeQuery extends Query {
  byBriefcaseId(briefcaseId: number): this;
  byCodes(codes: HubCode[]): this;
  byCodeScope(codeScope: string): this;
  byCodeSpecId(codeSpecId: Id64String): this;
  readonly isMultiCodeQuery: boolean;
  top(n: number): this;
  unavailableCodes(briefcaseId: number): this;
}

// @public
class CodeSequence extends WsgInstance {
  codeScope?: string;
  codeSpecId?: Id64String;
  incrementBy?: number;
  startIndex?: number;
  type?: CodeSequenceType;
  value?: string;
  valuePattern?: string;
}

// @public
class CodeSequenceHandler {
  constructor(handler: IModelBaseHandler);
  get(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, sequence: CodeSequence): Promise<string>;
}

// @public
enum CodeSequenceType {
  LargestUsed = 0,
  NextAvailable = 1
}

// @public
enum CodeState {
  Available = 0,
  Reserved = 1,
  Retired = 3,
  Used = 2
}

// @public
interface CodeUpdateOptions {
  codesPerRequest?: number;
  continueOnConflict?: boolean;
  deniedCodes?: boolean;
  unlimitedReporting?: boolean;
}

// @public
class Config {
  static readonly App: Config;
  // WARNING: The type "ValueType" needs to be exported by the package (e.g. added to index.ts)
  get(varName: string, defaultVal?: ValueType): any;
  getBoolean(name: string, defaultVal?: boolean): boolean;
  getContainer(): any;
  getNumber(name: string, defaultVal?: number): number;
  getString(name: string, defaultVal?: string): string;
  getVars(): string[];
  has(varName: string): boolean;
  merge(source: any): void;
  remove(varName: string): void;
  // WARNING: The type "ValueType" needs to be exported by the package (e.g. added to index.ts)
  set(varName: string, value: ValueType): void;
}

// @public
class ConflictingCodesError extends IModelHubError {
  addCodes(error: IModelHubError): void;
  conflictingCodes?: HubCode[];
  static fromError(error: IModelHubError): ConflictingCodesError | undefined;
}

// @public
class ConflictingLocksError extends IModelHubError {
  addLocks(error: IModelHubError): void;
  conflictingLocks?: Lock[];
  static fromError(error: IModelHubError): ConflictingLocksError | undefined;
}

// WARNING: configRelyingPartyUri has incomplete type information
// @public
class ConnectClient extends WsgClient {
  constructor();
  getInvitedProjects(requestContext: AuthorizedClientRequestContext, queryOptions?: ConnectRequestQueryOptions): Promise<Project[]>;
  getProject(requestContext: AuthorizedClientRequestContext, queryOptions?: ConnectRequestQueryOptions): Promise<Project>;
  getProjects(requestContext: AuthorizedClientRequestContext, queryOptions?: ConnectRequestQueryOptions): Promise<Project[]>;
  protected getRelyingPartyUrl(): string;
  protected getUrlSearchKey(): string;
  // (undocumented)
  static readonly searchKey: string;
  // (undocumented)
  protected setupOptionDefaults(options: RequestOptions): Promise<void>;
}

// @public
interface ConnectRequestQueryOptions extends RequestQueryOptions {
  isFavorite?: boolean;
  isMRU?: boolean;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class ConnectSettingsClient extends Client, implements SettingsAdmin {
  constructor(applicationId: string);
  // (undocumented)
  applicationId: string;
  // (undocumented)
  deleteSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  // (undocumented)
  deleteUserSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  getAccessToken(requestContext: ClientRequestContext, authSamlToken: AuthorizationToken): Promise<AccessToken>;
  // (undocumented)
  getSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  // (undocumented)
  protected getUrlSearchKey(): string;
  // (undocumented)
  getUserSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  // (undocumented)
  saveSetting(requestContext: AuthorizedClientRequestContext, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  // (undocumented)
  saveUserSetting(requestContext: AuthorizedClientRequestContext, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  // (undocumented)
  static readonly searchKey: string;
}

// @public
class DefaultCodeUpdateOptionsProvider {
  constructor();
  // (undocumented)
  protected _defaultOptions: CodeUpdateOptions;
  assignOptions(options: CodeUpdateOptions): Promise<void>;
}

// @public
class DefaultLockUpdateOptionsProvider {
  constructor();
  // (undocumented)
  protected _defaultOptions: LockUpdateOptions;
  assignOptions(options: LockUpdateOptions): Promise<void>;
}

// @public
class DefaultRequestOptionsProvider {
  constructor();
  // (undocumented)
  protected _defaultOptions: RequestOptions;
  assignOptions(options: RequestOptions): Promise<void>;
}

// @public
class DefaultWsgRequestOptionsProvider extends DefaultRequestOptionsProvider {
  constructor();
}

// @public
class ECInstance {
  // (undocumented)
  [index: string]: any;
  // (undocumented)
  ecId: string;
}

// @public
class ECJsonTypeMap {
  static classToJson(applicationKey: string, classKey: string, classKeyMapInfo: ClassKeyMapInfo): (typedConstructor: ConstructorType) => void;
  static fromJson<T extends ECInstance>(typedConstructor: new () => T, applicationKey: string, ecJsonInstance: any): T | undefined;
  static propertyToJson(applicationKey: string, propertyAccessString: string): (object: any, propertyKey: string) => void;
  static toJson<T extends ECInstance>(applicationKey: string, typedInstance: T): any | undefined;
}

// @public
class EventHandler extends EventBaseHandler {
  constructor(handler: IModelBaseHandler);
  createListener(requestContext: ClientRequestContext, authenticationCallback: () => Promise<AccessToken>, subscriptionId: string, imodelId: GuidString, listener: (event: IModelHubEvent) => void): () => void;
  getEvent(requestContext: ClientRequestContext, sasToken: string, baseAddress: string, subscriptionId: string, timeout?: number): Promise<IModelHubEvent | undefined>;
  getSASToken(requestContext: AuthorizedClientRequestContext, imodelId: GuidString): Promise<EventSAS>;
  readonly subscriptions: EventSubscriptionHandler;
}

// @public
class EventSAS extends BaseEventSAS {
}

// @public
class EventSubscription extends WsgInstance {
  eventTypes?: EventType[];
}

// @public
class EventSubscriptionHandler {
  constructor(handler: IModelBaseHandler);
  create(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, events: EventType[]): Promise<EventSubscription>;
  delete(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, eventSubscriptionId: string): Promise<void>;
  update(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, subscription: EventSubscription): Promise<EventSubscription>;
}

// @public
class FeatureEndedLogEntry extends FeatureLogEntry {
  constructor(featureId: GuidString, startEntryId: GuidString, hostName: string, usageType: UsageType);
  static fromStartEntry(startEntry: FeatureStartedLogEntry): FeatureEndedLogEntry;
  // (undocumented)
  readonly startEntryId: GuidString;
}

// @public
class FeatureLogEntry {
  constructor(featureId: GuidString, hostName: string, usageType: UsageType);
  readonly featureId: GuidString;
  readonly hostName: string;
  productId?: number;
  productVersion?: ProductVersion;
  projectId?: GuidString;
  readonly timestamp: string;
  usageData: FeatureLogEntryAttribute[];
  readonly usageType: UsageType;
  userInfo?: UsageUserInfo;
}

// @public
interface FeatureLogEntryAttribute {
  // (undocumented)
  name: string;
  // (undocumented)
  value: any;
}

// @public (undocumented)
interface FeatureLogEntryAttributeJson {
  // (undocumented)
  name: string;
  // (undocumented)
  value: string;
}

// @public
interface FeatureLogEntryJson extends UsageLogEntryJson {
  eDateZ: string;
  ftrID: GuidString;
  sDateZ: string;
  uData: FeatureLogEntryAttributeJson[];
}

// @public
class FeatureStartedLogEntry extends FeatureLogEntry {
  constructor(featureId: GuidString, hostName: string, usageType: UsageType);
  readonly entryId: GuidString;
}

// @public
class FileAccessKey extends WsgInstance {
  // (undocumented)
  permissions?: string;
  // (undocumented)
  requiresConfirmation?: string;
  // (undocumented)
  type?: string;
  // (undocumented)
  url?: string;
}

// @public
interface FileHandler {
  // (undocumented)
  agent: https.Agent;
  basename(filePath: string): string;
  downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, path: string, fileSize?: number, progress?: (progress: ProgressInfo) => void): Promise<void>;
  exists(filePath: string): boolean;
  getFileSize(filePath: string): number;
  isDirectory(filePath: string): boolean;
  join(...paths: string[]): string;
  uploadFile(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, path: string, progress?: (progress: ProgressInfo) => void): Promise<void>;
}

// @public
export function getArrayBuffer(requestContext: ClientRequestContext, url: string): Promise<any>;

// @public
enum GetEventOperationType {
  Destructive = 0,
  Peek = 1
}

// @public
export function getJson(requestContext: ClientRequestContext, url: string): Promise<any>;

// @public
class GlobalEventHandler extends EventBaseHandler {
  constructor(handler: IModelBaseHandler);
  createListener(requestContext: AuthorizedClientRequestContext, authenticationCallback: () => Promise<AccessToken>, subscriptionInstanceId: string, listener: (event: IModelHubGlobalEvent) => void): () => void;
  getEvent(requestContext: ClientRequestContext, sasToken: string, baseAddress: string, subscriptionInstanceId: string, timeout?: number, getOperation?: GetEventOperationType): Promise<IModelHubGlobalEvent | undefined>;
  getSASToken(requestContext: AuthorizedClientRequestContext): Promise<GlobalEventSAS>;
  readonly subscriptions: GlobalEventSubscriptionHandler;
}

// @public
class GlobalEventSAS extends BaseEventSAS {
}

// @public
class GlobalEventSubscription extends WsgInstance {
  // (undocumented)
  eventTypes?: GlobalEventType[];
  // (undocumented)
  subscriptionId?: string;
}

// @public
class GlobalEventSubscriptionHandler {
  constructor(handler: IModelBaseHandler);
  create(requestContext: AuthorizedClientRequestContext, subscriptionId: GuidString, globalEvents: GlobalEventType[]): Promise<GlobalEventSubscription>;
  delete(requestContext: AuthorizedClientRequestContext, subscriptionInstanceId: string): Promise<void>;
  update(requestContext: AuthorizedClientRequestContext, subscription: GlobalEventSubscription): Promise<GlobalEventSubscription>;
}

// @public
class HardiModelDeleteEvent extends IModelHubGlobalEvent {
}

// @public
class HubCode extends CodeBase {
  value?: string;
}

// @public
class HubIModel extends WsgInstance {
  createdDate?: string;
  description?: string;
  id?: GuidString;
  iModelTemplate?: string;
  initialized?: boolean;
  name?: string;
  userCreated?: string;
}

// @public
class HubUserInfo extends WsgInstance {
  email?: string;
  firstName?: string;
  id?: string;
  lastName?: string;
}

// @public
interface IAngularOidcFrontendClient extends IOidcFrontendClient {
  // (undocumented)
  handleRedirectCallback(): Promise<boolean>;
}

// @public
interface IAuthorizationClient {
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
  hasExpired: boolean;
  hasSignedIn: boolean;
  isAuthorized: boolean;
}

// @public (undocumented)
class IModelBankClient extends IModelClient {
  constructor(url: string, handler: FileHandler | undefined);
}

// @public (undocumented)
class IModelBankFileSystemContextClient implements ContextManagerClient {
  constructor(baseUri: string);
  // (undocumented)
  baseUri: string;
  // (undocumented)
  createContext(requestContext: AuthorizedClientRequestContext, name: string): Promise<void>;
  // (undocumented)
  deleteContext(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<void>;
  // (undocumented)
  queryContextByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project>;
}

// @public (undocumented)
class IModelBankHandler extends IModelBaseHandler {
  constructor(url: string, handler: FileHandler | undefined, keepAliveDuration?: number);
  // (undocumented)
  getUrl(_requestContext: ClientRequestContext, excludeApiVersion?: boolean): Promise<string>;
  // (undocumented)
  protected getUrlSearchKey(): string;
}

// WARNING: configRelyingPartyUri has incomplete type information
// @public
class IModelBaseHandler extends WsgClient {
  constructor(keepAliveDuration?: number, fileHandler?: FileHandler);
  // (undocumented)
  protected _agent: any;
  // (undocumented)
  protected _fileHandler: FileHandler | undefined;
  // (undocumented)
  protected _url?: string;
  delete(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string): Promise<void>;
  deleteInstance<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string, instance?: T, requestOptions?: WsgRequestOptions): Promise<void>;
  // (undocumented)
  formatProjectIdForUrl(projectId: string): string;
  getAccessToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken): Promise<AccessToken>;
  getAgent(): any;
  // WARNING: The type "CustomRequestOptions" needs to be exported by the package (e.g. added to index.ts)
  getCustomRequestOptions(): CustomRequestOptions;
  // (undocumented)
  getFileHandler(): FileHandler | undefined;
  getInstances<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, queryOptions?: RequestQueryOptions): Promise<T[]>;
  protected getRelyingPartyUrl(): string;
  getUrl(requestContext: ClientRequestContext): Promise<string>;
  protected getUrlSearchKey(): string;
  postInstance<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, instance: T, requestOptions?: WsgRequestOptions): Promise<T>;
  postInstances<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, instances: T[], requestOptions?: WsgRequestOptions): Promise<T[]>;
  postQuery<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, queryOptions: RequestQueryOptions): Promise<T[]>;
  // (undocumented)
  static readonly searchKey: string;
  protected setupOptionDefaults(options: RequestOptions): Promise<void>;
}

// @public
class IModelClient {
  constructor(baseHandler: IModelBaseHandler, fileHandler?: FileHandler);
  // (undocumented)
  protected _handler: IModelBaseHandler;
  readonly briefcases: BriefcaseHandler;
  readonly changeSets: ChangeSetHandler;
  readonly codes: CodeHandler;
  readonly events: EventHandler;
  readonly globalEvents: GlobalEventHandler;
  readonly iModel: IModelHandler;
  readonly iModels: IModelsHandler;
  readonly locks: LockHandler;
  // WARNING: The type "CustomRequestOptions" needs to be exported by the package (e.g. added to index.ts)
  readonly requestOptions: CustomRequestOptions;
  setFileHandler(fileHandler: FileHandler): void;
  readonly thumbnails: ThumbnailHandler;
  readonly users: UserInfoHandler;
  readonly versions: VersionHandler;
}

// @public
class IModelCreatedEvent extends IModelHubGlobalEvent {
}

// @public
class IModelDeletedEvent extends IModelHubEvent {
}

// @public (undocumented)
interface IModelFileSystemContextProps {
  // (undocumented)
  description: string;
  // (undocumented)
  id: string;
  // (undocumented)
  name: string;
}

// @public
class IModelHandler {
  constructor(handler: IModelsHandler);
  create(requestContext: AuthorizedClientRequestContext, contextId: string, name: string, path?: string, description?: string, progressCallback?: (progress: ProgressInfo) => void, timeOutInMilliseconds?: number): Promise<HubIModel>;
  delete(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<void>;
  download(requestContext: AuthorizedClientRequestContext, contextId: string, path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
  get(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<HubIModel>;
  getInitializationState(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<InitializationState>;
  update(requestContext: AuthorizedClientRequestContext, contextId: string, imodel: HubIModel): Promise<HubIModel>;
}

// @public
class IModelHubClient extends IModelClient {
  constructor(fileHandler?: FileHandler, iModelBaseHandler?: IModelBaseHandler);
  getAccessToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken): Promise<AccessToken>;
}

// @public
class IModelHubClientError extends IModelHubError {
  static browser(): IModelHubClientError;
  static fileHandler(): IModelHubClientError;
  static fileNotFound(): IModelHubClientError;
  static fromId(id: IModelHubStatus, message: string): IModelHubClientError;
  static invalidArgument(argumentName: string): IModelHubClientError;
  static missingDownloadUrl(argumentName: string): IModelHubClientError;
  static undefinedArgument(argumentName: string): IModelHubClientError;
}

// @public
class IModelHubError extends WsgError {
  constructor(errorNumber: number | HttpStatus, message?: string, getMetaData?: GetMetaDataFunction);
  data: any;
  static fromId(id: IModelHubStatus, message: string): IModelHubError;
  getLogLevel(): LogFunction;
  log(): void;
  static parse(response: any, log?: boolean): ResponseError;
  static shouldRetry(error: any, response: any): boolean;
}

// @public
class IModelHubEvent extends IModelHubBaseEvent {
  fromJson(obj: any): void;
  iModelId?: GuidString;
}

// @public
class IModelHubGlobalEvent extends IModelHubBaseEvent {
  fromJson(obj: any): void;
  iModelId?: GuidString;
  projectId?: string;
}

// @public
class IModelQuery extends InstanceIdQuery {
  byName(name: string): this;
}

// @public
class IModelsHandler {
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler);
  create(requestContext: AuthorizedClientRequestContext, contextId: string, name: string, path?: string, description?: string, progressCallback?: (progress: ProgressInfo) => void, timeOutInMilliseconds?: number): Promise<HubIModel>;
  delete(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: GuidString): Promise<void>;
  download(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void>;
  get(requestContext: AuthorizedClientRequestContext, contextId: string, query?: IModelQuery): Promise<HubIModel[]>;
  getInitializationState(requestContext: AuthorizedClientRequestContext, imodelId: GuidString): Promise<InitializationState>;
  update(requestContext: AuthorizedClientRequestContext, contextId: string, imodel: HubIModel): Promise<HubIModel>;
}

// @public
class ImsActiveSecureTokenClient extends Client {
  constructor();
  getToken(requestContext: ClientRequestContext, userCredentials: ImsUserCredentials, appId?: string): Promise<AuthorizationToken>;
  protected getUrlSearchKey(): string;
  // (undocumented)
  static readonly searchKey: string;
  // (undocumented)
  protected setupOptionDefaults(options: RequestOptions): Promise<void>;
}

// @public
class ImsDelegationSecureTokenClient extends Client {
  constructor();
  getToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken, relyingPartyUri?: string, appId?: string): Promise<AccessToken>;
  protected getUrlSearchKey(): string;
  // (undocumented)
  static readonly searchKey: string;
  protected setupOptionDefaults(options: RequestOptions): Promise<void>;
}

// @public
class ImsFederatedAuthenticationClient extends Client {
  constructor();
  protected getUrlSearchKey(): string;
  static parseTokenResponse(authTokenResponse: string): AuthorizationToken | undefined;
  // (undocumented)
  static readonly searchKey: string;
}

// @public
class ImsTestAuthorizationClient implements IAuthorizationClient {
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
  readonly hasExpired: boolean;
  readonly hasSignedIn: boolean;
  readonly isAuthorized: boolean;
  // (undocumented)
  signIn(requestContext: ClientRequestContext, userCredentials: ImsUserCredentials, relyingPartyUri?: string): Promise<AccessToken>;
}

// @public
interface ImsUserCredentials {
  // (undocumented)
  email: string;
  // (undocumented)
  password: string;
}

// @public (undocumented)
enum IncludePrefix {
  // (undocumented)
  No = 1,
  // (undocumented)
  Yes = 0
}

// @public
enum InitializationState {
  CodeTooLong = 5,
  Failed = 3,
  NotStarted = 1,
  OutdatedFile = 4,
  Scheduled = 2,
  SeedFileIsBriefcase = 6,
  Successful = 0
}

// @public
class InstanceIdQuery extends Query {
  // (undocumented)
  protected _byId?: GuidString;
  byId(id: GuidString): this;
  getId(): string | undefined;
}

// @public
interface IOidcFrontendClient extends IDisposable, IAuthorizationClient {
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
  hasExpired: boolean;
  hasSignedIn: boolean;
  initialize(requestContext: ClientRequestContext): Promise<void>;
  isAuthorized: boolean;
  readonly onUserStateChanged: BeEvent<(token: AccessToken | undefined) => void>;
  signIn(requestContext: ClientRequestContext): Promise<AccessToken>;
  signOut(requestContext: ClientRequestContext): Promise<void>;
}

// @public
class LargeThumbnail extends Thumbnail {
}

// @public
class Lock extends LockBase {
  objectId?: Id64String;
}

// @public
class LockBase extends WsgInstance {
  briefcaseId?: number;
  lockLevel?: LockLevel;
  lockType?: LockType;
  releasedWithChangeSet?: string;
  releasedWithChangeSetIndex?: string;
  seedFileId?: GuidString;
}

// @public
class LockEvent extends BriefcaseEvent {
  fromJson(obj: any): void;
  lockLevel?: LockLevel;
  lockType?: LockType;
  objectIds?: Id64String[];
  releasedWithChangeSet?: string;
}

// @public
class LockHandler {
  constructor(handler: IModelBaseHandler);
  deleteAll(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, briefcaseId: number): Promise<void>;
  get(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, query?: LockQuery): Promise<Lock[]>;
  update(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, locks: Lock[], updateOptions?: LockUpdateOptions): Promise<Lock[]>;
}

// @public
enum LockLevel {
  Exclusive = 2,
  None = 0,
  Shared = 1
}

// @public
class LockQuery extends Query {
  byBriefcaseId(briefcaseId: number): this;
  byLockLevel(lockLevel: LockLevel): this;
  byLocks(locks: Lock[]): this;
  byLockType(lockType: LockType): this;
  byObjectId(objectId: Id64String): this;
  byReleasedWithChangeSet(changeSetId: string): this;
  byReleasedWithChangeSetIndex(changeSetIndex: number): this;
  readonly isMultiLockQuery: boolean;
  top(n: number): this;
  unavailableLocks(briefcaseId: number, lastChangeSetIndex: string): this;
}

// @public
enum LockType {
  CodeSpecs = 4,
  Db = 0,
  Element = 2,
  Model = 1,
  Schemas = 3
}

// @public
interface LockUpdateOptions {
  continueOnConflict?: boolean;
  deniedLocks?: boolean;
  locksPerRequest?: number;
  unlimitedReporting?: boolean;
}

// @public (undocumented)
class LogEntryConverter {
  // (undocumented)
  static toFeatureLogJson(entries: FeatureLogEntry[]): FeatureLogEntryJson[];
  // (undocumented)
  static toUsageLogJson(entry: UsageLogEntry): UsageLogEntryJson;
}

// @public
interface LogPostingResponse {
  // (undocumented)
  message: string;
  // (undocumented)
  requestId: GuidString;
  // (undocumented)
  status: BentleyStatus;
  // (undocumented)
  time: number;
}

// @public
class MultiCode extends CodeBase {
  // (undocumented)
  values?: string[];
}

// @public
class MultiLock extends LockBase {
  // (undocumented)
  objectIds?: Id64String[];
}

// @public
class NamedVersionCreatedEvent extends IModelHubGlobalEvent {
  // (undocumented)
  changeSetId?: string;
  fromJson(obj: any): void;
  // (undocumented)
  versionId?: GuidString;
  // (undocumented)
  versionName?: string;
}

// @public (undocumented)
class OidcClient extends Client {
  constructor();
  protected getUrlSearchKey(): string;
  // (undocumented)
  static readonly searchKey: string;
}

// @public
interface OidcFrontendClientConfiguration {
  clientId: string;
  postSignoutRedirectUri?: string;
  redirectUri: string;
  scope: string;
}

// @public
export function ParseEvent(response: Response): IModelHubEvent;

// @public
export function ParseGlobalEvent(response: Response, handler?: IModelBaseHandler, sasToken?: string): IModelHubGlobalEvent;

// @public
class Permission extends WsgInstance {
  // (undocumented)
  categoryId?: number;
  // (undocumented)
  description?: string;
  // (undocumented)
  name?: string;
  // (undocumented)
  serviceGprId?: number;
}

// @public
interface ProductVersion {
  // (undocumented)
  major: number;
  // (undocumented)
  minor: number;
  // (undocumented)
  sub1?: number;
  // (undocumented)
  sub2?: number;
}

// @public (undocumented)
interface ProgressInfo {
  // (undocumented)
  loaded: number;
  // (undocumented)
  percent?: number;
  // (undocumented)
  total?: number;
}

// @public
class Project extends WsgInstance {
  // (undocumented)
  allowExternalTeamMembers?: boolean;
  // (undocumented)
  assetId?: string;
  // (undocumented)
  countryCode?: string;
  // (undocumented)
  dataLocationId?: string;
  // (undocumented)
  industry?: string;
  // (undocumented)
  isRbacEnabled?: boolean;
  // (undocumented)
  lastModifiedDate?: string;
  // (undocumented)
  latitude?: string;
  // (undocumented)
  location?: string;
  // (undocumented)
  longitude?: string;
  // (undocumented)
  name?: string;
  // (undocumented)
  number?: string;
  // (undocumented)
  registeredDate?: string;
  // (undocumented)
  status?: number;
  // (undocumented)
  timeZoneLocation?: string;
  // (undocumented)
  type?: string;
  // (undocumented)
  ultimateRefId?: string;
}

// @public
class Query {
  // (undocumented)
  protected _query: RequestQueryOptions;
  protected addFilter(filter: string, operator?: "and" | "or"): void;
  protected addSelect(select: string): this;
  filter(filter: string): this;
  getQueryOptions(): RequestQueryOptions;
  orderBy(orderBy: string): this;
  resetQueryOptions(): void;
  select(select: string): this;
  skip(n: number): this;
  top(n: number): this;
}

// @public
class RbacProject extends WsgInstance {
}

// @public (undocumented)
interface RbacRequestQueryOptions extends RequestQueryOptions {
  // (undocumented)
  rbacOnly?: boolean;
}

// @public (undocumented)
class RbacUser extends WsgInstance {
}

// @public
class RealityData extends WsgInstance {
  // (undocumented)
  accuracyInMeters?: string;
  // (undocumented)
  classification?: string;
  // (undocumented)
  client: undefined | RealityDataServicesClient;
  containerName?: string;
  // (undocumented)
  copyright?: string;
  // (undocumented)
  createdTimestamp?: string;
  // (undocumented)
  creatorId?: string;
  // (undocumented)
  dataLocationGuid?: string;
  // (undocumented)
  dataSet?: string;
  // (undocumented)
  description?: string;
  // (undocumented)
  footprint?: string;
  getBlobStringUrl(requestContext: AuthorizedClientRequestContext, name: string, nameRelativeToRootDocumentPath?: boolean): Promise<string>;
  getBlobUrl(requestContext: AuthorizedClientRequestContext): Promise<URL>;
  getModelData(requestContext: AuthorizedClientRequestContext, name: string, nameRelativeToRootDocumentPath?: boolean): Promise<any>;
  getRootDocumentJson(requestContext: AuthorizedClientRequestContext): Promise<any>;
  getTileContent(requestContext: AuthorizedClientRequestContext, name: string, nameRelativeToRootDocumentPath?: boolean): Promise<any>;
  getTileJson(requestContext: AuthorizedClientRequestContext, name: string, nameRelativeToRootDocumentPath?: boolean): Promise<any>;
  // (undocumented)
  group?: number;
  // (undocumented)
  id?: string;
  // (undocumented)
  listable?: string;
  // (undocumented)
  metadataUrl?: string;
  // (undocumented)
  modifiedTimestamp?: string;
  // (undocumented)
  name?: string;
  // (undocumented)
  organizationId?: string;
  // (undocumented)
  ownedBy?: string;
  // (undocumented)
  projectId: undefined | string;
  // (undocumented)
  resolutionInMeters?: string;
  // (undocumented)
  rootDocument?: string;
  // (undocumented)
  size?: string;
  // (undocumented)
  streamed?: string;
  // (undocumented)
  termsOfUse?: string;
  // (undocumented)
  thumbnailDocument?: string;
  // (undocumented)
  type?: string;
  // (undocumented)
  ultimateId?: string;
  // (undocumented)
  version?: string;
  // (undocumented)
  visibility?: string;
}

// WARNING: configRelyingPartyUri has incomplete type information
// @public
class RealityDataServicesClient extends WsgClient {
  constructor();
  getFileAccessKey(requestContext: AuthorizedClientRequestContext, projectId: string, tilesId: string): Promise<FileAccessKey[]>;
  getRealityData(requestContext: AuthorizedClientRequestContext, projectId: string, tilesId: string): Promise<RealityData>;
  getRealityDataInProject(requestContext: AuthorizedClientRequestContext, projectId: string): Promise<RealityData[]>;
  getRealityDataInProjectOverlapping(requestContext: AuthorizedClientRequestContext, projectId: string, range: Range2d): Promise<RealityData[]>;
  getRealityDataUrl(requestContext: ClientRequestContext, projectId: string, tilesId: string): Promise<string>;
  protected getRelyingPartyUrl(): string;
  protected getUrlSearchKey(): string;
  // (undocumented)
  static readonly searchKey: string;
}

// @public
export function request(requestContext: ClientRequestContext, url: string, options: RequestOptions): Promise<Response>;

// @public (undocumented)
interface RequestBasicCredentials {
  // (undocumented)
  password: string;
  // (undocumented)
  user: string;
}

// @public (undocumented)
class RequestGlobalOptions {
  // (undocumented)
  static HTTPS_PROXY?: https.Agent;
}

// @public (undocumented)
interface RequestOptions {
  // (undocumented)
  accept?: string;
  // (undocumented)
  agent?: https.Agent;
  // (undocumented)
  auth?: RequestBasicCredentials;
  // (undocumented)
  body?: any;
  // (undocumented)
  buffer?: any;
  // (undocumented)
  errorCallback?: (response: any) => ResponseError;
  // (undocumented)
  headers?: any;
  // (undocumented)
  method: string;
  // (undocumented)
  parser?: any;
  // (undocumented)
  progressCallback?: (progress: ProgressInfo) => void;
  // (undocumented)
  qs?: any | RequestQueryOptions;
  // (undocumented)
  readStream?: any;
  // (undocumented)
  redirects?: number;
  // (undocumented)
  responseType?: string;
  // (undocumented)
  retries?: number;
  // (undocumented)
  retryCallback?: (error: any, response: any) => boolean;
  // (undocumented)
  stream?: any;
  // (undocumented)
  timeout?: number | {
          deadline?: number;
          response?: number;
      };
  // (undocumented)
  useCorsProxy?: boolean;
}

// @public
interface RequestQueryOptions {
  // WARNING: The name "$filter" contains unsupported characters; API names should use only letters, numbers, and underscores
  $filter?: string;
  // WARNING: The name "$orderby" contains unsupported characters; API names should use only letters, numbers, and underscores
  $orderby?: string;
  // WARNING: The name "$select" contains unsupported characters; API names should use only letters, numbers, and underscores
  $select?: string;
  // WARNING: The name "$skip" contains unsupported characters; API names should use only letters, numbers, and underscores
  $skip?: number;
  // WARNING: The name "$top" contains unsupported characters; API names should use only letters, numbers, and underscores
  $top?: number;
}

// @public (undocumented)
interface RequestQueryStringifyOptions {
  // (undocumented)
  delimiter?: string;
  // (undocumented)
  encode?: boolean;
}

// @public
interface Response {
  // (undocumented)
  body: any;
  // (undocumented)
  header: any;
  // (undocumented)
  status: number;
}

// @public
class ResponseError extends BentleyError {
  constructor(errorNumber: number | HttpStatus, message?: string, getMetaData?: GetMetaDataFunction);
  // (undocumented)
  protected _data?: any;
  // (undocumented)
  description?: string;
  log(): void;
  // (undocumented)
  logMessage(): string;
  static parse(response: any, log?: boolean): ResponseError;
  // (undocumented)
  static parseHttpStatus(statusType: number): HttpStatus;
  static shouldRetry(error: any, response: any): boolean;
  // (undocumented)
  status?: number;
}

// @public (undocumented)
class SeedFile extends WsgInstance {
  // (undocumented)
  downloadUrl?: string;
  // (undocumented)
  fileDescription?: string;
  // (undocumented)
  fileId?: GuidString;
  // (undocumented)
  fileName?: string;
  // (undocumented)
  fileSize?: string;
  id?: GuidString;
  // (undocumented)
  iModelName?: string;
  // (undocumented)
  index?: number;
  // (undocumented)
  initializationState?: InitializationState;
  // (undocumented)
  isUploaded?: boolean;
  // (undocumented)
  mergedChangeSetId?: string;
  // (undocumented)
  uploadedDate?: string;
  // (undocumented)
  uploadUrl?: string;
  // (undocumented)
  userUploaded?: string;
}

// @public
interface SettingsAdmin {
  deleteSetting(requestContext: AuthorizedClientRequestContext, namespace: string, name: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  deleteUserSetting(requestContext: AuthorizedClientRequestContext, namespace: string, name: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  getSetting(requestContext: AuthorizedClientRequestContext, namespace: string, name: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  getUserSetting(requestContext: AuthorizedClientRequestContext, namespace: string, name: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  saveSetting(requestContext: AuthorizedClientRequestContext, settings: any, namespace: string, name: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
  saveUserSetting(requestContext: AuthorizedClientRequestContext, settings: any, namespace: string, name: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
}

// @public
class SettingsResult {
  // @internal
  constructor(status: SettingsStatus, errorMessage?: string | undefined, setting?: any);
  // (undocumented)
  errorMessage?: string | undefined;
  // (undocumented)
  setting?: any;
  // (undocumented)
  status: SettingsStatus;
}

// @public
enum SettingsStatus {
  AuthorizationError = 110593,
  IModelInvalid = 110596,
  ProjectInvalid = 110595,
  ServerError = 110598,
  SettingNotFound = 110597,
  // (undocumented)
  SETTINGS_ERROR_BASE = 110592,
  Success = 0,
  UnknownError = 110600,
  UrlError = 110594
}

// @public
class SmallThumbnail extends Thumbnail {
}

// @public
class SoftiModelDeleteEvent extends IModelHubGlobalEvent {
}

// @public
class StringIdQuery extends Query {
  // (undocumented)
  protected _byId?: string;
  byId(id: string): this;
  // (undocumented)
  protected checkValue(id: string): void;
  getId(): string | undefined;
}

// @public
class Thumbnail extends WsgInstance {
  // (undocumented)
  id?: GuidString;
}

// @public
class ThumbnailHandler {
  constructor(handler: IModelBaseHandler);
  download(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, thumbnail: Thumbnail | TipThumbnail): Promise<string>;
  get(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, size: ThumbnailSize, query?: ThumbnailQuery): Promise<Thumbnail[]>;
}

// @public
class ThumbnailQuery extends InstanceIdQuery {
  byVersionId(versionId: GuidString): this;
}

// @public
interface TipThumbnail {
  projectId: string;
  size: ThumbnailSize;
}

// @public
class Token {
  protected constructor(samlAssertion: string);
  // (undocumented)
  protected _expiresAt?: Date;
  // (undocumented)
  protected _samlAssertion: string;
  // (undocumented)
  protected _startsAt?: Date;
  // (undocumented)
  protected _userInfo?: UserInfo;
  // (undocumented)
  protected _x509Certificate?: string;
  // (undocumented)
  getExpiresAt(): Date | undefined;
  // (undocumented)
  getSamlAssertion(): string | undefined;
  // (undocumented)
  getStartsAt(): Date | undefined;
  // (undocumented)
  getUserInfo(): UserInfo | undefined;
  // (undocumented)
  protected parseSamlAssertion(): boolean;
  // (undocumented)
  setUserInfo(userInfo: UserInfo): void;
}

// @public
class UlasClient extends Client {
  constructor();
  getAccessToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken): Promise<AccessToken>;
  protected getUrlSearchKey(): string;
  logFeature(requestContext: AuthorizedClientRequestContext, ...entries: FeatureLogEntry[]): Promise<LogPostingResponse>;
  logUsage(requestContext: AuthorizedClientRequestContext, entry: UsageLogEntry): Promise<LogPostingResponse>;
  // (undocumented)
  protected setupOptionDefaults(options: RequestOptions): Promise<void>;
}

// WARNING: configURL has incomplete type information
// WARNING: configResolveUrlUsingRegion has incomplete type information
// @public
class UrlDiscoveryClient extends Client {
  constructor();
  discoverUrl(requestContext: ClientRequestContext, searchKey: string, regionId: number | undefined): Promise<string>;
  getUrl(): Promise<string>;
  protected getUrlSearchKey(): string;
}

// @public
class UsageLogEntry {
  constructor(hostName: string, usageType: UsageType);
  readonly hostName: string;
  productId?: number;
  productVersion?: ProductVersion;
  projectId?: GuidString;
  readonly timestamp: string;
  readonly usageType: UsageType;
  userInfo?: UsageUserInfo;
}

// @public
interface UsageLogEntryJson {
  corID: GuidString;
  country: string | undefined;
  evTimeZ: string;
  fstr: string;
  hID: string;
  imsID: GuidString | undefined;
  lSrc: string;
  lVer: number;
  pid: GuidString | undefined;
  polID: GuidString;
  prdid: number | undefined;
  projID: GuidString | undefined;
  secID: string;
  uID: string | undefined;
  ultID: number | undefined;
  uType: string;
  ver: number | undefined;
}

// @public
enum UsageType {
  // (undocumented)
  Beta = 2,
  // (undocumented)
  HomeUse = 3,
  // (undocumented)
  PreActivation = 4,
  // (undocumented)
  Production = 0,
  // (undocumented)
  Trial = 1
}

// @public
interface UsageUserInfo {
  // (undocumented)
  hostUserName?: string;
  imsId: GuidString;
  ultimateSite: number;
  usageCountryIso: string;
}

// @public
class UserInfo {
  constructor(
      id: string, 
      email?: {
          id: string;
          isVerified?: boolean | undefined;
      } | undefined, 
      profile?: {
          firstName: string;
          lastName: string;
          name?: string | undefined;
          preferredUserName?: string | undefined;
      } | undefined, 
      organization?: {
          id: string;
          name: string;
      } | undefined, 
      featureTracking?: {
          ultimateSite: string;
          usageCountryIso: string;
      } | undefined);
  email?: {
          id: string;
          isVerified?: boolean | undefined;
      } | undefined;
  featureTracking?: {
          ultimateSite: string;
          usageCountryIso: string;
      } | undefined;
  // (undocumented)
  static fromJson(jsonObj: any): UserInfo | undefined;
  id: string;
  organization?: {
          id: string;
          name: string;
      } | undefined;
  profile?: {
          firstName: string;
          lastName: string;
          name?: string | undefined;
          preferredUserName?: string | undefined;
      } | undefined;
}

// @public
class UserInfoHandler {
  constructor(handler: IModelBaseHandler);
  get(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, query?: UserInfoQuery): Promise<HubUserInfo[]>;
  readonly statistics: UserStatisticsHandler;
}

// @public
class UserInfoQuery extends Query {
  // (undocumented)
  protected _byId?: string;
  byId(id: string): this;
  byIds(ids: string[]): this;
  getId(): string | undefined;
  // (undocumented)
  readonly isQueriedByIds: boolean;
}

// @public
class UserStatistics extends HubUserInfo {
  briefcasesCount?: number;
  lastChangeSetPushDate?: string;
  ownedLocksCount?: number;
  pushedChangeSetsCount?: number;
}

// @public
class UserStatisticsHandler {
  constructor(handler: IModelBaseHandler);
  get(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, query?: UserStatisticsQuery): Promise<UserStatistics[]>;
}

// @public
class UserStatisticsQuery extends Query {
  constructor();
  // (undocumented)
  protected _byId?: string;
  byId(id: string): this;
  byIds(ids: string[]): this;
  getId(): string | undefined;
  readonly isQueriedByIds: boolean;
  selectAll(): this;
  selectBriefcasesCount(): this;
  selectLastChangeSetPushDate(): this;
  selectOwnedLocksCount(): this;
  selectPushedChangeSetsCount(): this;
}

// @public
class Version extends WsgInstance {
  changeSetId?: string;
  createdDate?: string;
  description?: string;
  // (undocumented)
  id?: GuidString;
  largeThumbnailId?: GuidString;
  name?: string;
  smallThumbnailId?: GuidString;
  userCreated?: string;
}

// @public
class VersionEvent extends IModelHubEvent {
  changeSetId?: string;
  fromJson(obj: any): void;
  versionId?: GuidString;
  versionName?: string;
}

// @public
class VersionHandler {
  constructor(handler: IModelBaseHandler);
  create(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, changeSetId: string, name: string, description?: string): Promise<Version>;
  get(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, query?: VersionQuery): Promise<Version[]>;
  update(requestContext: AuthorizedClientRequestContext, imodelId: GuidString, version: Version): Promise<Version>;
}

// @public
class VersionQuery extends InstanceIdQuery {
  byChangeSet(changesetId: string): this;
  byName(name: string): this;
  selectThumbnailId(...sizes: ThumbnailSize[]): this;
}

// WARNING: configHostRelyingPartyUri has incomplete type information
// WARNING: configUseHostRelyingPartyUriAsFallback has incomplete type information
// @public
class WsgClient extends Client {
  protected constructor(apiVersion: string);
  // (undocumented)
  protected _url?: string;
  // (undocumented)
  apiVersion: string;
  protected deleteInstance<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string, instance?: T, requestOptions?: WsgRequestOptions): Promise<void>;
  getAccessToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken): Promise<AccessToken>;
  protected getInstances<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, queryOptions?: RequestQueryOptions): Promise<T[]>;
  protected abstract getRelyingPartyUrl(): string;
  getUrl(requestContext: ClientRequestContext, excludeApiVersion?: boolean): Promise<string>;
  protected postInstance<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, instance: T, requestOptions?: WsgRequestOptions): Promise<T>;
  protected postInstances<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, instances: T[], requestOptions?: WsgRequestOptions): Promise<T[]>;
  protected postQuery<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, queryOptions: RequestQueryOptions): Promise<T[]>;
  protected setupOptionDefaults(options: RequestOptions): Promise<void>;
}

// @public
class WsgError extends ResponseError {
  constructor(errorNumber: number | HttpStatus, message?: string, getMetaData?: GetMetaDataFunction);
  static getErrorStatus(errorId: number, httpStatusType: number): number;
  static getWSStatusId(error: string): number;
  log(): void;
  static parse(response: any, log?: boolean): ResponseError;
  static shouldRetry(error: any, response: any): boolean;
}

// @public
class WsgInstance extends ECInstance {
  // (undocumented)
  changeState?: ChangeState;
  // (undocumented)
  eTag?: string;
  // (undocumented)
  wsgId: string;
}

// @public
interface WsgRequestOptions {
  // (undocumented)
  CustomOptions?: any;
  // (undocumented)
  RefreshInstances?: boolean;
  // (undocumented)
  ResponseContent?: "FullInstance" | "Empty" | "InstanceId";
}

// WARNING: Unsupported export: ConstructorType
// WARNING: Unsupported export: ChangeState
// WARNING: Unsupported export: loggingCategory
// WARNING: Unsupported export: loggingCategoryFullUrl
// WARNING: Unsupported export: requestIdHeaderName
// WARNING: Unsupported export: EventType
// WARNING: Unsupported export: GlobalEventType
// WARNING: Unsupported export: ThumbnailSize
// (No @packagedocumentation comment for this package)
