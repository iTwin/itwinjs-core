// @beta
class ActivityLoggingContext {
  constructor(activityId: string, versionId?: string);
  // (undocumented)
  protected static _current: ActivityLoggingContext;
  readonly activityId: string;
  static readonly current: ActivityLoggingContext;
  enter(): this;
  readonly versionId: string;
}

// @beta
export function assert(condition: boolean, msg?: string): void;

// @beta
enum AuthStatus {
  // (undocumented)
  AUTHSTATUS_BASE = 131072,
  // (undocumented)
  Error = 131072,
  // (undocumented)
  Success = 0
}

// @public
export function base64StringToUint8Array(base64: string): Uint8Array;

// @public
class BeDuration {
  static fromMilliseconds(milliseconds: number): BeDuration;
  static fromSeconds(seconds: number): BeDuration;
  readonly isTowardsFuture: boolean;
  readonly isTowardsPast: boolean;
  readonly isZero: boolean;
  readonly milliseconds: number;
  minus(other: BeDuration): BeDuration;
  plus(other: BeDuration): BeDuration;
  // (undocumented)
  readonly seconds: number;
  static wait(ms: number): Promise<void>;
}

// @public
class BeEvent<T extends Listener> {
  addListener(listener: T, scope?: any): () => void;
  addOnce(listener: T, scope?: any): () => void;
  clear(): void;
  has(listener: T, scope?: any): boolean;
  readonly numberOfListeners: number;
  raiseEvent(...args: any[]): void;
  removeListener(listener: T, scope?: any): boolean;
}

// @beta
class BeEventList<T extends Listener> {
  get(name: string): BeEvent<T>;
  remove(name: string): void;
}

// @public
class BentleyError extends Error {
  constructor(errorNumber: number | IModelStatus | DbResult | BentleyStatus | BriefcaseStatus | RepositoryStatus | ChangeSetStatus | HttpStatus | WSStatus | IModelHubStatus, message?: string, log?: LogFunction, category?: string, getMetaData?: GetMetaDataFunction);
  protected _initName(): string;
  // (undocumented)
  errorNumber: number;
  // (undocumented)
  getMetaData(): any;
  // (undocumented)
  readonly hasMetaData: boolean;
}

// @public
enum BentleyStatus {
  // (undocumented)
  ERROR = 32768,
  // (undocumented)
  SUCCESS = 0
}

// @public
class BeTimePoint {
  after(other: BeTimePoint): boolean;
  before(other: BeTimePoint): boolean;
  static beforeNow(val: BeDuration): BeTimePoint;
  static fromNow(val: BeDuration): BeTimePoint;
  readonly isInFuture: boolean;
  readonly isInPast: boolean;
  readonly milliseconds: number;
  minus(duration: BeDuration): BeTimePoint;
  static now(): BeTimePoint;
  plus(duration: BeDuration): BeTimePoint;
}

// @beta
class BeUiEvent<TEventArgs> extends BeEvent<(args: TEventArgs) => void> {
  emit(args: TEventArgs): void;
}

// @beta
enum BriefcaseStatus {
  // (undocumented)
  CannotAcquire = 131072,
  // (undocumented)
  CannotApplyChanges = 131078,
  // (undocumented)
  CannotCopy = 131075,
  // (undocumented)
  CannotDelete = 131076,
  // (undocumented)
  CannotDownload = 131073,
  // (undocumented)
  CannotUpload = 131074,
  // (undocumented)
  VersionNotFound = 131077
}

// @public
enum ChangeSetApplyOption {
  Merge = 1,
  None = 0,
  Reinstate = 3,
  Reverse = 2
}

// @beta
enum ChangeSetStatus {
  ApplyError = 90113,
  CannotMergeIntoMaster = 90136,
  CannotMergeIntoReadonly = 90135,
  CannotMergeIntoReversed = 90137,
  // (undocumented)
  CHANGESET_ERROR_BASE = 90112,
  ChangeTrackingNotEnabled = 90114,
  CorruptedChangeStream = 90115,
  CouldNotOpenDgnDb = 90131,
  FileNotFound = 90116,
  FileWriteError = 90117,
  HasLocalChanges = 90118,
  HasUncommittedChanges = 90119,
  InDynamicTransaction = 90122,
  InvalidId = 90120,
  InvalidVersion = 90121,
  IsCreatingChangeSet = 90123,
  IsNotCreatingChangeSet = 90124,
  MergePropagationError = 90125,
  MergeSchemaChangesOnOpen = 90132,
  NothingToMerge = 90126,
  NoTransactions = 90127,
  ParentMismatch = 90128,
  ProcessSchemaChangesOnOpen = 90134,
  ReverseOrReinstateSchemaChangesOnOpen = 90133,
  SQLiteError = 90129,
  // (undocumented)
  Success = 0,
  WrongDgnDb = 90130
}

