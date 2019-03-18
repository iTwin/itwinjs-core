// @public
enum AccessMode {
  // (undocumented)
  Exclusive = 2,
  // (undocumented)
  Shared = 1
}

// @public
class AnnotationElement2d extends GraphicalElement2d {
  constructor(props: GeometricElement2dProps, iModel: IModelDb);
}

// @public
interface AppActivityMonitor {
  isIdle: boolean;
}

// @public
class AuthorizedBackendRequestContext extends AuthorizedClientRequestContext {
  constructor(accessToken: AccessToken, activityId?: string);
  static create(activityId?: string): Promise<AuthorizedBackendRequestContext>;
}

// @public
class AutoPush {
  constructor(iModel: IModelDb, params: AutoPushParams, activityMonitor?: AppActivityMonitor);
  autoSchedule: boolean;
  cancel(): void;
  readonly durationOfLastPushMillis: number;
  readonly endOfLastPushMillis: number;
  event: BeEvent<AutoPushEventHandler>;
  readonly iModel: IModelDb;
  readonly lastError: any | undefined;
  // (undocumented)
  reserveCodes(): Promise<void>;
  // (undocumented)
  scheduleNextAutoPushIfNecessary(): void;
  scheduleNextPush(intervalSeconds?: number): void;
  readonly state: AutoPushState;
  static validateAutoPushParams(params: any): void;
}

// @public
enum AutoPushEventType {
  // (undocumented)
  PushCancelled = 3,
  // (undocumented)
  PushFailed = 2,
  // (undocumented)
  PushFinished = 1,
  // (undocumented)
  PushStarted = 0
}

// @public
interface AutoPushParams {
  autoSchedule: boolean;
  pushIntervalSecondsMax: number;
  pushIntervalSecondsMin: number;
}

// @public
enum AutoPushState {
  // (undocumented)
  NotRunning = 0,
  // (undocumented)
  Pushing = 2,
  // (undocumented)
  Scheduled = 1
}

// @public
class AuxCoordSystem extends DefinitionElement, implements AuxCoordSystemProps {
  constructor(props: AuxCoordSystemProps, iModel: IModelDb);
  // (undocumented)
  description?: string;
  // (undocumented)
  type: number;
}

// @public
class AuxCoordSystem2d extends AuxCoordSystem, implements AuxCoordSystem2dProps {
  constructor(props: AuxCoordSystem2dProps, iModel: IModelDb);
  // (undocumented)
  angle: number;
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  // (undocumented)
  origin?: Point2d;
}

// @public
class AuxCoordSystem3d extends AuxCoordSystem, implements AuxCoordSystem3dProps {
  constructor(props: AuxCoordSystem3dProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  // (undocumented)
  origin?: Point3d;
  // (undocumented)
  pitch: number;
  // (undocumented)
  roll: number;
  // (undocumented)
  yaw: number;
}

// @public
class AuxCoordSystemSpatial extends AuxCoordSystem3d {
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
}

// @public
class BackendActivityMonitor implements AppActivityMonitor {
  constructor(idleIntervalSeconds?: number);
  // (undocumented)
  idleIntervalSeconds: number;
  // (undocumented)
  readonly isIdle: boolean;
}

// @public
class BackendRequestContext extends ClientRequestContext {
  constructor(activityId?: string);
}

// @public
class BisCore extends Schema {
  static registerSchema(): void;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class BriefcaseEntry {
  briefcaseId: number;
  changeSetId: string;
  changeSetIndex?: number;
  conflictError?: ConflictingCodesError;
  readonly currentChangeSetId: string;
  readonly currentChangeSetIndex: number;
  fileId?: string;
  // (undocumented)
  getDebugInfo(): any;
  getKey(): string;
  readonly hasReversedChanges: boolean;
  imodelClientContext?: string;
  // (undocumented)
  iModelDb: IModelDb | undefined;
  iModelId: GuidString;
  isOpen: boolean;
  isStandalone: boolean;
  // WARNING: The type "IModelJsNative.DgnDb" needs to be exported by the package (e.g. added to index.ts)
  nativeDb: IModelJsNative.DgnDb;
  readonly onBeforeClose: BeEvent<() => void>;
  readonly onBeforeVersionUpdate: BeEvent<() => void>;
  readonly onChangesetApplied: BeEvent<() => void>;
  openParams?: OpenParams;
  pathname: string;
  reversedChangeSetId?: string;
  reversedChangeSetIndex?: number;
  userId?: string;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class BriefcaseId {
  constructor(value?: number);
  // (undocumented)
  static readonly Illegal: number;
  // (undocumented)
  static readonly Master: number;
  // (undocumented)
  static readonly Standalone: number;
  // (undocumented)
  toString(): string;
  // (undocumented)
  readonly value: number;
}

// @public
class BriefcaseManager {
  static applyStandaloneChangeSets(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): ChangeSetStatus;
  // (undocumented)
  static readonly cacheDir: string;
  static close(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, keepBriefcase: KeepBriefcase): Promise<void>;
  static closeStandalone(briefcase: BriefcaseEntry): void;
  static readonly connectClient: ConnectClient;
  static create(requestContext: AuthorizedClientRequestContext, contextId: string, iModelName: string, args: CreateIModelProps): Promise<string>;
  static createStandalone(fileName: string, args: CreateIModelProps): BriefcaseEntry;
  static createStandaloneChangeSet(briefcase: BriefcaseEntry): ChangeSetToken;
  // (undocumented)
  static deleteAllBriefcases(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<void[] | undefined>;
  static deleteClosed(requestContext: AuthorizedClientRequestContext): Promise<void>;
  static downloadChangeSets(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, fromChangeSetId: string, toChangeSetId: string): Promise<ChangeSet[]>;
  static dumpChangeSet(briefcase: BriefcaseEntry, changeSetToken: ChangeSetToken): void;
  static findBriefcaseByToken(iModelToken: IModelToken): BriefcaseEntry | undefined;
  // (undocumented)
  static getChangeCachePathName(iModelId: GuidString): string;
  // (undocumented)
  static getChangedElementsPathName(iModelId: GuidString): string;
  // (undocumented)
  static getChangeSetsPath(iModelId: GuidString): string;
  static imodelClient: IModelClient;
  static open(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: GuidString, openParams: OpenParams, version: IModelVersion): Promise<BriefcaseEntry>;
  static openStandalone(pathname: string, openMode: OpenMode, enableTransactions: boolean): BriefcaseEntry;
  static pullAndMergeChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, mergeToVersion?: IModelVersion): Promise<void>;
  static purgeCache(requestContext: AuthorizedClientRequestContext): Promise<void>;
  static pushChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks?: boolean): Promise<void>;
  // (undocumented)
  static reinstateChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, reinstateToVersion?: IModelVersion): Promise<void>;
  // (undocumented)
  static reverseChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, reverseToVersion: IModelVersion): Promise<void>;
}

// @public
class CachedECSqlStatement {
  constructor(stmt: ECSqlStatement);
  // (undocumented)
  statement: ECSqlStatement;
  // (undocumented)
  useCount: number;
}

// @public
class CachedSqliteStatement {
  constructor(stmt: SqliteStatement);
  // (undocumented)
  statement: SqliteStatement;
  // (undocumented)
  useCount: number;
}

// @public (undocumented)
class Callout extends DetailingSymbol, implements CalloutProps {
  constructor(props: CalloutProps, iModel: IModelDb);
}

// @public
class Category extends DefinitionElement, implements CategoryProps {
  constructor(props: CategoryProps, iModel: IModelDb);
  myDefaultSubCategoryId(): Id64String;
  // (undocumented)
  rank: Rank;
  setDefaultAppearance(props: SubCategoryAppearance.Props): void;
  // (undocumented)
  toJSON(): CategoryProps;
}

// @public
class CategoryOwnsSubCategories extends ElementOwnsChildElements {
  constructor(parentId: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class CategorySelector extends DefinitionElement, implements CategorySelectorProps {
  constructor(props: CategorySelectorProps, iModel: IModelDb);
  categories: string[];
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, categories: Id64Array): CategorySelector;
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, categories: Id64Array): Id64String;
  // (undocumented)
  toJSON(): CategorySelectorProps;
}

