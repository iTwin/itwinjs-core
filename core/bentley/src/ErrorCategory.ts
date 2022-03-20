/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Errors
 */

import {
  AuthStatus,
  BentleyError,
  BentleyStatus,
  BriefcaseStatus,
  ChangeSetStatus,
  GeoServiceStatus,
  HttpStatus,
  IModelHubStatus,
  IModelStatus,
  RealityDataStatus,
  RepositoryStatus,
  RpcInterfaceStatus,
} from "./BentleyError";

/* eslint-disable @typescript-eslint/no-shadow */

/** @alpha */
export type ErrorCategoryHandler = (error: BentleyError) => ErrorCategory | undefined;

/** A group of related errors for aggregate reporting purposes.
 * @alpha
 */
export abstract class ErrorCategory {
  public static handlers: Set<ErrorCategoryHandler> = new Set();

  public static for(error: BentleyError): ErrorCategory {
    for (const handler of this.handlers) {
      const category = handler(error);
      if (category) {
        return category;
      }
    }

    return lookupCategory(error);
  }

  public abstract name: string;
  public abstract code: number;
}

namespace HTTP {
  export enum Successful {
    OK = 200,
  }

  export enum ClientError {
    BadRequest = 400,
    Unauthorized = 401,
    Forbidden = 403,
    NotFound = 404,
    MethodNotAllowed = 405,
    NotAcceptable = 406,
    Conflict = 409,
    Gone = 410,
    PreconditionFailed = 412,
    ExpectationFailed = 417,
    MisdirectedRequest = 421,
    UnprocessableEntity = 422,
    Locked = 423,
    FailedDependency = 424,
    UpgradeRequired = 426,
    PreconditionRequired = 428
  }

  export enum ServerError {
    InternalServerError = 500,
    NotImplemented = 501,
  }
}

class Already extends ErrorCategory { }
class Bad extends ErrorCategory { }
class Invalid extends ErrorCategory { }
class Cannot extends ErrorCategory { }
class NotReserved extends ErrorCategory { }
class Prohibited extends ErrorCategory { }
class Duplicate extends ErrorCategory { }
class Blocked extends ErrorCategory { }
class NotFound extends ErrorCategory { }
class Constraint extends ErrorCategory { }
class Exists extends ErrorCategory { }
class FileSystem extends ErrorCategory { }
class State extends ErrorCategory { }
class Mismatch extends ErrorCategory { }
class Missing extends ErrorCategory { }
class Nothing extends ErrorCategory { }
class NotEnabled extends ErrorCategory { }
class NotRegistered extends ErrorCategory { }
class No extends ErrorCategory { }
class Blocked extends ErrorCategory { }
class ReadOnly extends ErrorCategory { }
class Unknown extends ErrorCategory { }
class Failed extends ErrorCategory { }
class Version extends ErrorCategory { }
class Wrong extends ErrorCategory { }
class Timeout extends ErrorCategory { }
class NoContent extends ErrorCategory { }
class Cancelled extends ErrorCategory { }
class Corruption extends ErrorCategory { }
class CouldNot extends ErrorCategory { }
class Directive extends ErrorCategory { }
class Unavailable extends ErrorCategory { }
class Expired extends ErrorCategory { }
class Required extends ErrorCategory { }
class Locked extends ErrorCategory { }
class Permissions extends ErrorCategory { }
class Throttled extends ErrorCategory { }
class Conflict extends ErrorCategory { }
class Argument extends ErrorCategory { }
class NotSupported extends ErrorCategory { }
class Error extends ErrorCategory { }
class Pending extends ErrorCategory { }
class Conversions extends ErrorCategory { }
class Systems extends ErrorCategory { }
class Internal extends ErrorCategory { }
class InputOutput extends ErrorCategory { }
class Success extends ErrorCategory { }