// @public (undocumented)
export function compareBooleans(a: boolean, b: boolean): number;

// @public (undocumented)
export function compareNumbers(a: number, b: number): number;

// @public (undocumented)
export function comparePossiblyUndefined<T>(compareDefined: (lhs: T, rhs: T) => number, lhs?: T, rhs?: T): number;

// @public (undocumented)
export function compareStrings(a: string, b: string): number;

// @public (undocumented)
export function compareStringsOrUndefined(lhs?: string, rhs?: string): number;

// @public
export function compareWithTolerance(a: number, b: number, tolerance?: number): number;

// @public
enum DbOpcode {
  Delete = 9,
  Insert = 18,
  Update = 23
}

// @public
enum DbResult {
  BE_SQLITE_ABORT = 4,
  // (undocumented)
  BE_SQLITE_ABORT_ROLLBACK = 516,
  BE_SQLITE_AUTH = 23,
  BE_SQLITE_BUSY = 5,
  // (undocumented)
  BE_SQLITE_BUSY_RECOVERY = 261,
  BE_SQLITE_CANTOPEN = 14,
  // (undocumented)
  BE_SQLITE_CANTOPEN_FULLPATH = 782,
  // (undocumented)
  BE_SQLITE_CANTOPEN_ISDIR = 526,
  // (undocumented)
  BE_SQLITE_CANTOPEN_NOTEMPDIR = 270,
  BE_SQLITE_CONSTRAINT_BASE = 19,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_CHECK = 275,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_COMMITHOOK = 531,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_FOREIGNKEY = 787,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_FUNCTION = 1043,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_NOTNULL = 1299,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_PRIMARYKEY = 1555,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_TRIGGER = 1811,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_UNIQUE = 2067,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_VTAB = 2323,
  BE_SQLITE_CORRUPT = 11,
  // (undocumented)
  BE_SQLITE_CORRUPT_VTAB = 267,
  BE_SQLITE_DONE = 101,
  BE_SQLITE_EMPTY = 16,
  BE_SQLITE_ERROR = 1,
  BE_SQLITE_ERROR_AlreadyOpen = 33554442,
  BE_SQLITE_ERROR_BadDbProfile = 100663306,
  BE_SQLITE_ERROR_ChangeTrackError = 218103818,
  BE_SQLITE_ERROR_CouldNotAcquireLocksOrCodes = 352321546,
  BE_SQLITE_ERROR_FileExists = 16777226,
  BE_SQLITE_ERROR_FileNotFound = 67108874,
  BE_SQLITE_ERROR_InvalidChangeSetVersion = 234881034,
  BE_SQLITE_ERROR_InvalidProfileVersion = 117440522,
  BE_SQLITE_ERROR_NoPropertyTable = 50331658,
  BE_SQLITE_ERROR_NoTxnActive = 83886090,
  BE_SQLITE_ERROR_ProfileTooNew = 201326602,
  BE_SQLITE_ERROR_ProfileTooNewForReadWrite = 184549386,
  BE_SQLITE_ERROR_ProfileTooOld = 167772170,
  BE_SQLITE_ERROR_ProfileTooOldForReadWrite = 150994954,
  BE_SQLITE_ERROR_ProfileUpgradeFailed = 134217738,
  BE_SQLITE_ERROR_SchemaImportFailed = 335544330,
  BE_SQLITE_ERROR_SchemaLockFailed = 301989898,
  BE_SQLITE_ERROR_SchemaTooNew = 268435466,
  BE_SQLITE_ERROR_SchemaTooOld = 285212682,
  BE_SQLITE_ERROR_SchemaUpgradeFailed = 318767114,
  BE_SQLITE_ERROR_SchemaUpgradeRequired = 251658250,
  BE_SQLITE_FORMAT = 24,
  BE_SQLITE_FULL = 13,
  BE_SQLITE_INTERNAL = 2,
  BE_SQLITE_INTERRUPT = 9,
  BE_SQLITE_IOERR = 10,
  // (undocumented)
  BE_SQLITE_IOERR_ACCESS = 3338,
  // (undocumented)
  BE_SQLITE_IOERR_BLOCKED = 2826,
  // (undocumented)
  BE_SQLITE_IOERR_CHECKRESERVEDLOCK = 3594,
  // (undocumented)
  BE_SQLITE_IOERR_CLOSE = 4106,
  // (undocumented)
  BE_SQLITE_IOERR_DELETE = 2570,
  // (undocumented)
  BE_SQLITE_IOERR_DELETE_NOENT = 5898,
  // (undocumented)
  BE_SQLITE_IOERR_DIR_CLOSE = 4362,
  // (undocumented)
  BE_SQLITE_IOERR_DIR_FSYNC = 1290,
  // (undocumented)
  BE_SQLITE_IOERR_FSTAT = 1802,
  // (undocumented)
  BE_SQLITE_IOERR_FSYNC = 1034,
  // (undocumented)
  BE_SQLITE_IOERR_LOCK = 3850,
  // (undocumented)
  BE_SQLITE_IOERR_NOMEM = 3082,
  // (undocumented)
  BE_SQLITE_IOERR_RDLOCK = 2314,
  // (undocumented)
  BE_SQLITE_IOERR_READ = 266,
  // (undocumented)
  BE_SQLITE_IOERR_SEEK = 5642,
  // (undocumented)
  BE_SQLITE_IOERR_SHMLOCK = 5130,
  // (undocumented)
  BE_SQLITE_IOERR_SHMMAP = 5386,
  // (undocumented)
  BE_SQLITE_IOERR_SHMOPEN = 4618,
  // (undocumented)
  BE_SQLITE_IOERR_SHMSIZE = 4874,
  // (undocumented)
  BE_SQLITE_IOERR_SHORT_READ = 522,
  // (undocumented)
  BE_SQLITE_IOERR_TRUNCATE = 1546,
  // (undocumented)
  BE_SQLITE_IOERR_UNLOCK = 2058,
  // (undocumented)
  BE_SQLITE_IOERR_WRITE = 778,
  BE_SQLITE_LOCKED = 6,
  // (undocumented)
  BE_SQLITE_LOCKED_SHAREDCACHE = 262,
  BE_SQLITE_MISMATCH = 20,
  BE_SQLITE_MISUSE = 21,
  BE_SQLITE_NOLFS = 22,
  BE_SQLITE_NOMEM = 7,
  BE_SQLITE_NOTADB = 26,
  BE_SQLITE_NOTFOUND = 12,
  // (undocumented)
  BE_SQLITE_OK = 0,
  BE_SQLITE_PERM = 3,
  BE_SQLITE_PROTOCOL = 15,
  BE_SQLITE_RANGE = 25,
  BE_SQLITE_READONLY = 8,
  // (undocumented)
  BE_SQLITE_READONLY_CANTLOCK = 520,
  // (undocumented)
  BE_SQLITE_READONLY_RECOVERY = 264,
  // (undocumented)
  BE_SQLITE_READONLY_ROLLBACK = 776,
  BE_SQLITE_ROW = 100,
  BE_SQLITE_SCHEMA = 17,
  BE_SQLITE_TOOBIG = 18
}