// @public
class ChangedElementsDb implements IDisposable {
  constructor();
  closeDb(): void;
  static createDb(briefcase: IModelDb, pathName: string): ChangedElementsDb;
  // (undocumented)
  dispose(): void;
  getChangedElements(startChangesetId: string, endChangesetId: string): ChangedElements | undefined;
  readonly isOpen: boolean;
  isProcessed(changesetId: string): boolean;
  // WARNING: The type "IModelJsNative.ChangedElementsECDb" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly nativeDb: IModelJsNative.ChangedElementsECDb;
  static openDb(pathName: string, openMode?: ECDbOpenMode): ChangedElementsDb;
  processChangesets(requestContext: AuthorizedClientRequestContext, briefcase: IModelDb, rulesetId: string, startChangesetId: string, endChangesetId: string, filterSpatial?: boolean): Promise<DbResult>;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class ChangeSetToken {
  constructor(id: string, parentId: string, index: number, pathname: string, containsSchemaChanges: boolean, pushDate?: string | undefined);
  // (undocumented)
  containsSchemaChanges: boolean;
  // (undocumented)
  id: string;
  // (undocumented)
  index: number;
  // (undocumented)
  parentId: string;
  // (undocumented)
  pathname: string;
  // (undocumented)
  pushDate?: string | undefined;
}

// @public
interface ChangeSummary {
  // (undocumented)
  changeSet: {
    description: string;
    parentWsgId: GuidString;
    pushDate: string;
    userCreated: GuidString;
    wsgId: GuidString;
  }
  // (undocumented)
  id: Id64String;
}

// @public (undocumented)
class ChangeSummaryExtractContext {
  constructor(iModel: IModelDb);
  // (undocumented)
  readonly iModel: IModelDb;
  // (undocumented)
  readonly iModelId: GuidString;
}

// @public
interface ChangeSummaryExtractOptions {
  currentVersionOnly?: boolean;
  startVersion?: IModelVersion;
}

// @public
class ChangeSummaryManager {
  static attachChangeCache(iModel: IModelDb): void;
  static buildPropertyValueChangesECSql(iModel: IModelDb, instanceChangeInfo: {
          id: Id64String;
          summaryId: Id64String;
          changedInstance: {
              id: Id64String;
              className: string;
          };
      }, changedValueState: ChangedValueState, changedPropertyNames?: string[]): string;
  static detachChangeCache(iModel: IModelDb): void;
  // (undocumented)
  static downloadChangeSets(requestContext: AuthorizedClientRequestContext, ctx: ChangeSummaryExtractContext, startChangeSetId: GuidString, endChangeSetId: GuidString): Promise<ChangeSet[]>;
  static extractChangeSummaries(requestContext: AuthorizedClientRequestContext, iModel: IModelDb, options?: ChangeSummaryExtractOptions): Promise<Id64String[]>;
  static getChangedPropertyValueNames(iModel: IModelDb, instanceChangeId: Id64String): string[];
  static isChangeCacheAttached(iModel: IModelDb): boolean;
  static queryChangeSummary(iModel: IModelDb, changeSummaryId: Id64String): ChangeSummary;
  static queryInstanceChange(iModel: IModelDb, instanceChangeId: Id64String): InstanceChange;
}

// @public
class ClassRegistry {
  static findRegisteredClass(classFullName: string): typeof Entity | undefined;
  static getClass(fullName: string, iModel: IModelDb): typeof Entity;
  // (undocumented)
  static getRegisteredSchema(domainName: string): Schema | undefined;
  // (undocumented)
  static getSchemaBaseClass(): typeof Schema;
  // (undocumented)
  static isNotFoundError(err: any): boolean;
  // (undocumented)
  static makeMetaDataNotFoundError(className: string): IModelError;
  // (undocumented)
  static register(entityClass: typeof Entity, schema: Schema): void;
  static registerModule(moduleObj: any, schema: Schema): void;
  // (undocumented)
  static registerSchema(schema: Schema): void;
}

// @public
class CodeSpecs {
  constructor(imodel: IModelDb);
  getById(codeSpecId: Id64String): CodeSpec;
  getByName(name: string): CodeSpec;
  hasId(codeSpecId: Id64String): boolean;
  hasName(name: string): boolean;
  insert(codeSpec: CodeSpec): Id64String;
  load(id: Id64String): CodeSpec;
  queryId(name: string): Id64String;
}

// @public (undocumented)
class ConcurrencyControl {
}

// @public
class DefinitionElement extends InformationContentElement, implements DefinitionElementProps {
  constructor(props: ElementProps, iModel: IModelDb);
  isPrivate: boolean;
  // (undocumented)
  toJSON(): DefinitionElementProps;
}

// @public
class DefinitionModel extends InformationModel {
  static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String;
}

// @public
class DefinitionPartition extends InformationPartitionElement {
}

// @public (undocumented)
class DetailCallout extends Callout {
  constructor(props: CalloutProps, iModel: IModelDb);
}

// @public (undocumented)
class DetailingSymbol extends GraphicalElement2d {
  constructor(props: GeometricElement2dProps, iModel: IModelDb);
}

// @public
class DictionaryModel extends DefinitionModel {
}

// @public
class DisplayStyle extends DefinitionElement, implements DisplayStyleProps {
  protected constructor(props: DisplayStyleProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  // (undocumented)
  readonly settings: DisplayStyleSettings;
}

// @public
class DisplayStyle2d extends DisplayStyle {
  constructor(props: DisplayStyleProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string): DisplayStyle2d;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string): Id64String;
  // (undocumented)
  readonly settings: DisplayStyleSettings;
}

// @public
class DisplayStyle3d extends DisplayStyle {
  constructor(props: DisplayStyleProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, options?: DisplayStyleCreationOptions): DisplayStyle3d;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, options?: DisplayStyleCreationOptions): Id64String;
  // (undocumented)
  readonly settings: DisplayStyle3dSettings;
}

// @public
interface DisplayStyleCreationOptions {
  // (undocumented)
  analysisStyle?: AnalysisStyleProps;
  // (undocumented)
  backgroundColor?: ColorDef;
  // (undocumented)
  contextRealityModels?: ContextRealityModelProps[];
  // (undocumented)
  scheduleScript?: object;
  // (undocumented)
  viewFlags?: ViewFlags;
}

// @public
class Document extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class DocumentCarrier extends InformationCarrierElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class DocumentListModel extends InformationModel {
  static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String;
}

// @public
class DocumentPartition extends InformationPartitionElement {
}

// @public
class Drawing extends Document {
  constructor(props: ElementProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  static insert(iModelDb: IModelDb, documentListModelId: Id64String, name: string): Id64String;
}

// @public
class DrawingCategory extends Category {
  constructor(opts: ElementProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string): DrawingCategory;
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  static getCodeSpecName(): string;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, defaultAppearance: SubCategoryAppearance.Props): Id64String;
  static queryCategoryIdByName(iModel: IModelDb, scopeModelId: Id64String, categoryName: string): Id64String | undefined;
}

// @public
class DrawingGraphic extends GraphicalElement2d {
  constructor(props: GeometricElement2dProps, iModel: IModelDb);
}

// @public
class DrawingGraphicRepresentsElement extends ElementRefersToElements {
}

// @public
class DrawingGraphicRepresentsFunctionalElement extends DrawingGraphicRepresentsElement {
}

// @public
class DrawingModel extends GraphicalModel2d {
}

// @public
class DrawingViewDefinition extends ViewDefinition2d {
  constructor(props: ViewDefinition2dProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, baseModelId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range2d): DrawingViewDefinition;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, baseModelId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range2d): Id64String;
}

// @public
class DriverBundleElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class ECDb implements IDisposable, PageableECSql {
  constructor();
  abandonChanges(): void;
  clearStatementCache(): void;
  closeDb(): void;
  createDb(pathName: string): void;
  dispose(): void;
  getCachedStatementCount(): number;
  importSchema(pathName: string): void;
  readonly isOpen: boolean;
  // WARNING: The type "IModelJsNative.ECDb" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly nativeDb: IModelJsNative.ECDb;
  openDb(pathName: string, openMode?: ECDbOpenMode): void;
  prepareSqliteStatement(sql: string): SqliteStatement;
  prepareStatement(ecsql: string): ECSqlStatement;
  query(ecsql: string, bindings?: any[] | object, options?: PageOptions): AsyncIterableIterator<any>;
  queryPage(ecsql: string, bindings?: any[] | object, options?: PageOptions): Promise<any[]>;
  queryRowCount(ecsql: string, bindings?: any[] | object): Promise<number>;
  saveChanges(changeSetName?: string): void;
  withPreparedSqliteStatement<T>(sql: string, cb: (stmt: SqliteStatement) => T): T;
  withPreparedStatement<T>(ecsql: string, cb: (stmt: ECSqlStatement) => T): T;
}

// @public
enum ECDbOpenMode {
  FileUpgrade = 2,
  // (undocumented)
  Readonly = 0,
  // (undocumented)
  Readwrite = 1
}

// @public
interface ECEnumValue {
  // (undocumented)
  key: string;
  // (undocumented)
  name: string;
  // (undocumented)
  schema: string;
  // (undocumented)
  value: number | string;
}

// @public (undocumented)
class ECSchemaXmlContext {
  constructor();
  // (undocumented)
  addSchemaPath(searchPath: string): void;
  // (undocumented)
  readSchemaFromXmlFile(filePath: string): any;
  // WARNING: The type "IModelJsNative.ECSchemaXmlContext.SchemaLocaterCallback" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  setSchemaLocater(locater: IModelJsNative.ECSchemaXmlContext.SchemaLocaterCallback): void;
}

// @public
class ECSqlBinder {
  // WARNING: The type "IModelJsNative.ECSqlBinder" needs to be exported by the package (e.g. added to index.ts)
  constructor(binder: IModelJsNative.ECSqlBinder);
  addArrayElement(): ECSqlBinder;
  bind(val: any): void;
  bindArray(val: any[]): void;
  bindBlob(blob: string | Uint8Array | ArrayBuffer | SharedArrayBuffer): void;
  bindBoolean(val: boolean): void;
  bindDateTime(isoDateTimeString: string): void;
  bindDouble(val: number): void;
  bindGuid(val: GuidString): void;
  bindId(val: Id64String): void;
  bindInteger(val: number | string): void;
  bindMember(memberName: string): ECSqlBinder;
  bindNavigation(val: NavigationBindingValue): void;
  bindNull(): void;
  bindPoint2d(val: XAndY): void;
  bindPoint3d(val: XYAndZ): void;
  bindRange3d(val: LowAndHighXYZ): void;
  bindString(val: string): void;
  bindStruct(val: object): void;
}

// @public
interface ECSqlColumnInfo {
  getAccessString(): string;
  getPropertyName(): string;
  getRootClassAlias(): string;
  getRootClassName(): string;
  getRootClassTableSpace(): string;
  getType(): ECSqlValueType;
  isEnum(): boolean;
  isGeneratedProperty(): boolean;
  isSystemProperty(): boolean;
}

// @public
class ECSqlInsertResult {
  constructor(status: DbResult, id?: string | undefined);
  // (undocumented)
  id?: string | undefined;
  // (undocumented)
  status: DbResult;
}

// @public
class ECSqlStatement implements IterableIterator<any>, IDisposable {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  [Symbol.iterator](): IterableIterator<any>;
  bindArray(parameter: number | string, val: any[]): void;
  bindBlob(parameter: number | string, blob: string | Uint8Array | ArrayBuffer | SharedArrayBuffer): void;
  bindBoolean(parameter: number | string, val: boolean): void;
  bindDateTime(parameter: number | string, isoDateTimeString: string): void;
  bindDouble(parameter: number | string, val: number): void;
  bindGuid(parameter: number | string, val: GuidString): void;
  bindId(parameter: number | string, val: Id64String): void;
  bindInteger(parameter: number | string, val: number | string): void;
  bindNavigation(parameter: number | string, val: NavigationBindingValue): void;
  bindNull(parameter: number | string): void;
  bindPoint2d(parameter: number | string, val: XAndY): void;
  bindPoint3d(parameter: number | string, val: XYAndZ): void;
  bindRange3d(parameter: number | string, val: LowAndHighXYZ): void;
  bindString(parameter: number | string, val: string): void;
  bindStruct(parameter: number | string, val: object): void;
  bindValue(parameter: number | string, val: any): void;
  bindValues(values: any[] | object): void;
  clearBindings(): void;
  dispose(): void;
  getBinder(parameter: string | number): ECSqlBinder;
  getColumnCount(): number;
  getRow(): any;
  getValue(columnIx: number): ECSqlValue;
  readonly isPrepared: boolean;
  readonly isShared: boolean;
  next(): IteratorResult<any>;
  // WARNING: The type "IModelJsNative.DgnDb" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "IModelJsNative.ECDb" needs to be exported by the package (e.g. added to index.ts)
  prepare(db: IModelJsNative.DgnDb | IModelJsNative.ECDb, ecsql: string): void;
  reset(): void;
  setIsShared(b: boolean): void;
  step(): DbResult;
  stepForInsert(): ECSqlInsertResult;
}