function lookupCategory(error: BentleyError) {
  switch (error.errorNumber) {
    case IModelStatus.AlreadyLoaded: return new Already();
    case IModelStatus.AlreadyOpen: return new Already();
    case IModelStatus.BadArg: return new Bad();
    case IModelStatus.BadElement: return new Bad();
    case IModelStatus.BadModel: return new Bad();
    case IModelStatus.BadRequest: return new Bad();
    case IModelStatus.BadSchema: return new Bad();
    case IModelStatus.CannotUndo: return new Cannot();
    case IModelStatus.CodeNotReserved: return new NotReserved();
    case IModelStatus.DeletionProhibited: return new Prohibited();
    case IModelStatus.DuplicateCode: return new Duplicate();
    case IModelStatus.DuplicateName: return new Duplicate();
    case IModelStatus.ElementBlockedChange: return new Blocked();
    case IModelStatus.FileAlreadyExists: return new Already();
    case IModelStatus.FileNotFound: return new NotFound();
    case IModelStatus.FileNotLoaded: return new FileSystem();
    case IModelStatus.ForeignKeyConstraint: return new Constraint();
    case IModelStatus.IdExists: return new Already();
    case IModelStatus.InDynamicTransaction: return new State();
    case IModelStatus.InvalidCategory: return new Invalid();
    case IModelStatus.InvalidCode: return new Invalid();
    case IModelStatus.InvalidCodeSpec: return new Invalid();
    case IModelStatus.InvalidId: return new Invalid();
    case IModelStatus.InvalidName: return new Invalid();
    case IModelStatus.InvalidParent: return new Invalid();
    case IModelStatus.InvalidProfileVersion: return new Invalid();
    case IModelStatus.IsCreatingChangeSet: return new State();
    case IModelStatus.LockNotHeld: return new NotReserved();
    case IModelStatus.Mismatch2d3d: return new Mismatch();
    case IModelStatus.MismatchGcs: return new Mismatch();
    case IModelStatus.MissingDomain: return new Missing();
    case IModelStatus.MissingHandler: return new Missing();
    case IModelStatus.MissingId: return new Missing();
    case IModelStatus.NoGeometry: return new No();
    case IModelStatus.NoMultiTxnOperation: return new No();
    case IModelStatus.NotEnabled: return new NotEnabled();
    case IModelStatus.NotFound: return new NotFound();
    case IModelStatus.NotOpen: return new State();
    case IModelStatus.NotOpenForWrite: return new State();
    case IModelStatus.NotSameUnitBase: return new Mismatch();
    case IModelStatus.NothingToRedo: return new Nothing();
    case IModelStatus.NothingToUndo: return new Nothing();
    case IModelStatus.ParentBlockedChange: return new Blocked();
    case IModelStatus.ReadError: return new FileSystem();
    case IModelStatus.ReadOnly: return new ReadOnly();
    case IModelStatus.ReadOnlyDomain: return new ReadOnly();
    case IModelStatus.RepositoryManagerError: return new Systems();
    case IModelStatus.SQLiteError: return new Systems();
    case IModelStatus.TransactionActive: return new State();
    case IModelStatus.UnitsMissing: return new Missing();
    case IModelStatus.UnknownFormat: return new Unknown();
    case IModelStatus.UpgradeFailed: return new Failed();
    case IModelStatus.ValidationFailed: return new Failed();
    case IModelStatus.VersionTooNew: return new Version();
    case IModelStatus.VersionTooOld: return new Version();
    case IModelStatus.ViewNotFound: return new NotFound();
    case IModelStatus.WriteError: return new FileSystem();
    case IModelStatus.WrongClass: return new Wrong();
    case IModelStatus.WrongIModel: return new Wrong();
    case IModelStatus.WrongDomain: return new Wrong();
    case IModelStatus.WrongElement: return new Wrong();
    case IModelStatus.WrongHandler: return new Wrong();
    case IModelStatus.WrongModel: return new Wrong();
    case IModelStatus.ConstraintNotUnique: return new Constraint();
    case IModelStatus.NoGeoLocation: return new No();
    case IModelStatus.ServerTimeout: return new Timeout();
    case IModelStatus.NoContent: return new NoContent();
    case IModelStatus.NotRegistered: return new NotRegistered();
    case IModelStatus.FunctionNotFound: return new NotFound();
    case IModelStatus.NoActiveCommand: return new State();
    case BriefcaseStatus.CannotAcquire: return new Cannot();
    case BriefcaseStatus.CannotDownload: return new Cannot();
    case BriefcaseStatus.CannotUpload: return new Cannot();
    case BriefcaseStatus.CannotCopy: return new Cannot();
    case BriefcaseStatus.CannotDelete: return new Cannot();
    case BriefcaseStatus.VersionNotFound: return new NotFound();
    case BriefcaseStatus.CannotApplyChanges: return new Cannot();
    case BriefcaseStatus.DownloadCancelled: return new Cancelled();
    case BriefcaseStatus.ContainsDeletedChangeSets: return new error();
    case RpcInterfaceStatus.IncompatibleVersion: return new Version();
    case ChangeSetStatus.ApplyError: return new error();
    case ChangeSetStatus.ChangeTrackingNotEnabled: return new NotEnabled();
    case ChangeSetStatus.CorruptedChangeStream: return new Corruption();
    case ChangeSetStatus.FileNotFound: return new NotFound();
    case ChangeSetStatus.FileWriteError: return new FileSystem();
    case ChangeSetStatus.HasLocalChanges: return new State();
    case ChangeSetStatus.HasUncommittedChanges: return new State();
    case ChangeSetStatus.InvalidId: return new Invalid();
    case ChangeSetStatus.InvalidVersion: return new Invalid();
    case ChangeSetStatus.InDynamicTransaction: return new State();
    case ChangeSetStatus.IsCreatingChangeSet: return new State();
    case ChangeSetStatus.IsNotCreatingChangeSet: return new State();
    case ChangeSetStatus.MergePropagationError: return new error();
    case ChangeSetStatus.NothingToMerge: return new Nothing();
    case ChangeSetStatus.NoTransactions: return new No();
    case ChangeSetStatus.ParentMismatch: return new Mismatch();
    case ChangeSetStatus.SQLiteError: return new Systems();
    case ChangeSetStatus.WrongDgnDb: return new Wrong();
    case ChangeSetStatus.CouldNotOpenDgnDb: return new CouldNot();
    case ChangeSetStatus.MergeSchemaChangesOnOpen: return new Directive();
    case ChangeSetStatus.ReverseOrReinstateSchemaChanges: return new Directive();
    case ChangeSetStatus.ProcessSchemaChangesOnOpen: return new Directive();
    case ChangeSetStatus.CannotMergeIntoReadonly: return new Cannot();
    case ChangeSetStatus.CannotMergeIntoMaster: return new Cannot();
    case ChangeSetStatus.CannotMergeIntoReversed: return new Cannot();
    case RepositoryStatus.ServerUnavailable: return new Unavailable();
    case RepositoryStatus.LockAlreadyHeld: return new Already();
    case RepositoryStatus.SyncError: return new error();
    case RepositoryStatus.InvalidResponse: return new Invalid();
    case RepositoryStatus.PendingTransactions: return new State();
    case RepositoryStatus.LockUsed: return new Conflict();
    case RepositoryStatus.CannotCreateChangeSet: return new Cannot();
    case RepositoryStatus.InvalidRequest: return new Invalid();
    case RepositoryStatus.ChangeSetRequired: return new Required();
    case RepositoryStatus.CodeUnavailable: return new Unavailable();
    case RepositoryStatus.CodeNotReserved: return new NotReserved();
    case RepositoryStatus.CodeUsed: return new Conflict();
    case RepositoryStatus.LockNotHeld: return new State();
    case RepositoryStatus.RepositoryIsLocked: return new Locked();
    case RepositoryStatus.ChannelConstraintViolation: return new Constraint();
    case IModelHubStatus.Unknown: return new Unknown();
    case IModelHubStatus.MissingRequiredProperties: return new Missing();
    case IModelHubStatus.InvalidPropertiesValues: return new Invalid();
    case IModelHubStatus.UserDoesNotHavePermission: return new Permissions();
    case IModelHubStatus.UserDoesNotHaveAccess: return new Permissions();
    case IModelHubStatus.InvalidBriefcase: return new Invalid();
    case IModelHubStatus.BriefcaseDoesNotExist: return new Unknown();
    case IModelHubStatus.BriefcaseDoesNotBelongToUser: return new Permissions();
    case IModelHubStatus.AnotherUserPushing: return new State();
    case IModelHubStatus.ChangeSetAlreadyExists: return new Already();
    case IModelHubStatus.ChangeSetDoesNotExist: return new Unknown();
    case IModelHubStatus.FileIsNotUploaded: return new State();
    case IModelHubStatus.iModelIsNotInitialized: return new State();
    case IModelHubStatus.ChangeSetPointsToBadSeed: return new Bad();
    case IModelHubStatus.OperationFailed: return new Failed();
    case IModelHubStatus.PullIsRequired: return new State();
    case IModelHubStatus.MaximumNumberOfBriefcasesPerUser: return new Throttled();
    case IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute: return new Throttled();
    case IModelHubStatus.DatabaseTemporarilyLocked: return new Throttled();
    case IModelHubStatus.iModelIsLocked: return new Locked();
    case IModelHubStatus.CodesExist: return new Already();
    case IModelHubStatus.LocksExist: return new Already();
    case IModelHubStatus.iModelAlreadyExists: return new Already();
    case IModelHubStatus.iModelDoesNotExist: return new Unknown();
    case IModelHubStatus.FileDoesNotExist: return new Unknown();
    case IModelHubStatus.FileAlreadyExists: return new Already();
    case IModelHubStatus.LockDoesNotExist: return new Unknown();
    case IModelHubStatus.LockOwnedByAnotherBriefcase: return new Conflict();
    case IModelHubStatus.CodeStateInvalid: return new Invalid();
    case IModelHubStatus.CodeReservedByAnotherBriefcase: return new Conflict();
    case IModelHubStatus.CodeDoesNotExist: return new Unknown();
    case IModelHubStatus.EventTypeDoesNotExist: return new Unknown();
    case IModelHubStatus.EventSubscriptionDoesNotExist: return new Unknown();
    case IModelHubStatus.EventSubscriptionAlreadyExists: return new Already();
    case IModelHubStatus.ITwinIdIsNotSpecified: return new Argument();
    case IModelHubStatus.FailedToGetITwinPermissions: return new Failed();
    case IModelHubStatus.FailedToGetITwinMembers: return new Failed();
    case IModelHubStatus.ChangeSetAlreadyHasVersion: return new Already();
    case IModelHubStatus.VersionAlreadyExists: return new Already();
    case IModelHubStatus.JobSchedulingFailed: return new Internal();
    case IModelHubStatus.ConflictsAggregate: return new Conflict();
    case IModelHubStatus.FailedToGetITwinById: return new Failed();
    case IModelHubStatus.DatabaseOperationFailed: return new Failed();
    case IModelHubStatus.SeedFileInitializationFailed: return new Failed();
    case IModelHubStatus.FailedToGetAssetPermissions: return new Failed();
    case IModelHubStatus.FailedToGetAssetMembers: return new Failed();
    case IModelHubStatus.ITwinDoesNotExist: return new Unknown();
    case IModelHubStatus.LockChunkDoesNotExist: return new Unknown();
    case IModelHubStatus.CheckpointAlreadyExists: return new Already();
    case IModelHubStatus.CheckpointDoesNotExist: return new Unknown();
    case IModelHubStatus.UndefinedArgumentError: return new Argument();
    case IModelHubStatus.InvalidArgumentError: return new Argument();
    case IModelHubStatus.MissingDownloadUrlError: return new Argument();
    case IModelHubStatus.NotSupportedInBrowser: return new NotSupported();
    case IModelHubStatus.FileHandlerNotSet: return new Internal();
    case IModelHubStatus.FileNotFound: return new NotFound();
    case IModelHubStatus.InitializationTimeout: return new Timeout();
    case AuthStatus.Error: return new Error();
    case GeoServiceStatus.NoGeoLocation: return new No();
    case GeoServiceStatus.OutOfUsefulRange: return new InputOutput();
    case GeoServiceStatus.OutOfMathematicalDomain: return new InputOutput();
    case GeoServiceStatus.NoDatumConverter: return new No();
    case GeoServiceStatus.VerticalDatumConvertError: return new Conversions();
    case GeoServiceStatus.CSMapError: return new Systems();
    case GeoServiceStatus.Pending: return new Pending();
    case RealityDataStatus.InvalidData: return new Invalid();

    case BentleyStatus.SUCCESS: return new Success();
    case IModelStatus.Success: return new Success();
    case RpcInterfaceStatus.Success: return new Success();
    case ChangeSetStatus.Success: return new Success();
    case RepositoryStatus.Success: return new Success();
    case HttpStatus.Success: return new Success();
    case IModelHubStatus.Success: return new Success();
    case AuthStatus.Success: return new Success();
    case GeoServiceStatus.Success: return new Success();

    case BentleyStatus.ERROR: return new error();

    default: return new error();
  }
}