// @public
class Dictionary<K, V> implements Iterable<DictionaryEntry<K, V>> {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  [Symbol.iterator](): Iterator<DictionaryEntry<K, V>>;
  constructor(compareKeys: OrderedComparator<K>, cloneKey?: CloneFunction<K>, cloneValue?: CloneFunction<V>);
  // (undocumented)
  protected readonly _cloneKey: CloneFunction<K>;
  // (undocumented)
  protected readonly _cloneValue: CloneFunction<V>;
  // (undocumented)
  protected readonly _compareKeys: OrderedComparator<K>;
  // (undocumented)
  protected _keys: K[];
  // (undocumented)
  protected _values: V[];
  clear(): void;
  delete(key: K): boolean;
  extractArrays: {
    keys: K[];
    values: V[];
  }
  extractPairs(): Array<{
          key: K;
          value: V;
      }>;
  forEach(func: (key: K, value: V) => void): void;
  get(key: K): V | undefined;
  insert(key: K, value: V): boolean;
  readonly length: number;
  protected lowerBound: {
    equal: boolean;
    index: number;
  }
  set(key: K, value: V): void;
}

// @public
interface DictionaryEntry<K, V> {
  key: K;
  value: V;
}

// @public
class DisposableList implements IDisposable {
  constructor(disposables?: Array<IDisposable | DisposeFunc>);
  add(disposable: IDisposable | DisposeFunc): void;
  dispose(): void;
  remove(disposable: IDisposable): void;
}