// @public
class ECSqlStatementCache {
  constructor(maxCount?: number);
  // (undocumented)
  add(str: string, stmt: ECSqlStatement): void;
  // (undocumented)
  clear(): void;
  // (undocumented)
  find(str: string): CachedECSqlStatement | undefined;
  // (undocumented)
  getCount(): number;
  // (undocumented)
  readonly maxCount: number;
  // (undocumented)
  release(stmt: ECSqlStatement): void;
  // (undocumented)
  removeUnusedStatementsIfNecessary(): void;
  // (undocumented)
  replace(str: string, stmt: ECSqlStatement): void;
}

// @public
class ECSqlValue {
  // WARNING: The type "IModelJsNative.ECSqlValue" needs to be exported by the package (e.g. added to index.ts)
  constructor(val: IModelJsNative.ECSqlValue);
  readonly columnInfo: ECSqlColumnInfo;
  getArray(): any[];
  getArrayIterator(): ECSqlValueIterator;
  getBlob(): Uint8Array;
  getBoolean(): boolean;
  getClassNameForClassId(): string;
  getDateTime(): string;
  getDouble(): number;
  getEnum(): ECEnumValue[] | undefined;
  getGeometry(): any;
  getGuid(): GuidString;
  getId(): Id64String;
  getInteger(): number;
  getNavigation(): NavigationValue;
  getString(): string;
  getStruct(): any;
  getStructIterator(): ECSqlValueIterator;
  getXAndY(): XAndY;
  getXYAndZ(): XYAndZ;
  readonly isNull: boolean;
  readonly value: any;
}

// @public
class ECSqlValueIterator implements IterableIterator<ECSqlValue> {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  // (undocumented)
  [Symbol.iterator](): IterableIterator<ECSqlValue>;
  // WARNING: The type "IModelJsNative.ECSqlValueIterator" needs to be exported by the package (e.g. added to index.ts)
  constructor(it: IModelJsNative.ECSqlValueIterator);
  // (undocumented)
  next(): IteratorResult<ECSqlValue>;
}

// @public
class Element extends Entity, implements ElementProps {
  constructor(props: ElementProps, iModel: IModelDb);
  buildConcurrencyControlRequest(opcode: DbOpcode): void;
  readonly code: Code;
  delete(): void;
  federationGuid?: GuidString;
  getClassMetaData(): EntityMetaData | undefined;
  getDisplayLabel(): string;
  getJsonProperty(nameSpace: string): any;
  getToolTipMessage(): string[];
  getUserProperties(namespace: string): any;
  insert(): string;
  readonly jsonProperties: {
    [key: string]: any;
  }
  readonly model: Id64String;
  // (undocumented)
  static onAllInputsHandled(_id: Id64String, _iModel: IModelDb): void;
  // (undocumented)
  static onBeforeOutputsHandled(_id: Id64String, _iModel: IModelDb): void;
  // (undocumented)
  static onDelete(_props: ElementProps, _iModel: IModelDb): IModelStatus;
  // (undocumented)
  static onDeleted(_props: ElementProps, _iModel: IModelDb): void;
  // (undocumented)
  static onInsert(_props: ElementProps, _iModel: IModelDb): IModelStatus;
  // (undocumented)
  static onInserted(_props: ElementProps, _iModel: IModelDb): void;
  // (undocumented)
  static onUpdate(_props: ElementProps, _iModel: IModelDb): IModelStatus;
  // (undocumented)
  static onUpdated(_props: ElementProps, _iModel: IModelDb): void;
  parent?: RelatedElement;
  removeUserProperties(nameSpace: string): void;
  // (undocumented)
  setJsonProperty(nameSpace: string, value: any): void;
  setUserProperties(nameSpace: string, value: any): void;
  toJSON(): ElementProps;
  update(): void;
  userLabel?: string;
}

// @public
class ElementAspect extends Entity, implements ElementAspectProps {
  constructor(props: ElementAspectProps, iModel: IModelDb);
  // (undocumented)
  element: RelatedElement;
  // (undocumented)
  toJSON(): ElementAspectProps;
}

// @public
class ElementDrivesElement extends Relationship, implements ElementDrivesElementProps {
  constructor(props: ElementDrivesElementProps, iModel: IModelDb);
  // (undocumented)
  static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String, priority?: number): T;
  // (undocumented)
  priority: number;
  // (undocumented)
  status: number;
}

// @public
interface ElementDrivesElementProps extends RelationshipProps {
  // (undocumented)
  priority: number;
  // (undocumented)
  status: number;
}