// @public
export function dispose(disposable?: IDisposable): undefined;

// @public
export function disposeArray(list?: IDisposable[]): undefined;

// @public
class Entry<K, V> {
  constructor(key: K, value: V);
  // (undocumented)
  key: K;
  // (undocumented)
  newer?: Entry<K, V>;
  // (undocumented)
  older?: Entry<K, V>;
  // (undocumented)
  value: V;
}

// @alpha
class EnvMacroSubst {
  static anyPropertyContainsEnvvars(obj: any, recurse: boolean): boolean;
  static containsEnvvars(str: string): boolean;
  static replace(str: string, defaultValues?: any): string;
  static replaceInProperties(obj: any, recurse: boolean, defaultValues?: any): void;
}

// @public
module Guid {
  function createValue(): GuidString;

  function isGuid(value: string): boolean;

  function isV4Guid(value: string): boolean;

}

// @beta
enum HttpStatus {
  ClientError = 94211,
  Info = 94209,
  Redirection = 94210,
  ServerError = 94212,
  Success = 0
}

// WARNING: Unsupported export: invalid
// @public
module Id64 {
  function fromJSON(prop?: string): Id64String;

  function fromLocalAndBriefcaseIds(localId: number, briefcaseId: number): Id64String;

  function fromString(val: string): Id64String;

  function fromUint32Pair(lowBytes: number, highBytes: number): Id64String;

  function getBriefcaseId(id: Id64String): number;

  function getLocalId(id: Id64String): number;

  function getLowerUint32(id: Id64String): number;

  function getUint32Pair(id: Id64String): Uint32Pair;

  function getUpperUint32(id: Id64String): number;

  function isId64(id: string): boolean;

  function isInvalid(id: Id64String): boolean;

  function isTransient(id: Id64String): boolean;

  function isTransientId64(id: string): boolean;

  function isValid(id: Id64String): boolean;

  function isValidId64(id: string): boolean;

  // (undocumented)
  function isValidUint32Pair(lowBytes: number, highBytes: number): boolean;

  function toIdSet(arg: Id64Arg): Id64Set;

  // @public
  class Uint32Map<T> {
    // (undocumented)
    protected readonly _map: Map<number, Map<number, T>>;
    clear(): void;
    get(low: number, high: number): T | undefined;
    getById(id: Id64String): T | undefined;
    readonly isEmpty: boolean;
    set(low: number, high: number, value: T): void;
    setById(id: Id64String, value: T): void;
    readonly size: number;
  }

  interface Uint32Pair {
    lower: number;
    upper: number;
  }

  // @public
  class Uint32Set {
    // (undocumented)
    protected readonly _map: Map<number, Set<number>>;
    add(low: number, high: number): void;
    addId(id: Id64String): void;
    clear(): void;
    has(low: number, high: number): boolean;
    hasId(id: Id64String): boolean;
    readonly isEmpty: boolean;
    readonly size: number;
    toId64Array(): Id64Array;
    toId64Set(): Id64Set;
  }

}

// @public
interface IDisposable {
  dispose(): void;
}

// @beta
enum IModelHubStatus {
  // (undocumented)
  AnotherUserPushing = 102409,
  // (undocumented)
  BriefcaseDoesNotBelongToUser = 102408,
  // (undocumented)
  BriefcaseDoesNotExist = 102407,
  // (undocumented)
  ChangeSetAlreadyExists = 102410,
  // (undocumented)
  ChangeSetAlreadyHasVersion = 102438,
  // (undocumented)
  ChangeSetDoesNotExist = 102411,
  // (undocumented)
  ChangeSetPointsToBadSeed = 102414,
  // (undocumented)
  CodeDoesNotExist = 102431,
  // (undocumented)
  CodeReservedByAnotherBriefcase = 102430,
  // (undocumented)
  CodesExist = 102421,
  // (undocumented)
  CodeStateInvalid = 102429,
  // (undocumented)
  ConflictsAggregate = 102441,
  // (undocumented)
  DatabaseOperationFailed = 102443,
  // (undocumented)
  DatabaseTemporarilyLocked = 102419,
  // (undocumented)
  EventSubscriptionAlreadyExists = 102434,
  // (undocumented)
  EventSubscriptionDoesNotExist = 102433,
  // (undocumented)
  EventTypeDoesNotExist = 102432,
  // (undocumented)
  FailedToGetProjectById = 102442,
  // (undocumented)
  FailedToGetProjectMembers = 102437,
  // (undocumented)
  FailedToGetProjectPermissions = 102436,
  // (undocumented)
  FileAlreadyExists = 102426,
  // (undocumented)
  FileDoesNotExist = 102425,
  // (undocumented)
  FileHandlerNotSet = 102661,
  // (undocumented)
  FileIsNotUploaded = 102412,
  // (undocumented)
  FileNotFound = 102662,
  // (undocumented)
  iModelAlreadyExists = 102423,
  // (undocumented)
  iModelDoesNotExist = 102424,
  // (undocumented)
  IMODELHUBERROR_BASE = 102400,
  // (undocumented)
  IMODELHUBERROR_REQUESTERRORBASE = 102656,
  // (undocumented)
  iModelIsLocked = 102420,
  // (undocumented)
  iModelIsNotInitialized = 102413,
  // (undocumented)
  InvalidArgumentError = 102658,
  // (undocumented)
  InvalidBriefcase = 102406,
  // (undocumented)
  InvalidPropertiesValues = 102403,
  // (undocumented)
  JobSchedulingFailed = 102440,
  // (undocumented)
  LockDoesNotExist = 102427,
  // (undocumented)
  LockOwnedByAnotherBriefcase = 102428,
  // (undocumented)
  LocksExist = 102422,
  // (undocumented)
  MaximumNumberOfBriefcasesPerUser = 102417,
  // (undocumented)
  MaximumNumberOfBriefcasesPerUserPerMinute = 102418,
  // (undocumented)
  MissingDownloadUrlError = 102659,
  // (undocumented)
  MissingRequiredProperties = 102402,
  // (undocumented)
  NotSupportedInBrowser = 102660,
  // (undocumented)
  OperationFailed = 102415,
  // (undocumented)
  ProjectIdIsNotSpecified = 102435,
  // (undocumented)
  PullIsRequired = 102416,
  // (undocumented)
  SeedFileInitializationFailed = 102444,
  // (undocumented)
  Success = 0,
  // (undocumented)
  UndefinedArgumentError = 102657,
  // (undocumented)
  Unknown = 102401,
  // (undocumented)
  UserDoesNotHaveAccess = 102405,
  // (undocumented)
  UserDoesNotHavePermission = 102404,
  // (undocumented)
  VersionAlreadyExists = 102439
}