// @public
class ElementEncapsulatesElements extends ElementOwnsChildElements {
  constructor(parentId: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class ElementGroupsMembers extends ElementRefersToElements {
  constructor(props: ElementGroupsMembersProps, iModel: IModelDb);
  // (undocumented)
  static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String, memberPriority?: number): T;
  // (undocumented)
  memberPriority: number;
}

// @public
interface ElementGroupsMembersProps extends RelationshipProps {
  // (undocumented)
  memberPriority: number;
}

// @public
class ElementMultiAspect extends ElementAspect {
}

// @public
class ElementOwnsChildElements extends RelatedElement {
  constructor(parentId: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public (undocumented)
class ElementPropertyFormatter {
  constructor(iModel: IModelDb);
  formatProperties(elem: Element): any;
}

// @public
class ElementRefersToElements extends Relationship {
  static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String): T;
  static insert<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String): Id64String;
}

// @public
class ElementUniqueAspect extends ElementAspect {
}

// @public (undocumented)
class ElevationCallout extends Callout {
  constructor(props: CalloutProps, iModel: IModelDb);
}

// @public
class EmbeddedFileLink extends LinkElement {
}

// @public
class Entity implements EntityProps {
  constructor(props: EntityProps, iModel: IModelDb);
  // (undocumented)
  [propName: string]: any;
  buildConcurrencyControlRequest(_opcode: DbOpcode): void;
  static readonly classFullName: string;
  readonly className: string;
  clone(): this;
  forEachProperty(func: PropertyCallback, includeCustom?: boolean): void;
  id: Id64String;
  iModel: IModelDb;
  static schema: Schema;
  readonly schemaName: string;
  // (undocumented)
  toJSON(): EntityProps;
}

// @public
enum ExclusiveAccessOption {
  CreateNewBriefcase = 1,
  TryReuseOpenBriefcase = 2
}

// @beta
interface ExportGraphicsInfo {
  color: number;
  elementId: Id64String;
  mesh: ExportGraphicsMesh;
}

// @beta
interface ExportGraphicsMesh {
  indices: Int32Array;
  normals: Float32Array;
  params: Float32Array;
  points: Float64Array;
}

// @beta
interface ExportGraphicsProps {
  angleTol?: number;
  chordTol?: number;
  elementIdArray: Id64Array;
  maxEdgeLength?: number;
  onGraphics: ExportGraphicsFunction;
}

// @public (undocumented)
class Functional extends Schema {
  // (undocumented)
  static importSchema(requestContext: AuthorizedClientRequestContext | ClientRequestContext, iModelDb: IModelDb): Promise<void>;
  // (undocumented)
  static registerSchema(): void;
}

// @public
class FunctionalBreakdownElement extends FunctionalElement {
  constructor(props: FunctionalElementProps, iModel: IModelDb);
}

// @public
class FunctionalComponentElement extends FunctionalElement {
  constructor(props: FunctionalElementProps, iModel: IModelDb);
}

// @public (undocumented)
class FunctionalComposite extends FunctionalBreakdownElement {
  constructor(props: FunctionalElementProps, iModel: IModelDb);
}

// @public
class FunctionalElement extends RoleElement, implements FunctionalElementProps {
  constructor(props: FunctionalElementProps, iModel: IModelDb);
}

// @public
class FunctionalElementIsOfType extends RelatedElement {
  constructor(id: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class FunctionalModel extends RoleModel {
  constructor(props: ModelProps, iModel: IModelDb);
  static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String;
}

// @public
class FunctionalPartition extends InformationPartitionElement {
  constructor(props: InformationPartitionElementProps, iModel: IModelDb);
}

// @public
class FunctionalType extends TypeDefinitionElement {
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb);
}

// @public (undocumented)
class Generic extends Schema {
  // (undocumented)
  static registerSchema(): void;
}

// @public
class GeometricElement extends Element, implements GeometricElementProps {
  constructor(props: GeometricElementProps, iModel: IModelDb);
  // (undocumented)
  calculateRange3d(): AxisAlignedBox3d;
  category: Id64String;
  geom?: GeometryStreamProps;
  getPlacementTransform(): Transform;
  is2d(): this is GeometricElement2d;
  is3d(): this is GeometricElement3d;
  toJSON(): GeometricElementProps;
}

// @public
class GeometricElement2d extends GeometricElement, implements GeometricElement2dProps {
  constructor(props: GeometricElement2dProps, iModel: IModelDb);
  // (undocumented)
  placement: Placement2d;
  // (undocumented)
  toJSON(): GeometricElement2dProps;
  // (undocumented)
  typeDefinition?: TypeDefinition;
}

// @public
class GeometricElement3d extends GeometricElement, implements GeometricElement3dProps {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
  // (undocumented)
  placement: Placement3d;
  // (undocumented)
  toJSON(): GeometricElement3dProps;
  // (undocumented)
  typeDefinition?: TypeDefinition;
}

// @public
class GeometricModel extends Model {
  queryExtents(): AxisAlignedBox3d;
}

// @public
class GeometricModel2d extends GeometricModel, implements GeometricModel2dProps {
  // (undocumented)
  globalOrigin?: Point2d;
}

// @public
class GeometricModel3d extends GeometricModel {
}

// @public
class GeometryPart extends DefinitionElement, implements GeometryPartProps {
  constructor(props: GeometryPartProps, iModel: IModelDb);
  // (undocumented)
  bbox: ElementAlignedBox3d;
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  // (undocumented)
  geom?: GeometryStreamProps;
  toJSON(): GeometryPartProps;
}

// @public (undocumented)
class Graphic3d extends GraphicalElement3d {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public
class GraphicalElement2d extends GeometricElement2d {
  constructor(props: GeometricElement2dProps, iModel: IModelDb);
}

// @public
class GraphicalElement2dIsOfType extends RelatedElement {
  constructor(id: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class GraphicalElement3d extends GeometricElement3d {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public
class GraphicalModel2d extends GeometricModel2d {
}

// @public
class GraphicalType2d extends TypeDefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
}

// @public (undocumented)
class Group extends GroupInformationElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class GroupInformationElement extends InformationReferenceElement {
}

// @public
class GroupInformationModel extends InformationModel {
}

// @public
class GroupInformationPartition extends InformationPartitionElement {
}

// @public (undocumented)
class GroupModel extends GroupInformationModel {
  constructor(props: ModelProps, iModel: IModelDb);
}

// @public (undocumented)
class IModelDb {
}

// @public
class IModelHost {
  static readonly appAssetsDir: string | undefined;
  static applicationId: string;
  static applicationVersion: string;
  static authorizationClient: IAuthorizationClient | undefined;
  // (undocumented)
  static backendVersion: string;
  // (undocumented)
  static configuration?: IModelHostConfiguration;
  static getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
  // (undocumented)
  static loadNative(region: number, dir?: string): void;
  static readonly onAfterStartup: BeEvent<() => void>;
  static readonly onBeforeShutdown: BeEvent<() => void>;
  // (undocumented)
  static readonly platform: typeof IModelJsNative;
  static sessionId: GuidString;
  static shutdown(): void;
  static startup(configuration?: IModelHostConfiguration): void;
  static readonly tileContentRequestTimeout: number;
  static readonly tileTreeRequestTimeout: number;
  static readonly useTileContentThreadPool: boolean;
}

// @public
class IModelHostConfiguration {
  appAssetsDir?: string;
  briefcaseCacheDir: string;
  static defaultTileRequestTimeout: number;
  imodelClient?: IModelClient;
  nativePlatform?: any;
  tileContentRequestTimeout: number;
  tileTreeRequestTimeout: number;
  useTileContentThreadPool: boolean;
}

// @public (undocumented)
class IModelImporter {
  constructor(sourceDb: IModelDb, targetDb: IModelDb);
  // (undocumented)
  protected _excludedCodeSpecIds: Set<string>;
  // (undocumented)
  protected _excludedCodeSpecNames: Set<string>;
  // (undocumented)
  protected _excludedElementClassNames: Set<string>;
  // (undocumented)
  protected _excludedElementIds: Set<string>;
  // (undocumented)
  addCodeSpecId(sourceId: Id64String, targetId: Id64String): void;
  // (undocumented)
  addElementId(sourceId: Id64String, targetId: Id64String): void;
  // (undocumented)
  dispose(): void;
  // (undocumented)
  excludeCodeSpec(codeSpecName: string): void;
  // (undocumented)
  excludeElementClass(classFullName: string): void;
  // (undocumented)
  excludeElementId(elementId: Id64String): void;
  // (undocumented)
  excludeSubject(subjectPath: string): void;
  // (undocumented)
  findCodeSpecId(sourceId: Id64String): Id64String;
  // (undocumented)
  findElementId(sourceId: Id64String): Id64String;
  // (undocumented)
  import(): void;
  // (undocumented)
  importCodeSpec(sourceId: Id64String): Id64String;
  // (undocumented)
  importCodeSpecs(): void;
  // (undocumented)
  importElement(sourceElementId: Id64String): Id64String;
  // (undocumented)
  importFonts(): void;
  // (undocumented)
  importModel(sourceModeledElementId: Id64String): void;
  // (undocumented)
  importModelContents(modelId: Id64String): void;
  // (undocumented)
  importModels(modeledElementClass: string): void;
  // (undocumented)
  importRelationships(): void;
  // (undocumented)
  static resolveSubjectId(iModelDb: IModelDb, subjectPath: string): Id64String | undefined;
}

// @public
class IModelJsFs {
  static appendFileSync(path: string, str: string): void;
  static copySync(src: string, dest: string, opts?: any): void;
  static existsSync(path: string): boolean;
  static lstatSync(path: string): IModelJsFsStats | undefined;
  static mkdirSync(path: string): void;
  static readdirSync(path: string): string[];
  // (undocumented)
  static readFileSync(path: string): string | Buffer;
  static removeSync(path: string): void;
  static rmdirSync(path: string): void;
  static unlinkSync(path: string): void;
  static writeFileSync(path: string, str: string, wflag?: string): void;
}

// @public
class IModelJsFsStats {
  constructor(size: number, atimeMs: number, mtimeMs: number, birthtimeMs: number, isDirectory: boolean, isFile: boolean, isSocket: boolean, isSymbolicLink: boolean, isReadOnly: boolean);
  // (undocumented)
  atimeMs: number;
  // (undocumented)
  birthtimeMs: number;
  // (undocumented)
  isDirectory: boolean;
  // (undocumented)
  isFile: boolean;
  // (undocumented)
  isReadOnly: boolean;
  // (undocumented)
  isSocket: boolean;
  // (undocumented)
  isSymbolicLink: boolean;
  // (undocumented)
  mtimeMs: number;
  // (undocumented)
  size: number;
}

// WARNING: Unsupported export: version
// WARNING: Unsupported export: logger
// WARNING: Unsupported export: TxnIdString
// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
module IModelJsNative {
  interface BriefcaseManagerOnConflictPolicy {
    deleteVsUpdate: number;
    updateVsDelete: number;
    updateVsUpdate: number;
  }

  // (undocumented)
  class BriefcaseManagerResourcesRequest {
    // (undocumented)
    isEmpty(): boolean;
    // (undocumented)
    reset(): void;
    // (undocumented)
    toJSON(): string;
  }

  // (undocumented)
  class ChangedElementsECDb implements IDisposable {
    constructor();
    // (undocumented)
    closeDb(): void;
    // WARNING: The type "DgnDb" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createDb(db: DgnDb, dbName: string): DbResult;
    // (undocumented)
    dispose(): void;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getChangedElements(startChangesetId: string, endChangesetId: string): ErrorStatusOrResult<IModelStatus, ChangedElements>;
    // (undocumented)
    isOpen(): boolean;
    // (undocumented)
    isProcessed(changesetId: string): boolean;
    // (undocumented)
    openDb(dbName: string, mode: OpenMode, upgradeProfiles?: boolean): DbResult;
    // WARNING: The type "DgnDb" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    processChangesets(db: DgnDb, changesets: string, rulesetId: string, filterSpatial: boolean): DbResult;
  }

  class DgnDb {
    constructor();
    // (undocumented)
    abandonChanges(): DbResult;
    // (undocumented)
    abandonCreateChangeSet(): void;
    // (undocumented)
    addPendingChangeSet(changeSetId: string): DbResult;
    // WARNING: The type "BriefcaseManagerResourcesRequest" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "BriefcaseManagerResourcesRequest" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    appendBriefcaseManagerResourcesRequest(reqOut: BriefcaseManagerResourcesRequest, reqIn: BriefcaseManagerResourcesRequest): void;
    // (undocumented)
    applyChangeSets(changeSets: string, processOptions: ChangeSetApplyOption): ChangeSetStatus;
    // (undocumented)
    attachChangeCache(changeCachePath: string): DbResult;
    // (undocumented)
    beginMultiTxnOperation(): DbResult;
    // (undocumented)
    briefcaseManagerEndBulkOperation(): RepositoryStatus;
    // (undocumented)
    briefcaseManagerStartBulkOperation(): RepositoryStatus;
    // WARNING: The type "BriefcaseManagerResourcesRequest" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    buildBriefcaseManagerResourcesRequestForElement(req: BriefcaseManagerResourcesRequest, elemId: string, opcode: DbOpcode): RepositoryStatus;
    // WARNING: The type "BriefcaseManagerResourcesRequest" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    buildBriefcaseManagerResourcesRequestForLinkTableRelationship(req: BriefcaseManagerResourcesRequest, relKey: string, opcode: DbOpcode): RepositoryStatus;
    // WARNING: The type "BriefcaseManagerResourcesRequest" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    buildBriefcaseManagerResourcesRequestForModel(req: BriefcaseManagerResourcesRequest, modelId: string, opcode: DbOpcode): RepositoryStatus;
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    cancelTo(txnId: TxnIdString): IModelStatus;
    // (undocumented)
    closeIModel(): void;
    // WARNING: The type "ECDb" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createChangeCache(changeCacheFile: ECDb, changeCachePath: string): DbResult;
    // (undocumented)
    createIModel(accessToken: string, appVersion: string, projectId: GuidString, fileName: string, props: string): DbResult;
    // (undocumented)
    createStandaloneIModel(fileName: string, props: string): DbResult;
    // (undocumented)
    deleteElement(elemIdJson: string): IModelStatus;
    // (undocumented)
    deleteElementAspect(aspectIdJson: string): IModelStatus;
    // (undocumented)
    deleteLinkTableRelationship(props: string): DbResult;
    // (undocumented)
    deleteModel(modelIdJson: string): IModelStatus;
    // (undocumented)
    detachChangeCache(): number;
    // (undocumented)
    dumpChangeSet(changeSet: string): void;
    // (undocumented)
    embedFont(fontProps: string): string;
    // (undocumented)
    enableTxnTesting(): void;
    // (undocumented)
    endMultiTxnOperation(): DbResult;
    // (undocumented)
    executeTest(testName: string, params: string): string;
    // (undocumented)
    exportGraphics(exportProps: ExportGraphicsProps): DbResult;
    // WARNING: The type "BriefcaseManagerResourcesRequest" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "BriefcaseManagerResourcesRequest" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    extractBriefcaseManagerResourcesRequest(reqOut: BriefcaseManagerResourcesRequest, reqIn: BriefcaseManagerResourcesRequest, locks: boolean, codes: boolean): void;
    // WARNING: The type "BriefcaseManagerResourcesRequest" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    extractBulkResourcesRequest(req: BriefcaseManagerResourcesRequest, locks: boolean, codes: boolean): void;
    // WARNING: The type "ECDb" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    extractChangeSummary(changeCacheFile: ECDb, changesetFilePath: string): ErrorStatusOrResult<DbResult, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    extractCodes(): ErrorStatusOrResult<DbResult, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    extractCodesFromFile(changeSets: string): ErrorStatusOrResult<DbResult, string>;
    // (undocumented)
    finishCreateChangeSet(): ChangeSetStatus;
    // (undocumented)
    static getAssetsDir(): string;
    // (undocumented)
    getBriefcaseId(): number;
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getCurrentTxnId(): TxnIdString;
    // (undocumented)
    getDbGuid(): GuidString;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getECClassMetaData(schema: string, className: string): ErrorStatusOrResult<IModelStatus, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getElement(opts: string): ErrorStatusOrResult<IModelStatus, ElementProps>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getElementPropertiesForDisplay(id: string): ErrorStatusOrResult<IModelStatus, string>;
    // (undocumented)
    getGeoCoordinatesFromIModelCoordinates(points: string): string;
    // (undocumented)
    getIModelCoordinatesFromGeoCoordinates(points: string): string;
    // (undocumented)
    getIModelProps(): string;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getModel(opts: string): ErrorStatusOrResult<IModelStatus, string>;
    // (undocumented)
    getMultiTxnOperationDepth(): number;
    // (undocumented)
    getParentChangeSetId(): string;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getPendingChangeSets(): ErrorStatusOrResult<DbResult, string>;
    // (undocumented)
    getRedoString(): string;
    // (undocumented)
    getReversedChangeSetId(): string | undefined;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getSchema(name: string): ErrorStatusOrResult<IModelStatus, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getSchemaItem(schemaName: string, itemName: string): ErrorStatusOrResult<IModelStatus, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getTileContent(treeId: string, tileId: string, callback: (result: ErrorStatusOrResult<IModelStatus, Uint8Array>) => void): void;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getTileTree(id: string, callback: (result: ErrorStatusOrResult<IModelStatus, any>) => void): void;
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getTxnDescription(txnId: TxnIdString): string;
    // (undocumented)
    getUndoString(): string;
    // (undocumented)
    hasFatalTxnError(): boolean;
    // (undocumented)
    hasUnsavedChanges(): boolean;
    // (undocumented)
    importFunctionalSchema(): DbResult;
    // (undocumented)
    importSchema(schemaPathname: string): DbResult;
    // (undocumented)
    inBulkOperation(): boolean;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    insertCodeSpec(name: string, specType: number, scopeReq: number): ErrorStatusOrResult<IModelStatus, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    insertElement(elemProps: string): ErrorStatusOrResult<IModelStatus, string>;
    // (undocumented)
    insertElementAspect(aspectProps: string): IModelStatus;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    insertLinkTableRelationship(props: string): ErrorStatusOrResult<DbResult, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    insertModel(modelProps: string): ErrorStatusOrResult<IModelStatus, string>;
    // (undocumented)
    isChangeCacheAttached(): boolean;
    // (undocumented)
    isOpen(): boolean;
    // (undocumented)
    isRedoPossible(): boolean;
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    isTxnIdValid(txnId: TxnIdString): boolean;
    // (undocumented)
    isUndoPossible(): boolean;
    // (undocumented)
    logTxnError(fatal: boolean): void;
    // (undocumented)
    openIModel(accessToken: string, appVersion: string, projectId: GuidString, dbName: string, mode: OpenMode): DbResult;
    // (undocumented)
    openIModelFile(dbName: string, mode: OpenMode): DbResult;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "IModelDb.TileContentState" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    pollTileContent(treeId: string, tileId: string): ErrorStatusOrResult<IModelStatus, IModelDb.TileContentState | Uint8Array>;
    // (undocumented)
    queryFileProperty(props: string, wantString: boolean): string | Uint8Array | undefined;
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    queryFirstTxnId(): TxnIdString;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    queryModelExtents(options: string): ErrorStatusOrResult<IModelStatus, string>;
    // (undocumented)
    queryNextAvailableFileProperty(props: string): number;
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    queryNextTxnId(txnId: TxnIdString): TxnIdString;
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    queryPreviousTxnId(txnId: TxnIdString): TxnIdString;
    // (undocumented)
    readFontMap(): string;
    // (undocumented)
    reinstateTxn(): IModelStatus;
    // (undocumented)
    removePendingChangeSet(changeSetId: string): DbResult;
    // (undocumented)
    reverseAll(): IModelStatus;
    // WARNING: The type "TxnIdString" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    reverseTo(txnId: TxnIdString): IModelStatus;
    // (undocumented)
    reverseTxns(numOperations: number): IModelStatus;
    // (undocumented)
    saveChanges(description?: string): DbResult;
    // (undocumented)
    saveFileProperty(props: string, strValue: string | undefined, blobVal: Uint8Array | undefined): number;
    // (undocumented)
    setAsMaster(guid?: GuidString): DbResult;
    // (undocumented)
    setBriefcaseId(idValue: number): DbResult;
    // WARNING: The type "BriefcaseManagerOnConflictPolicy" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    setBriefcaseManagerOptimisticConcurrencyControlPolicy(conflictPolicy: BriefcaseManagerOnConflictPolicy): RepositoryStatus;
    // (undocumented)
    setBriefcaseManagerPessimisticConcurrencyControlPolicy(): RepositoryStatus;
    // (undocumented)
    setDbGuid(guid: GuidString): DbResult;
    // (undocumented)
    setIModelDb(iModelDb?: IModelDb): void;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    startCreateChangeSet(): ErrorStatusOrResult<ChangeSetStatus, string>;
    // (undocumented)
    updateElement(elemProps: string): IModelStatus;
    // (undocumented)
    updateElementAspect(aspectProps: string): IModelStatus;
    // (undocumented)
    updateIModelProps(props: string): void;
    // (undocumented)
    updateLinkTableRelationship(props: string): DbResult;
    // (undocumented)
    updateModel(modelProps: string): IModelStatus;
    // (undocumented)
    updateProjectExtents(newExtentsJson: string): void;
  }

  // (undocumented)
  class DisableNativeAssertions implements IDisposable {
    constructor();
    // (undocumented)
    dispose(): void;
  }

  // (undocumented)
  class ECDb implements IDisposable {
    constructor();
    // (undocumented)
    abandonChanges(): DbResult;
    // (undocumented)
    closeDb(): void;
    // (undocumented)
    createDb(dbName: string): DbResult;
    // (undocumented)
    dispose(): void;
    // (undocumented)
    importSchema(schemaPathName: string): DbResult;
    // (undocumented)
    isOpen(): boolean;
    // (undocumented)
    openDb(dbName: string, mode: OpenMode, upgradeProfiles?: boolean): DbResult;
    // (undocumented)
    saveChanges(changesetName?: string): DbResult;
  }

  // (undocumented)
  class ECPresentationManager implements IDisposable {
    constructor();
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    addRuleset(serializedRuleset: string): ErrorStatusOrResult<ECPresentationStatus, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    clearRulesets(): ErrorStatusOrResult<ECPresentationStatus, void>;
    // (undocumented)
    dispose(): void;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getRulesets(rulesetId: string): ErrorStatusOrResult<ECPresentationStatus, string>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getRulesetVariableValue(rulesetId: string, variableId: string, type: string): ErrorStatusOrResult<ECPresentationStatus, any>;
    // WARNING: The type "DgnDb" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    handleRequest(db: DgnDb, options: string, callback: (result: ErrorStatusOrResult<ECPresentationStatus, string>) => void): void;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    removeRuleset(rulesetId: string, hash: string): ErrorStatusOrResult<ECPresentationStatus, boolean>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    setRulesetVariableValue(rulesetId: string, variableId: string, type: string, value: any): ErrorStatusOrResult<ECPresentationStatus, void>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    setupLocaleDirectories(directories: string[]): ErrorStatusOrResult<ECPresentationStatus, void>;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECPresentationStatus" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    setupRulesetDirectories(directories: string[]): ErrorStatusOrResult<ECPresentationStatus, void>;
  }

  // (undocumented)
  enum ECPresentationStatus {
    // (undocumented)
    Error = 1,
    // (undocumented)
    InvalidArgument = 2,
    // (undocumented)
    Success = 0
  }

  // (undocumented)
  class ECSchemaXmlContext {
    constructor();
    // (undocumented)
    addSchemaPath(path: string): void;
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readSchemaFromXmlFile(filePath: string): ErrorStatusOrResult<BentleyStatus, string>;
    // WARNING: The type "ECSchemaXmlContext.SchemaLocaterCallback" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    setSchemaLocater(locater: ECSchemaXmlContext.SchemaLocaterCallback): void;
  }

  // (undocumented)
  class ECSqlBinder {
    constructor();
    // WARNING: The type "ECSqlBinder" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    addArrayElement(): ECSqlBinder;
    // (undocumented)
    bindBlob(base64String: string | Uint8Array | ArrayBuffer | SharedArrayBuffer): DbResult;
    // (undocumented)
    bindBoolean(val: boolean): DbResult;
    // (undocumented)
    bindDateTime(isoString: string): DbResult;
    // (undocumented)
    bindDouble(val: number): DbResult;
    // (undocumented)
    bindGuid(guidStr: GuidString): DbResult;
    // (undocumented)
    bindId(hexStr: Id64String): DbResult;
    // (undocumented)
    bindInteger(val: number | string): DbResult;
    // WARNING: The type "ECSqlBinder" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    bindMember(memberName: string): ECSqlBinder;
    // (undocumented)
    bindNavigation(navIdHexStr: Id64String, relClassName?: string, relClassTableSpace?: string): DbResult;
    // (undocumented)
    bindNull(): DbResult;
    // (undocumented)
    bindPoint2d(x: number, y: number): DbResult;
    // (undocumented)
    bindPoint3d(x: number, y: number, z: number): DbResult;
    // (undocumented)
    bindString(val: string): DbResult;
  }

  // (undocumented)
  class ECSqlColumnInfo {
    constructor();
    // (undocumented)
    getAccessString(): string;
    // (undocumented)
    getPropertyName(): string;
    // (undocumented)
    getRootClassAlias(): string;
    // (undocumented)
    getRootClassName(): string;
    // (undocumented)
    getRootClassTableSpace(): string;
    // (undocumented)
    getType(): number;
    // (undocumented)
    isEnum(): boolean;
    // (undocumented)
    isGeneratedProperty(): boolean;
    // (undocumented)
    isSystemProperty(): boolean;
  }

  // (undocumented)
  class ECSqlStatement implements IDisposable {
    constructor();
    // (undocumented)
    clearBindings(): DbResult;
    // (undocumented)
    dispose(): void;
    // WARNING: The type "ECSqlBinder" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getBinder(param: number | string): ECSqlBinder;
    // (undocumented)
    getColumnCount(): number;
    // WARNING: The type "ECSqlValue" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getValue(columnIndex: number): ECSqlValue;
    // WARNING: The type "DgnDb" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECDb" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    prepare(db: DgnDb | ECDb, ecsql: string): StatusCodeWithMessage<DbResult>;
    // (undocumented)
    reset(): DbResult;
    // (undocumented)
    step(): DbResult;
    // (undocumented)
    stepAsync(callback: (result: DbResult) => void): void;
    // (undocumented)
    stepForInsert: {
      id: string;
      status: DbResult;
    }
    // (undocumented)
    stepForInsertAsync(callback: (result: {
                status: DbResult;
                id: string;
            }) => void): void;
  }

  // (undocumented)
  class ECSqlValue {
    constructor();
    // WARNING: The type "ECSqlValueIterator" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getArrayIterator(): ECSqlValueIterator;
    // (undocumented)
    getBlob(): Uint8Array;
    // (undocumented)
    getBoolean(): boolean;
    // (undocumented)
    getClassNameForClassId(): string;
    // WARNING: The type "ECSqlColumnInfo" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getColumnInfo(): ECSqlColumnInfo;
    // (undocumented)
    getDateTime(): string;
    // (undocumented)
    getDouble(): number;
    // (undocumented)
    getEnum(): Array<{
                schema: string;
                name: string;
                key: string;
                value: number | string;
            }> | undefined;
    // (undocumented)
    getGeometry(): string;
    // (undocumented)
    getGuid(): GuidString;
    // (undocumented)
    getId(): Id64String;
    // (undocumented)
    getInt(): number;
    // (undocumented)
    getInt64(): number;
    // (undocumented)
    getNavigation: {
      id: Id64String;
      relClassName?: string;
    }
    // (undocumented)
    getPoint2d: {
      x: number;
      y: number;
    }
    // (undocumented)
    getPoint3d: {
      x: number;
      y: number;
      z: number;
    }
    // (undocumented)
    getString(): string;
    // WARNING: The type "ECSqlValueIterator" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getStructIterator(): ECSqlValueIterator;
    // (undocumented)
    isNull(): boolean;
  }

  // (undocumented)
  class ECSqlValueIterator {
    constructor();
    // WARNING: The type "ECSqlValue" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    getCurrent(): ECSqlValue;
    // (undocumented)
    moveNext(): boolean;
  }

  interface ErrorStatusOrResult<ErrorCodeType, ResultType> {
    error?: StatusCodeWithMessage<ErrorCodeType>;
    result?: ResultType;
  }

  // (undocumented)
  class ImportContext implements IDisposable {
    // WARNING: The type "DgnDb" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "DgnDb" needs to be exported by the package (e.g. added to index.ts)
    constructor(sourceDb: DgnDb, targetDb: DgnDb);
    // (undocumented)
    addCodeSpecId(sourceId: Id64String, targetId: Id64String): BentleyStatus;
    // (undocumented)
    addElementId(sourceId: Id64String, targetId: Id64String): BentleyStatus;
    // (undocumented)
    cloneElement(sourceId: Id64String): ElementProps;
    // (undocumented)
    dispose(): void;
    // (undocumented)
    findCodeSpecId(sourceId: Id64String): Id64String;
    // (undocumented)
    findElementId(sourceId: Id64String): Id64String;
    // (undocumented)
    importCodeSpec(sourceId: Id64String): Id64String;
    // (undocumented)
    importFont(sourceId: number): number;
  }

  // (undocumented)
  function initializeRegion(region: number): void;

  // (undocumented)
  class SnapRequest {
    constructor();
    // (undocumented)
    cancelSnap(): void;
    // WARNING: The type "DgnDb" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ErrorStatusOrResult" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    doSnap(db: DgnDb, request: any, callback: (result: ErrorStatusOrResult<IModelStatus, any>) => void): void;
  }

  // (undocumented)
  class SqliteStatement implements IDisposable {
    constructor();
    // (undocumented)
    bindBlob(param: number | string, val: Uint8Array | ArrayBuffer | SharedArrayBuffer): DbResult;
    // (undocumented)
    bindDouble(param: number | string, val: number): DbResult;
    // (undocumented)
    bindGuid(param: number | string, guidStr: GuidString): DbResult;
    // (undocumented)
    bindId(param: number | string, hexStr: Id64String): DbResult;
    // (undocumented)
    bindInteger(param: number | string, val: number | string): DbResult;
    // (undocumented)
    bindNull(param: number | string): DbResult;
    // (undocumented)
    bindString(param: number | string, val: string): DbResult;
    // (undocumented)
    clearBindings(): DbResult;
    // (undocumented)
    dispose(): void;
    // (undocumented)
    getColumnCount(): number;
    // (undocumented)
    getColumnName(columnIndex: number): string;
    // (undocumented)
    getColumnType(columnIndex: number): number;
    // (undocumented)
    getValueBlob(columnIndex: number): Uint8Array;
    // (undocumented)
    getValueDouble(columnIndex: number): number;
    // (undocumented)
    getValueGuid(columnIndex: number): GuidString;
    // (undocumented)
    getValueId(columnIndex: number): Id64String;
    // (undocumented)
    getValueInteger(columnIndex: number): number;
    // (undocumented)
    getValueString(columnIndex: number): string;
    // (undocumented)
    isReadonly(): boolean;
    // (undocumented)
    isValueNull(columnIndex: number): boolean;
    // WARNING: The type "DgnDb" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ECDb" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    prepare(db: DgnDb | ECDb, sql: string): StatusCodeWithMessage<DbResult>;
    // (undocumented)
    reset(): DbResult;
    // (undocumented)
    step(): DbResult;
    // (undocumented)
    stepAsync(callback: (result: DbResult) => void): void;
  }

}

// @public
class InformationCarrierElement extends Element {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class InformationContentElement extends Element {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class InformationModel extends Model {
}

// @public
class InformationPartitionElement extends InformationContentElement, implements InformationPartitionElementProps {
  constructor(props: InformationPartitionElementProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeElementId: CodeScopeProps, codeValue: string): Code;
  // (undocumented)
  description?: string;
}

// @public
class InformationRecordElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class InformationRecordModel extends InformationModel {
}

// @public
class InformationRecordPartition extends InformationPartitionElement {
}

// @public
class InformationReferenceElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
interface InstanceChange {
  // (undocumented)
  changedInstance: {
    className: string;
    id: Id64String;
  }
  // (undocumented)
  id: Id64String;
  // (undocumented)
  isIndirect: boolean;
  // (undocumented)
  opCode: ChangeOpCode;
  // (undocumented)
  summaryId: Id64String;
}

// @public
enum KeepBriefcase {
  // (undocumented)
  No = 0,
  // (undocumented)
  Yes = 1
}

// @public
class KnownLocations {
  static readonly nativeAssetsDir: string;
  static readonly packageAssetsDir: string;
  static readonly tmpdir: string;
}

// @public
class LightLocation extends SpatialLocationElement, implements LightLocationProps {
  constructor(props: LightLocationProps, iModel: IModelDb);
  enabled: boolean;
}

// @public
class LineStyle extends DefinitionElement, implements LineStyleProps {
  constructor(props: LineStyleProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  // (undocumented)
  data: string;
  // (undocumented)
  description?: string;
}

// WARNING: Unsupported export: Strokes
// WARNING: Unsupported export: Symbols
// WARNING: Unsupported export: Components
// @public
module LineStyleDefinition {
  interface ComponentProps {
    id: number;
    offset?: number;
    type: ComponentType;
  }

  enum ComponentType {
    Compound = 2,
    Internal = 6,
    PointSymbol = 1,
    RasterImage = 7,
    StrokePattern = 3,
    StrokePoint = 4
  }

  interface CompoundProps {
    // (undocumented)
    comps: Components;
  }

  enum PointSymbolFlags {
    Is3d = 1,
    None = 0,
    NoScale = 2
  }

  interface PointSymbolProps {
    baseX?: number;
    baseY?: number;
    baseZ?: number;
    geomPartId: Id64String;
    scale?: number;
    sizeX?: number;
    sizeY?: number;
    sizeZ?: number;
    symFlags?: PointSymbolFlags;
  }

  interface RasterImageProps {
    descr: string;
    flags?: number;
    imageId?: number;
    trueWidth?: number;
    x: number;
    y: number;
  }

  enum StrokeCap {
    Arc = 30,
    Closed = 0,
    Decagon = 5,
    Extended = 2,
    Hexagon = 3,
    Octagon = 4,
    Open = 1
  }

  enum StrokeMode {
    Dash = 1,
    FirstInvert = 8,
    Gap = 0,
    LastInvert = 16,
    Ray = 2,
    Scale = 4
  }

  enum StrokePatternOptions {
    AutoPhase = 1,
    CenterStretch = 32,
    Iteration = 8,
    None = 0,
    Segment = 16
  }

  interface StrokePatternProps {
    descr: string;
    maxIter?: number;
    options?: StrokePatternOptions;
    phase?: number;
    strokes: Strokes;
  }

  interface StrokePointProps {
    descr: string;
    lcId: number;
    lcType?: ComponentType;
    symbols: Symbols;
  }

  interface StrokeProps {
    capMode?: StrokeCap;
    endWidth?: number;
    length: number;
    orgWidth?: number;
    strokeMode?: StrokeMode;
    widthMode?: StrokeWidth;
  }

  enum StrokeWidth {
    Full = 3,
    Left = 1,
    None = 0,
    Right = 2
  }

  enum StyleFlags {
    Continuous = 8,
    None = 0,
    NoSnap = 4,
    Physical = 128
  }

  interface StyleProps {
    compId: number;
    compType: ComponentType;
    flags?: StyleFlags;
    unitDef?: number;
  }

  enum SymbolOptions {
    AbsoluteRotation = 64,
    AdjustRotation = 32,
    Center = 3,
    CurveEnd = 8,
    CurveOrigin = 4,
    CurveVertex = 16,
    End = 2,
    NoClip = 512,
    None = 0,
    NoPartial = 1024,
    NoScale = 256,
    Origin = 1,
    ProjectOrigin = 2048,
    UseColor = 16384,
    UseWeight = 32768
  }

  interface SymbolProps {
    angle?: number;
    mod1?: SymbolOptions;
    strokeNum?: number;
    symId: number;
    symType?: ComponentType;
    xOffset?: number;
    yOffset?: number;
  }

  class Utils {
    // WARNING: The type "CompoundProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "StyleProps" needs to be exported by the package (e.g. added to index.ts)
    static createCompoundComponent(iModel: IModelDb, props: CompoundProps): StyleProps | undefined;
    // WARNING: The type "PointSymbolProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "StyleProps" needs to be exported by the package (e.g. added to index.ts)
    static createPointSymbolComponent(iModel: IModelDb, props: PointSymbolProps): StyleProps | undefined;
    // WARNING: The type "RasterImageProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "StyleProps" needs to be exported by the package (e.g. added to index.ts)
    static createRasterComponent(iModel: IModelDb, props: RasterImageProps, image: Uint8Array): StyleProps | undefined;
    // WARNING: The type "StrokePatternProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "StyleProps" needs to be exported by the package (e.g. added to index.ts)
    static createStrokePatternComponent(iModel: IModelDb, props: StrokePatternProps): StyleProps | undefined;
    // WARNING: The type "StrokePointProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "StyleProps" needs to be exported by the package (e.g. added to index.ts)
    static createStrokePointComponent(iModel: IModelDb, props: StrokePointProps): StyleProps | undefined;
    // WARNING: The type "StyleProps" needs to be exported by the package (e.g. added to index.ts)
    static createStyle(imodel: IModelDb, scopeModelId: Id64String, name: string, props: StyleProps): Id64String;
    static getOrCreateContinuousStyle(imodel: IModelDb, scopeModelId: Id64String, width?: number): Id64String;
    static getOrCreateLinePixelsStyle(imodel: IModelDb, scopeModelId: Id64String, linePixels: LinePixels): Id64String;
    static queryStyle(imodel: IModelDb, scopeModelId: Id64String, name: string): Id64String | undefined;
  }

}

// @public
class LinkElement extends InformationReferenceElement {
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
}

// @public
class LinkModel extends InformationModel {
}

// @public
class LinkPartition extends InformationPartitionElement {
}

// @public
class MetaDataRegistry {
  add(classFullName: string, metaData: EntityMetaData): void;
  find(classFullName: string): EntityMetaData | undefined;
}

// @public
class Model extends Entity, implements ModelProps {
  constructor(props: ModelProps, iModel: IModelDb);
  buildConcurrencyControlRequest(opcode: DbOpcode): void;
  // (undocumented)
  getJsonProperty(name: string): any;
  getUserProperties(namespace: string): any;
  // (undocumented)
  isPrivate: boolean;
  // (undocumented)
  isTemplate: boolean;
  // (undocumented)
  readonly jsonProperties: any;
  // (undocumented)
  readonly modeledElement: RelatedElement;
  // (undocumented)
  readonly name: string;
  // (undocumented)
  static onDelete(_props: ModelProps): IModelStatus;
  // (undocumented)
  static onDeleted(_props: ModelProps): void;
  // (undocumented)
  static onInsert(_props: ModelProps): IModelStatus;
  // (undocumented)
  static onInserted(_id: string): void;
  // (undocumented)
  static onUpdate(_props: ModelProps): IModelStatus;
  // (undocumented)
  static onUpdated(_props: ModelProps): void;
  // (undocumented)
  readonly parentModel: Id64String;
  removeUserProperties(nameSpace: string): void;
  // (undocumented)
  setJsonProperty(name: string, value: any): void;
  setUserProperties(nameSpace: string, value: any): void;
  toJSON(): ModelProps;
}

// @public
class ModelSelector extends DefinitionElement, implements ModelSelectorProps {
  constructor(props: ModelSelectorProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, models: Id64Array): ModelSelector;
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, models: Id64Array): Id64String;
  models: string[];
  // (undocumented)
  toJSON(): ModelSelectorProps;
}

// @public
class OpenParams {
  constructor(
      openMode: OpenMode, 
      accessMode?: AccessMode | undefined, 
      syncMode?: SyncMode | undefined, 
      exclusiveAccessOption?: ExclusiveAccessOption | undefined);
  readonly accessMode?: AccessMode | undefined;
  equals(other: OpenParams): boolean;
  readonly exclusiveAccessOption?: ExclusiveAccessOption | undefined;
  static fixedVersion(accessMode?: AccessMode, exclusiveAccessOption?: ExclusiveAccessOption): OpenParams;
  readonly isStandalone: boolean;
  readonly openMode: OpenMode;
  static pullAndPush(exclusiveAccessOption?: ExclusiveAccessOption): OpenParams;
  static pullOnly(accessMode?: AccessMode, exclusiveAccessOption?: ExclusiveAccessOption): OpenParams;
  // @deprecated
  static standalone(openMode: OpenMode): OpenParams;
  readonly syncMode?: SyncMode | undefined;
}

// @public
class OrthographicViewDefinition extends SpatialViewDefinition {
  constructor(props: SpatialViewDefinitionProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, modelSelectorId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range3d, standardView?: StandardViewIndex): OrthographicViewDefinition;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, modelSelectorId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range3d, standardView?: StandardViewIndex): Id64String;
  setRange(range: Range3d): void;
}

// @public
class PhysicalElement extends SpatialElement {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public
class PhysicalElementAssemblesElements extends ElementOwnsChildElements {
  constructor(parentId: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class PhysicalElementFulfillsFunction extends ElementRefersToElements {
}

// @public
class PhysicalElementIsOfType extends RelatedElement {
  constructor(id: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class PhysicalModel extends SpatialModel {
  static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String;
}

// @public (undocumented)
class PhysicalObject extends PhysicalElement {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public
class PhysicalPartition extends InformationPartitionElement {
}

// @public
class PhysicalType extends TypeDefinitionElement {
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
}

// @public (undocumented)
class PlanCallout extends Callout {
  constructor(props: CalloutProps, iModel: IModelDb);
}

// @public
class Platform {
  static readonly electron: any;
  static readonly imodeljsMobile: any;
  static readonly isDesktop: boolean;
  static readonly isMobile: boolean;
  static readonly isNodeJs: boolean;
  // (undocumented)
  static load(dir?: string): typeof IModelJsNative;
  static readonly platformName: string;
}

// @public
class RecipeDefinitionElement extends DefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class Relationship extends Entity, implements RelationshipProps {
  constructor(props: RelationshipProps, iModel: IModelDb);
  buildConcurrencyControlRequest(opcode: DbOpcode): void;
  delete(): void;
  // (undocumented)
  static getInstance<T extends Relationship>(iModel: IModelDb, criteria: Id64String | SourceAndTarget): T;
  insert(): Id64String;
  // (undocumented)
  static onDeletedDependency(_props: RelationshipProps, _iModel: IModelDb): void;
  // (undocumented)
  static onRootChanged(_props: RelationshipProps, _iModel: IModelDb): void;
  // (undocumented)
  static onValidateOutput(_props: RelationshipProps, _iModel: IModelDb): void;
  // (undocumented)
  readonly sourceId: Id64String;
  // (undocumented)
  readonly targetId: Id64String;
  // (undocumented)
  toJSON(): RelationshipProps;
  update(): void;
}

// @public
interface RelationshipProps extends EntityProps, SourceAndTarget {
}

// @public
class Relationships {
  constructor(iModel: IModelDb);
  createInstance(props: RelationshipProps): Relationship;
  deleteInstance(props: RelationshipProps): void;
  getInstance<T extends Relationship>(relClassSqlName: string, criteria: Id64String | SourceAndTarget): T;
  getInstanceProps<T extends RelationshipProps>(relClassSqlName: string, criteria: Id64String | SourceAndTarget): T;
  insertInstance(props: RelationshipProps): Id64String;
  updateInstance(props: RelationshipProps): void;
}

// @public (undocumented)
class RenderMaterial {
}

// @public
class RenderMaterialOwnsRenderMaterials extends ElementOwnsChildElements {
  constructor(parentId: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class RepositoryLink extends UrlLink {
}

// @public
class RepositoryModel extends DefinitionModel {
}

// @public
class RoleElement extends Element {
}

// @public
class RoleModel extends Model {
}

// @public
class Schema {
  static getClass(className: string, iModel: IModelDb): typeof Entity | undefined;
  // (undocumented)
  readonly name: string;
}

// @public
class Schemas {
  static getRegisteredSchema(schemaName: string): Schema | undefined;
  // (undocumented)
  static isRegistered(schema: Schema): boolean;
  static registerSchema(schema: Schema): void;
  static unregisterSchema(schemaName: string): void;
}

// @public (undocumented)
class SectionCallout extends Callout {
  constructor(props: CalloutProps, iModel: IModelDb);
}

// @public
class SectionDrawing extends Drawing {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class SectionDrawingModel extends DrawingModel {
}

// @public
class Sheet extends Document, implements SheetProps {
  constructor(props: SheetProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  // (undocumented)
  height: number;
  // (undocumented)
  scale?: number;
  // (undocumented)
  sheetTemplate?: Id64String;
  // (undocumented)
  width: number;
}

// @public
class SheetBorderTemplate extends Document, implements SheetBorderTemplateProps {
  constructor(props: SheetBorderTemplateProps, iModel: IModelDb);
  // (undocumented)
  height?: number;
  // (undocumented)
  width?: number;
}

// @public
class SheetModel extends GraphicalModel2d {
}

// @public
class SheetTemplate extends Document, implements SheetTemplateProps {
  constructor(props: SheetTemplateProps, iModel: IModelDb);
  // (undocumented)
  border?: Id64String;
  // (undocumented)
  height?: number;
  // (undocumented)
  width?: number;
}

// @public
class SheetViewDefinition extends ViewDefinition2d {
}

// @public
interface SourceAndTarget {
  // (undocumented)
  sourceId: Id64String;
  // (undocumented)
  targetId: Id64String;
}

// @public
class SpatialCategory extends Category {
  constructor(opts: ElementProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string): SpatialCategory;
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  static getCodeSpecName(): string;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, defaultAppearance: SubCategoryAppearance.Props): Id64String;
  static queryCategoryIdByName(iModel: IModelDb, scopeModelId: Id64String, categoryName: string): Id64String | undefined;
}

// @public
class SpatialElement extends GeometricElement3d {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public (undocumented)
class SpatialLocation extends SpatialLocationElement {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public
class SpatialLocationElement extends SpatialElement {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public
class SpatialLocationIsOfType extends RelatedElement {
  constructor(id: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class SpatialLocationModel extends SpatialModel {
}

// @public
class SpatialLocationPartition extends InformationPartitionElement {
}

// @public
class SpatialLocationType extends TypeDefinitionElement {
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb);
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
}

// @public
class SpatialModel extends GeometricModel3d {
}

// @public
class SpatialViewDefinition extends ViewDefinition3d, implements SpatialViewDefinitionProps {
  constructor(props: SpatialViewDefinitionProps, iModel: IModelDb);
  loadModelSelector(): ModelSelector;
  modelSelectorId: Id64String;
  // (undocumented)
  toJSON(): SpatialViewDefinitionProps;
}

// @public
class SqliteStatement implements IterableIterator<any>, IDisposable {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  [Symbol.iterator](): IterableIterator<any>;
  bindValue(parameter: number | string, value: any): void;
  bindValues(values: any[] | object): void;
  clearBindings(): void;
  dispose(): void;
  getColumnCount(): number;
  getRow(): any;
  getValue(columnIx: number): SqliteValue;
  readonly isPrepared: boolean;
  readonly isReadonly: boolean;
  readonly isShared: boolean;
  next(): IteratorResult<any>;
  // WARNING: The type "IModelJsNative.DgnDb" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "IModelJsNative.ECDb" needs to be exported by the package (e.g. added to index.ts)
  prepare(db: IModelJsNative.DgnDb | IModelJsNative.ECDb, sql: string): void;
  reset(): void;
  setIsShared(b: boolean): void;
  step(): DbResult;
}

// @public
class SqliteStatementCache {
  constructor(maxCount?: number);
  // (undocumented)
  add(str: string, stmt: SqliteStatement): void;
  // (undocumented)
  clear(): void;
  // (undocumented)
  find(str: string): CachedSqliteStatement | undefined;
  // (undocumented)
  getCount(): number;
  // (undocumented)
  readonly maxCount: number;
  // (undocumented)
  release(stmt: SqliteStatement): void;
  // (undocumented)
  removeUnusedStatementsIfNecessary(): void;
  // (undocumented)
  replace(str: string, stmt: SqliteStatement): void;
}

// @public
class SqliteValue {
  // WARNING: The type "IModelJsNative.SqliteStatement" needs to be exported by the package (e.g. added to index.ts)
  constructor(stmt: IModelJsNative.SqliteStatement, colIndex: number);
  readonly columnName: string;
  getBlob(): Uint8Array;
  getDouble(): number;
  getGuid(): GuidString;
  getId(): Id64String;
  getInteger(): number;
  getString(): string;
  readonly isNull: boolean;
  readonly type: SqliteValueType;
  readonly value: any;
}

// @public
enum SqliteValueType {
  // (undocumented)
  Blob = 4,
  // (undocumented)
  Double = 2,
  // (undocumented)
  Integer = 1,
  // (undocumented)
  Null = 5,
  // (undocumented)
  String = 3
}

// @public
interface StringParam {
  // (undocumented)
  guid?: GuidString;
  // (undocumented)
  id?: Id64String;
}

// @public
class SubCategory extends DefinitionElement, implements SubCategoryProps {
  constructor(props: SubCategoryProps, iModel: IModelDb);
  appearance: SubCategoryAppearance;
  static create(iModelDb: IModelDb, parentCategoryId: Id64String, name: string, appearance: SubCategoryAppearance.Props): SubCategory;
  static createCode(iModel: IModelDb, parentCategoryId: CodeScopeProps, codeValue: string): Code;
  description?: string;
  getCategoryId(): Id64String;
  getSubCategoryId(): Id64String;
  getSubCategoryName(): string;
  static insert(iModelDb: IModelDb, parentCategoryId: Id64String, name: string, appearance: SubCategoryAppearance.Props): Id64String;
  readonly isDefaultSubCategory: boolean;
  // (undocumented)
  toJSON(): SubCategoryProps;
}

// @public
class Subject extends InformationReferenceElement, implements SubjectProps {
  constructor(props: SubjectProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, parentSubjectId: Id64String, name: string, description?: string): Subject;
  static createCode(iModelDb: IModelDb, parentSubjectId: CodeScopeProps, codeValue: string): Code;
  // (undocumented)
  description?: string;
  static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string, description?: string): Id64String;
}

// @public
class SubjectOwnsPartitionElements extends ElementOwnsChildElements {
  constructor(parentId: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
class SubjectOwnsSubjects extends ElementOwnsChildElements {
  constructor(parentId: Id64String, relClassName?: string);
  // (undocumented)
  static classFullName: string;
}

// @public
enum SyncMode {
  // (undocumented)
  FixedVersion = 1,
  // (undocumented)
  PullAndPush = 3,
  // (undocumented)
  PullOnly = 2
}

// @public
class TemplateRecipe2d extends RecipeDefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class TemplateRecipe3d extends RecipeDefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb);
}

// @public
class TemplateViewDefinition2d extends ViewDefinition2d {
}

// @public
class TemplateViewDefinition3d extends ViewDefinition3d {
}

// @public
class TextAnnotation2d extends AnnotationElement2d {
  constructor(props: GeometricElement2dProps, iModel: IModelDb);
}

// @public
class TextAnnotation3d extends GraphicalElement3d {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public
class Texture extends DefinitionElement, implements TextureProps {
  constructor(props: TextureProps, iModel: IModelDb);
  static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, format: ImageSourceFormat, data: string, width: number, height: number, description: string, flags: TextureFlags): Texture;
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, name: string): Code;
  // (undocumented)
  data: string;
  // (undocumented)
  description?: string;
  // (undocumented)
  flags: TextureFlags;
  // (undocumented)
  format: ImageSourceFormat;
  // (undocumented)
  height: number;
  static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, format: ImageSourceFormat, data: string, width: number, height: number, description: string, flags: TextureFlags): Id64String;
  // (undocumented)
  toJSON(): TextureProps;
  // (undocumented)
  width: number;
}

// @public (undocumented)
class TitleText extends DetailingSymbol {
  constructor(props: GeometricElement2dProps, iModel: IModelDb);
}

// @public (undocumented)
enum TxnAction {
  // (undocumented)
  Abandon = 2,
  // (undocumented)
  Commit = 1,
  // (undocumented)
  Merge = 5,
  // (undocumented)
  None = 0,
  // (undocumented)
  Reinstate = 4,
  // (undocumented)
  Reverse = 3
}

// @public
class TxnManager {
  constructor(_iModel: IModelDb);
  // (undocumented)
  protected _onAllInputsHandled(elClassName: string, elId: Id64String): void;
  // (undocumented)
  protected _onBeforeOutputsHandled(elClassName: string, elId: Id64String): void;
  // (undocumented)
  protected _onBeginValidate(): void;
  // (undocumented)
  protected _onDeletedDependency(props: RelationshipProps): void;
  // (undocumented)
  protected _onEndValidate(): void;
  // (undocumented)
  protected _onRootChanged(props: RelationshipProps): void;
  // (undocumented)
  protected _onValidateOutput(props: RelationshipProps): void;
  beginMultiTxnOperation(): DbResult;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  cancelTo(txnId: IModelJsNative.TxnIdString): IModelStatus;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  describeChangeSet(endTxnId?: IModelJsNative.TxnIdString): string;
  endMultiTxnOperation(): DbResult;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  getCurrentTxnId(): IModelJsNative.TxnIdString;
  getMultiTxnOperationDepth(): number;
  getRedoString(): string;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  getTxnDescription(txnId: IModelJsNative.TxnIdString): string;
  getUndoString(): string;
  readonly hasFatalError: boolean;
  readonly hasLocalChanges: boolean;
  readonly hasPendingTxns: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly isRedoPossible: boolean;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  isTxnIdValid(txnId: IModelJsNative.TxnIdString): boolean;
  readonly isUndoPossible: boolean;
  readonly onAfterUndoRedo: BeEvent<(_action: TxnAction) => void>;
  readonly onBeforeUndoRedo: BeEvent<() => void>;
  readonly onChangesApplied: BeEvent<() => void>;
  readonly onCommit: BeEvent<() => void>;
  readonly onCommitted: BeEvent<() => void>;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  queryFirstTxnId(): IModelJsNative.TxnIdString;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  queryNextTxnId(txnId: IModelJsNative.TxnIdString): IModelJsNative.TxnIdString;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  queryPreviousTxnId(txnId: IModelJsNative.TxnIdString): IModelJsNative.TxnIdString;
  reinstateTxn(): IModelStatus;
  reportError(error: ValidationError): void;
  reverseAll(): IModelStatus;
  reverseSingleTxn(): IModelStatus;
  // WARNING: The type "IModelJsNative.TxnIdString" needs to be exported by the package (e.g. added to index.ts)
  reverseTo(txnId: IModelJsNative.TxnIdString): IModelStatus;
  reverseTxns(numOperations: number): IModelStatus;
  readonly validationErrors: ValidationError[];
}

// @public
class TypeDefinitionElement extends DefinitionElement, implements TypeDefinitionElementProps {
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb);
  // (undocumented)
  recipe?: RelatedElement;
}

// @public
class UrlLink extends LinkElement {
}

// @public
interface ValidationError {
  errorType: string;
  fatal: boolean;
  message?: string;
}

// @public
class ViewAttachment extends GraphicalElement2d, implements ViewAttachmentProps {
  constructor(props: ViewAttachmentProps, iModel: IModelDb);
  // (undocumented)
  view: RelatedElement;
}

// @public (undocumented)
class ViewAttachmentLabel extends DetailingSymbol, implements ViewAttachmentLabelProps {
  constructor(props: ViewAttachmentLabelProps, iModel: IModelDb);
}

// @public
class ViewDefinition extends DefinitionElement, implements ViewDefinitionProps {
  protected constructor(props: ViewDefinitionProps, iModel: IModelDb);
  categorySelectorId: Id64String;
  static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code;
  displayStyleId: Id64String;
  isDrawingView(): this is DrawingViewDefinition;
  isSpatialView(): this is SpatialViewDefinition;
  isView2d(): this is ViewDefinition2d;
  isView3d(): this is ViewDefinition3d;
  loadCategorySelector(): CategorySelector;
  loadDisplayStyle(): DisplayStyle;
  // (undocumented)
  toJSON(): ViewDefinitionProps;
}

// @public
class ViewDefinition2d extends ViewDefinition, implements ViewDefinition2dProps {
  constructor(props: ViewDefinition2dProps, iModel: IModelDb);
  angle: Angle;
  baseModelId: Id64String;
  delta: Point2d;
  loadDisplayStyle2d(): DisplayStyle2d;
  origin: Point2d;
  // (undocumented)
  toJSON(): ViewDefinition2dProps;
}

// @public
class ViewDefinition3d extends ViewDefinition, implements ViewDefinition3dProps {
  constructor(props: ViewDefinition3dProps, iModel: IModelDb);
  angles: YawPitchRollAngles;
  camera: Camera;
  cameraOn: boolean;
  extents: Vector3d;
  loadDisplayStyle3d(): DisplayStyle3d;
  origin: Point3d;
  // (undocumented)
  toJSON(): ViewDefinition3dProps;
}

// @public
class VolumeElement extends SpatialLocationElement {
  constructor(props: GeometricElement3dProps, iModel: IModelDb);
}

// @public
class WebMercatorModel extends SpatialModel {
}

// WARNING: Unsupported export: SchemaKey
// WARNING: Unsupported export: SchemaMatchType
// WARNING: Unsupported export: ExportGraphicsFunction
// WARNING: Unsupported export: AutoPushEventHandler
// WARNING: Unsupported export: ChangeSetDescriber
// (No @packagedocumentation comment for this package)