// @public
enum IModelStatus {
  // (undocumented)
  AlreadyLoaded = 65537,
  // (undocumented)
  AlreadyOpen = 65538,
  // (undocumented)
  BadArg = 65539,
  // (undocumented)
  BadElement = 65540,
  // (undocumented)
  BadModel = 65541,
  // (undocumented)
  BadRequest = 65542,
  // (undocumented)
  BadSchema = 65543,
  // (undocumented)
  CannotUndo = 65544,
  // (undocumented)
  CodeNotReserved = 65545,
  // (undocumented)
  ConstraintNotUnique = 65601,
  // (undocumented)
  DeletionProhibited = 65546,
  // (undocumented)
  DuplicateCode = 65547,
  // (undocumented)
  DuplicateName = 65548,
  // (undocumented)
  ElementBlockedChange = 65549,
  // (undocumented)
  FileAlreadyExists = 65550,
  // (undocumented)
  FileNotFound = 65551,
  // (undocumented)
  FileNotLoaded = 65552,
  // (undocumented)
  ForeignKeyConstraint = 65553,
  // (undocumented)
  IdExists = 65554,
  // (undocumented)
  IMODEL_ERROR_BASE = 65536,
  // (undocumented)
  InDynamicTransaction = 65555,
  // (undocumented)
  InvalidCategory = 65556,
  // (undocumented)
  InvalidCode = 65557,
  // (undocumented)
  InvalidCodeSpec = 65558,
  // (undocumented)
  InvalidId = 65559,
  // (undocumented)
  InvalidName = 65560,
  // (undocumented)
  InvalidParent = 65561,
  // (undocumented)
  InvalidProfileVersion = 65562,
  // (undocumented)
  IsCreatingChangeSet = 65563,
  // (undocumented)
  LockNotHeld = 65564,
  // (undocumented)
  Mismatch2d3d = 65565,
  // (undocumented)
  MismatchGcs = 65566,
  // (undocumented)
  MissingDomain = 65567,
  // (undocumented)
  MissingHandler = 65568,
  // (undocumented)
  MissingId = 65569,
  // (undocumented)
  NoGeoLocation = 65602,
  // (undocumented)
  NoGeometry = 65570,
  // (undocumented)
  NoMultiTxnOperation = 65571,
  // (undocumented)
  NotDgnMarkupProject = 65572,
  // (undocumented)
  NotEnabled = 65573,
  // (undocumented)
  NotFound = 65574,
  // (undocumented)
  NothingToRedo = 65578,
  // (undocumented)
  NothingToUndo = 65579,
  // (undocumented)
  NotOpen = 65575,
  // (undocumented)
  NotOpenForWrite = 65576,
  // (undocumented)
  NotSameUnitBase = 65577,
  // (undocumented)
  ParentBlockedChange = 65580,
  // (undocumented)
  ReadError = 65581,
  // (undocumented)
  ReadOnly = 65582,
  // (undocumented)
  ReadOnlyDomain = 65583,
  // (undocumented)
  RepositoryManagerError = 65584,
  // (undocumented)
  SQLiteError = 65585,
  // (undocumented)
  Success = 0,
  // (undocumented)
  TransactionActive = 65586,
  // (undocumented)
  UnitsMissing = 65587,
  // (undocumented)
  UnknownFormat = 65588,
  // (undocumented)
  UpgradeFailed = 65589,
  // (undocumented)
  ValidationFailed = 65590,
  // (undocumented)
  VersionTooNew = 65591,
  // (undocumented)
  VersionTooOld = 65592,
  // (undocumented)
  ViewNotFound = 65593,
  // (undocumented)
  WriteError = 65594,
  // (undocumented)
  WrongClass = 65595,
  // (undocumented)
  WrongDomain = 65597,
  // (undocumented)
  WrongElement = 65598,
  // (undocumented)
  WrongHandler = 65599,
  // (undocumented)
  WrongIModel = 65596,
  // (undocumented)
  WrongModel = 65600
}

// @public
class IndexedValue<T> {
  constructor(value: T, index: number);
  // (undocumented)
  readonly index: number;
  // (undocumented)
  readonly value: T;
}

// @public
class IndexMap<T> {
  constructor(compare: OrderedComparator<T>, maximumSize?: number, clone?: CloneFunction<T>);
  // (undocumented)
  protected _array: Array<IndexedValue<T>>;
  // (undocumented)
  protected readonly _clone: CloneFunction<T>;
  // (undocumented)
  protected readonly _compareValues: OrderedComparator<T>;
  // (undocumented)
  protected readonly _maximumSize: number;
  clear(): void;
  indexOf(value: T): number;
  insert(value: T, onInsert?: (value: T) => any): number;
  readonly isEmpty: boolean;
  readonly isFull: boolean;
  readonly length: number;
  // (undocumented)
  protected lowerBound: {
    equal: boolean;
    index: number;
  }
}

// @public
module JsonUtils {
  function asArray(json: any): any;

  function asBool(json: any, defaultVal?: boolean): boolean;

  function asDouble(json: any, defaultVal?: number): number;

  function asInt(json: any, defaultVal?: number): number;

  function asObject(json: any): any;

  function asString(json: any, defaultVal?: string): string;

  function setOrRemoveBoolean(json: any, key: string, val: boolean, defaultVal: boolean): void;

  function setOrRemoveNumber(json: any, key: string, val: number, defaultVal: number): void;

  function toObject(val: any): any;

}

// @public
class Logger {
  static addActivityId(mdata: any): void;
  static configureLevels(cfg: LoggerLevelsConfig): void;
  static getLevel(category: string): LogLevel | undefined;
  static initialize(logError: LogFunction | undefined, logWarning?: LogFunction | undefined, logInfo?: LogFunction | undefined, logTrace?: LogFunction | undefined): void;
  static initializeToConsole(): void;
  static isEnabled(category: string, level: LogLevel): boolean;
  static logError(category: string, message: string, metaData?: GetMetaDataFunction): void;
  static logException(category: string, err: Error, log?: LogFunction, metaData?: GetMetaDataFunction): void;
  static logExceptionCallstacks: boolean;
  static logInfo(category: string, message: string, metaData?: GetMetaDataFunction): void;
  static logTrace(category: string, message: string, metaData?: GetMetaDataFunction): void;
  static logWarning(category: string, message: string, metaData?: GetMetaDataFunction): void;
  static makeMetaData(getMetaData?: GetMetaDataFunction): any;
  static parseLogLevel(str: string): LogLevel;
  static setLevel(category: string, minLevel: LogLevel): void;
  static setLevelDefault(minLevel: LogLevel): void;
  static turnOffCategories(): void;
  static turnOffLevelDefault(): void;
  static validateProps(config: any): void;
}

// @public
interface LoggerCategoryAndLevel {
  // (undocumented)
  category: string;
  // (undocumented)
  logLevel: string;
}

// @public
interface LoggerLevelsConfig {
  // (undocumented)
  categoryLevels?: LoggerCategoryAndLevel[];
  // (undocumented)
  defaultLevel?: string;
}

// @public
enum LogLevel {
  Error = 3,
  Info = 1,
  None = 4,
  Trace = 0,
  Warning = 2
}

// @public
export function lowerBound<T, U = T>(value: T, list: U[], compare: OrderedComparator<T, U>): {
    index: number;
    equal: boolean;
};

// @public
class LRUMap<K, V> {
  constructor(limit: number);
  assign(entries: Iterable<[K, V]>): void;
  clear(): void;
  delete(key: K): V | undefined;
  entries(): Iterator<[K, V] | undefined> | undefined;
  find(key: K): V | undefined;
  forEach(fun: (value: V, key: K, m: LRUMap<K, V>) => void, thisObj?: any): void;
  get(key: K): V | undefined;
  has(key: K): boolean;
  keys(): Iterator<K | undefined> | undefined;
  limit: number;
  newest?: Entry<K, V>;
  oldest?: Entry<K, V>;
  set(key: K, value: V): LRUMap<K, V>;
  shift(): [K, V] | undefined;
  size: number;
  toJSON(): Array<{
          key: K;
          value: V;
      }>;
  toString(): string;
  values(): Iterator<V | undefined> | undefined;
}

// @public
enum OpenMode {
  // (undocumented)
  Readonly = 1,
  // (undocumented)
  ReadWrite = 2
}

// @public
class PerfLogger implements IDisposable {
  constructor(routine: string);
  // (undocumented)
  dispose(): void;
}

// @public
class PriorityQueue<T> implements Iterable<T> {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  [Symbol.iterator](): Iterator<T>;
  constructor(compare: OrderedComparator<T>, clone?: CloneFunction<T>);
  // (undocumented)
  protected _array: T[];
  // (undocumented)
  protected readonly _clone: CloneFunction<T>;
  // (undocumented)
  protected readonly _compare: OrderedComparator<T>;
  // (undocumented)
  protected _heapify(index: number): void;
  protected _peek(index: number): T | undefined;
  protected _pop(index: number): T | undefined;
  // (undocumented)
  protected _swap(a: number, b: number): void;
  clear(): void;
  readonly front: T | undefined;
  readonly isEmpty: boolean;
  readonly length: number;
  pop(): T | undefined;
  push(value: T): T;
  sort(): void;
}

// @beta
enum RepositoryStatus {
  CannotCreateChangeSet = 86023,
  ChangeSetRequired = 86025,
  CodeNotReserved = 86027,
  CodeUnavailable = 86026,
  CodeUsed = 86028,
  InvalidRequest = 86024,
  InvalidResponse = 86020,
  LockAlreadyHeld = 86018,
  LockNotHeld = 86029,
  LockUsed = 86022,
  PendingTransactions = 86021,
  RepositoryIsLocked = 86030,
  ServerUnavailable = 86017,
  // (undocumented)
  Success = 0,
  SyncError = 86019
}

// @beta
enum RpcInterfaceStatus {
  IncompatibleVersion = 135168,
  // (undocumented)
  RPC_INTERFACE_ERROR_BASE = 135168,
  // (undocumented)
  Success = 0
}

// @public
export function shallowClone<T>(value: T): T;

// @public
class SortedArray<T> implements Iterable<T> {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  [Symbol.iterator](): Iterator<T>;
  constructor(compare: OrderedComparator<T>, allowDuplicates?: boolean, clone?: CloneFunction<T>);
  // (undocumented)
  protected readonly _allowDuplicates: boolean;
  // (undocumented)
  protected _array: T[];
  // (undocumented)
  protected readonly _clone: CloneFunction<T>;
  // (undocumented)
  protected readonly _compare: OrderedComparator<T>;
  clear(): void;
  contains(value: T): boolean;
  extractArray(): T[];
  findEqual(value: T): T | undefined;
  forEach(func: (value: T) => void): void;
  get(index: number): T | undefined;
  indexOf(value: T): number;
  insert(value: T, onInsert?: (value: T) => any): number;
  readonly isEmpty: boolean;
  readonly length: number;
  protected lowerBound: {
    equal: boolean;
    index: number;
  }
  remove(value: T): number;
}

// @beta
interface StatusCodeWithMessage<ErrorCodeType> {
  // (undocumented)
  message: string;
  // (undocumented)
  status: ErrorCodeType;
}

// @public
class StopWatch {
  constructor(description?: string | undefined, startImmediately?: boolean);
  readonly current: BeDuration;
  readonly currentSeconds: number;
  // (undocumented)
  description?: string | undefined;
  readonly elapsed: BeDuration;
  readonly elapsedSeconds: number;
  reset(): void;
  start(): void;
  stop(): BeDuration;
}

// @public
class TransientIdSequence {
  readonly next: Id64String;
}

// @public
export function using<T extends IDisposable, TResult>(resources: T | T[], func: (...r: T[]) => TResult): TResult;

// @public
export function utf8ToString(utf8: Uint8Array): string | undefined;

// @beta
enum WSStatus {
  // (undocumented)
  ClassNotFound = 98311,
  // (undocumented)
  FileNotFound = 98314,
  // (undocumented)
  InstanceNotFound = 98313,
  // (undocumented)
  LoginFailed = 98306,
  // (undocumented)
  LoginRequired = 98319,
  // (undocumented)
  NoClientLicense = 98317,
  // (undocumented)
  NoServerLicense = 98316,
  // (undocumented)
  NotEnoughRights = 98308,
  // (undocumented)
  NotSupported = 98315,
  // (undocumented)
  PropertyNotFound = 98312,
  // (undocumented)
  RepositoryNotFound = 98309,
  // (undocumented)
  SchemaNotFound = 98310,
  // (undocumented)
  SslRequired = 98307,
  // (undocumented)
  Success = 0,
  // (undocumented)
  TooManyBadLoginAttempts = 98318,
  // (undocumented)
  Unknown = 98305,
  // (undocumented)
  WSERROR_BASE = 98304
}

// WARNING: Unsupported export: Listener
// WARNING: Unsupported export: GetMetaDataFunction
// WARNING: Unsupported export: OrderedComparator
// WARNING: Unsupported export: DisposeFunc
// WARNING: Unsupported export: Id64String
// WARNING: Unsupported export: GuidString
// WARNING: Unsupported export: Id64Set
// WARNING: Unsupported export: Id64Array
// WARNING: Unsupported export: Id64Arg
// WARNING: Unsupported export: LogFunction
// WARNING: Unsupported export: CloneFunction
// WARNING: Unsupported export: ComputePriorityFunction
// (No @packagedocumentation comment for this package)
