/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Errors
 */

import {
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
export type StatusCategoryHandler = (error: Error) => StatusCategory | undefined;

/** A group of related statuses for aggregate reporting purposes.
 * @alpha
 */
export abstract class StatusCategory {
  public static handlers: Set<StatusCategoryHandler> = new Set();

  public static for(error: Error): StatusCategory {
    for (const handler of this.handlers) {
      const category = handler(error);
      if (category) {
        return category;
      }
    }

    const errorNumber = (error as BentleyError).errorNumber as unknown;
    if (typeof errorNumber === "number")
      return lookupHttpStatusCategory(errorNumber);

    return new UnknownError();
  }

  public abstract name: string;
  public abstract code: number;
  public abstract error: boolean;
}

/***
 * A success status.
 * @alpha
 */
export abstract class SuccessCategory extends StatusCategory {
  public error = false;
}

/**
 * An error status.
 * @alpha
 */
export abstract class ErrorCategory extends StatusCategory {
  public error = true;
}

namespace HTTP {
  export class OK extends SuccessCategory { public name = "OK"; public code = 200; }
  export class Accepted extends SuccessCategory { public name = "Accepted"; public code = 202; }
  export class NoContent extends SuccessCategory { public name = "NoContent"; public code = 204; }

  export class BadRequest extends ErrorCategory { public name = "BadRequest"; public code = 400; }
  export class Unauthorized extends ErrorCategory { public name = "Unauthorized"; public code = 401; }
  export class Forbidden extends ErrorCategory { public name = "Forbidden"; public code = 403; }
  export class NotFound extends ErrorCategory { public name = "NotFound"; public code = 404; }
  export class RequestTimeout extends ErrorCategory { public name = "RequestTimeout"; public code = 408; }
  export class Conflict extends ErrorCategory { public name = "Conflict"; public code = 409; }
  export class Gone extends ErrorCategory { public name = "Gone"; public code = 410; }
  export class PreconditionFailed extends ErrorCategory { public name = "PreconditionFailed"; public code = 412; }
  export class ExpectationFailed extends ErrorCategory { public name = "ExpectationFailed"; public code = 417; }
  export class MisdirectedRequest extends ErrorCategory { public name = "MisdirectedRequest"; public code = 421; }
  export class UnprocessableEntity extends ErrorCategory { public name = "UnprocessableEntity"; public code = 422; }
  export class UpgradeRequired extends ErrorCategory { public name = "UpgradeRequired"; public code = 426; }
  export class PreconditionRequired extends ErrorCategory { public name = "PreconditionRequired"; public code = 428; }
  export class TooManyRequests extends ErrorCategory { public name = "TooManyRequests"; public code = 429; }

  export class InternalServerError extends ErrorCategory { public name = "InternalServerError"; public code = 500; }
  export class NotImplemented extends ErrorCategory { public name = "NotImplemented"; public code = 501; }
}

class Success extends HTTP.OK { }

class Pending extends HTTP.Accepted { }

class NoContent extends HTTP.NoContent { }
class NothingToDo extends HTTP.NoContent { }

class BadRequest extends HTTP.BadRequest { }

class Forbidden extends HTTP.Forbidden { }
class PermissionsViolation extends HTTP.Forbidden { }
class ReadOnly extends HTTP.Forbidden { }

class NotFound extends HTTP.NotFound { }

class NotEnabled extends HTTP.UnprocessableEntity { }
class NotSupported extends HTTP.UnprocessableEntity { }

class ValidationError extends HTTP.BadRequest { }

class Timeout extends HTTP.RequestTimeout { }

class Conflict extends HTTP.Conflict { }

class Cancelled extends HTTP.Gone { }

class ConstraintViolation extends HTTP.Forbidden { }
class VersioningViolation extends HTTP.Forbidden { }

class Corruption extends HTTP.InternalServerError { }
class InvalidData extends HTTP.InternalServerError { }
class OperationFailed extends HTTP.InternalServerError { }
class StateViolation extends HTTP.InternalServerError { }

class Locked extends HTTP.Conflict { }

class NetworkError extends HTTP.InternalServerError { }

class Throttled extends HTTP.TooManyRequests { }

class FileSystemError extends HTTP.InternalServerError { }
class InternalError extends HTTP.InternalServerError { }
class UnknownError extends HTTP.InternalServerError { }

class NotImplemented extends HTTP.NotImplemented { }

class Aborted extends HTTP.BadRequest { }

function lookupHttpStatusCategory(statusCode: number): StatusCategory {
  switch (statusCode) {
    case BentleyStatus.SUCCESS: return new Success();
    case BentleyStatus.ERROR: return new UnknownError();

    case IModelStatus.Success: return new Success();
    case IModelStatus.AlreadyLoaded: return new StateViolation();
    case IModelStatus.AlreadyOpen: return new StateViolation();
    case IModelStatus.BadArg: return new ValidationError();
    case IModelStatus.BadElement: return new ValidationError();
    case IModelStatus.BadModel: return new ValidationError();
    case IModelStatus.BadRequest: return new BadRequest();
    case IModelStatus.BadSchema: return new ValidationError();
    case IModelStatus.CannotUndo: return new OperationFailed();
    case IModelStatus.CodeNotReserved: return new StateViolation();
    case IModelStatus.DeletionProhibited: return new Forbidden();
    case IModelStatus.DuplicateCode: return new Conflict();
    case IModelStatus.DuplicateName: return new Conflict();
    case IModelStatus.ElementBlockedChange: return new ConstraintViolation();
    case IModelStatus.FileAlreadyExists: return new Conflict();
    case IModelStatus.FileNotFound: return new NotFound();
    case IModelStatus.FileNotLoaded: return new FileSystemError();
    case IModelStatus.ForeignKeyConstraint: return new ConstraintViolation();
    case IModelStatus.IdExists: return new Conflict();
    case IModelStatus.InDynamicTransaction: return new StateViolation();
    case IModelStatus.InvalidCategory: return new ValidationError();
    case IModelStatus.InvalidCode: return new ValidationError();
    case IModelStatus.InvalidCodeSpec: return new ValidationError();
    case IModelStatus.InvalidId: return new ValidationError();
    case IModelStatus.InvalidName: return new ValidationError();
    case IModelStatus.InvalidParent: return new Conflict();
    case IModelStatus.InvalidProfileVersion: return new InvalidData();
    case IModelStatus.IsCreatingChangeSet: return new StateViolation();
    case IModelStatus.LockNotHeld: return new Forbidden();
    case IModelStatus.Mismatch2d3d: return new ValidationError();
    case IModelStatus.MismatchGcs: return new ValidationError();
    case IModelStatus.MissingDomain: return new ValidationError();
    case IModelStatus.MissingHandler: return new ValidationError();
    case IModelStatus.MissingId: return new ValidationError();
    case IModelStatus.NoGeometry: return new NoContent();
    case IModelStatus.NoMultiTxnOperation: return new StateViolation();
    case IModelStatus.NotEnabled: return new NotEnabled();
    case IModelStatus.NotFound: return new NotFound();
    case IModelStatus.NotOpen: return new StateViolation();
    case IModelStatus.NotOpenForWrite: return new Forbidden();
    case IModelStatus.NotSameUnitBase: return new ValidationError();
    case IModelStatus.NothingToRedo: return new NothingToDo();
    case IModelStatus.NothingToUndo: return new NothingToDo();
    case IModelStatus.ParentBlockedChange: return new Forbidden();
    case IModelStatus.ReadError: return new FileSystemError();
    case IModelStatus.ReadOnly: return new ReadOnly();
    case IModelStatus.ReadOnlyDomain: return new ReadOnly();
    case IModelStatus.RepositoryManagerError: return new NetworkError();
    case IModelStatus.SQLiteError: return new InternalError();
    case IModelStatus.TransactionActive: return new StateViolation();
    case IModelStatus.UnitsMissing: return new ValidationError();
    case IModelStatus.UnknownFormat: return new InvalidData();
    case IModelStatus.UpgradeFailed: return new OperationFailed();
    case IModelStatus.ValidationFailed: return new ValidationError();
    case IModelStatus.VersionTooNew: return new VersioningViolation();
    case IModelStatus.VersionTooOld: return new VersioningViolation();
    case IModelStatus.ViewNotFound: return new NotFound();
    case IModelStatus.WriteError: return new FileSystemError();
    case IModelStatus.WrongClass: return new ValidationError();
    case IModelStatus.WrongIModel: return new ValidationError();
    case IModelStatus.WrongDomain: return new ValidationError();
    case IModelStatus.WrongElement: return new ValidationError();
    case IModelStatus.WrongHandler: return new ValidationError();
    case IModelStatus.WrongModel: return new ValidationError();
    case IModelStatus.ConstraintNotUnique: return new ConstraintViolation();
    case IModelStatus.NoGeoLocation: return new ValidationError();
    case IModelStatus.ServerTimeout: return new Timeout();
    case IModelStatus.NoContent: return new NoContent();
    case IModelStatus.NotRegistered: return new NotImplemented();
    case IModelStatus.FunctionNotFound: return new NotImplemented();
    case IModelStatus.NoActiveCommand: return new StateViolation();
    case IModelStatus.Aborted: return new Aborted();

    case BriefcaseStatus.CannotAcquire: return new OperationFailed();
    case BriefcaseStatus.CannotDownload: return new OperationFailed();
    case BriefcaseStatus.CannotUpload: return new OperationFailed();
    case BriefcaseStatus.CannotCopy: return new OperationFailed();
    case BriefcaseStatus.CannotDelete: return new OperationFailed();
    case BriefcaseStatus.VersionNotFound: return new NotFound();
    case BriefcaseStatus.CannotApplyChanges: return new OperationFailed();
    case BriefcaseStatus.DownloadCancelled: return new Cancelled();
    case BriefcaseStatus.ContainsDeletedChangeSets: return new ValidationError();

    case RpcInterfaceStatus.Success: return new Success();
    case RpcInterfaceStatus.IncompatibleVersion: return new VersioningViolation();

    case ChangeSetStatus.Success: return new Success();
    case ChangeSetStatus.ApplyError: return new OperationFailed();
    case ChangeSetStatus.ChangeTrackingNotEnabled: return new NotEnabled();
    case ChangeSetStatus.CorruptedChangeStream: return new Corruption();
    case ChangeSetStatus.FileNotFound: return new NotFound();
    case ChangeSetStatus.FileWriteError: return new FileSystemError();
    case ChangeSetStatus.HasLocalChanges: return new StateViolation();
    case ChangeSetStatus.HasUncommittedChanges: return new StateViolation();
    case ChangeSetStatus.InvalidId: return new Corruption();
    case ChangeSetStatus.InvalidVersion: return new Corruption();
    case ChangeSetStatus.InDynamicTransaction: return new StateViolation();
    case ChangeSetStatus.IsCreatingChangeSet: return new StateViolation();
    case ChangeSetStatus.IsNotCreatingChangeSet: return new StateViolation();
    case ChangeSetStatus.MergePropagationError: return new OperationFailed();
    case ChangeSetStatus.NothingToMerge: return new NothingToDo();
    case ChangeSetStatus.NoTransactions: return new OperationFailed();
    case ChangeSetStatus.ParentMismatch: return new ValidationError();
    case ChangeSetStatus.SQLiteError: return new InternalError();
    case ChangeSetStatus.WrongDgnDb: return new ValidationError();
    case ChangeSetStatus.CouldNotOpenDgnDb: return new OperationFailed();
    case ChangeSetStatus.MergeSchemaChangesOnOpen: return new BadRequest();
    case ChangeSetStatus.ReverseOrReinstateSchemaChanges: return new Conflict();
    case ChangeSetStatus.ProcessSchemaChangesOnOpen: return new BadRequest();
    case ChangeSetStatus.CannotMergeIntoReadonly: return new ValidationError();
    case ChangeSetStatus.CannotMergeIntoMaster: return new ValidationError();
    case ChangeSetStatus.CannotMergeIntoReversed: return new ValidationError();

    case RepositoryStatus.Success: return new Success();
    case RepositoryStatus.ServerUnavailable: return new NetworkError();
    case RepositoryStatus.LockAlreadyHeld: return new Conflict();
    case RepositoryStatus.SyncError: return new NetworkError();
    case RepositoryStatus.InvalidResponse: return new NetworkError();
    case RepositoryStatus.PendingTransactions: return new StateViolation();
    case RepositoryStatus.LockUsed: return new StateViolation();
    case RepositoryStatus.CannotCreateChangeSet: return new InternalError();
    case RepositoryStatus.InvalidRequest: return new NetworkError();
    case RepositoryStatus.ChangeSetRequired: return new StateViolation();
    case RepositoryStatus.CodeUnavailable: return new Conflict();
    case RepositoryStatus.CodeNotReserved: return new StateViolation();
    case RepositoryStatus.CodeUsed: return new StateViolation();
    case RepositoryStatus.LockNotHeld: return new Forbidden();
    case RepositoryStatus.RepositoryIsLocked: return new Locked();
    case RepositoryStatus.ChannelConstraintViolation: return new ConstraintViolation();

    case HttpStatus.Success: return new Success();

    case IModelHubStatus.Success: return new Success();
    case IModelHubStatus.Unknown: return new UnknownError();
    case IModelHubStatus.MissingRequiredProperties: return new ValidationError();
    case IModelHubStatus.InvalidPropertiesValues: return new ValidationError();
    case IModelHubStatus.UserDoesNotHavePermission: return new PermissionsViolation();
    case IModelHubStatus.UserDoesNotHaveAccess: return new PermissionsViolation();
    case IModelHubStatus.InvalidBriefcase: return new ValidationError();
    case IModelHubStatus.BriefcaseDoesNotExist: return new NotFound();
    case IModelHubStatus.BriefcaseDoesNotBelongToUser: return new PermissionsViolation();
    case IModelHubStatus.AnotherUserPushing: return new StateViolation();
    case IModelHubStatus.ChangeSetAlreadyExists: return new Conflict();
    case IModelHubStatus.ChangeSetDoesNotExist: return new NotFound();
    case IModelHubStatus.FileIsNotUploaded: return new StateViolation();
    case IModelHubStatus.iModelIsNotInitialized: return new StateViolation();
    case IModelHubStatus.ChangeSetPointsToBadSeed: return new InvalidData();
    case IModelHubStatus.OperationFailed: return new OperationFailed();
    case IModelHubStatus.PullIsRequired: return new StateViolation();
    case IModelHubStatus.MaximumNumberOfBriefcasesPerUser: return new Throttled();
    case IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute: return new Throttled();
    case IModelHubStatus.DatabaseTemporarilyLocked: return new Locked();
    case IModelHubStatus.iModelIsLocked: return new Locked();
    case IModelHubStatus.CodesExist: return new Conflict();
    case IModelHubStatus.LocksExist: return new Conflict();
    case IModelHubStatus.iModelAlreadyExists: return new Conflict();
    case IModelHubStatus.iModelDoesNotExist: return new NotFound();
    case IModelHubStatus.FileDoesNotExist: return new NotFound();
    case IModelHubStatus.FileAlreadyExists: return new Conflict();
    case IModelHubStatus.LockDoesNotExist: return new NotFound();
    case IModelHubStatus.LockOwnedByAnotherBriefcase: return new Conflict();
    case IModelHubStatus.CodeStateInvalid: return new StateViolation();
    case IModelHubStatus.CodeReservedByAnotherBriefcase: return new Conflict();
    case IModelHubStatus.CodeDoesNotExist: return new NotFound();
    case IModelHubStatus.EventTypeDoesNotExist: return new NotFound();
    case IModelHubStatus.EventSubscriptionDoesNotExist: return new NotFound();
    case IModelHubStatus.EventSubscriptionAlreadyExists: return new StateViolation();
    case IModelHubStatus.ITwinIdIsNotSpecified: return new ValidationError();
    case IModelHubStatus.FailedToGetITwinPermissions: return new OperationFailed();
    case IModelHubStatus.FailedToGetITwinMembers: return new OperationFailed();
    case IModelHubStatus.ChangeSetAlreadyHasVersion: return new Conflict();
    case IModelHubStatus.VersionAlreadyExists: return new Conflict();
    case IModelHubStatus.JobSchedulingFailed: return new InternalError();
    case IModelHubStatus.ConflictsAggregate: return new Conflict();
    case IModelHubStatus.FailedToGetITwinById: return new OperationFailed();
    case IModelHubStatus.DatabaseOperationFailed: return new OperationFailed();
    case IModelHubStatus.SeedFileInitializationFailed: return new OperationFailed();
    case IModelHubStatus.FailedToGetAssetPermissions: return new OperationFailed();
    case IModelHubStatus.FailedToGetAssetMembers: return new OperationFailed();
    case IModelHubStatus.ITwinDoesNotExist: return new NotFound();
    case IModelHubStatus.LockChunkDoesNotExist: return new NotFound();
    case IModelHubStatus.CheckpointAlreadyExists: return new Conflict();
    case IModelHubStatus.CheckpointDoesNotExist: return new NotFound();
    case IModelHubStatus.UndefinedArgumentError: return new ValidationError();
    case IModelHubStatus.InvalidArgumentError: return new ValidationError();
    case IModelHubStatus.MissingDownloadUrlError: return new ValidationError();
    case IModelHubStatus.NotSupportedInBrowser: return new NotSupported();
    case IModelHubStatus.FileHandlerNotSet: return new NotImplemented();
    case IModelHubStatus.FileNotFound: return new NotFound();
    case IModelHubStatus.InitializationTimeout: return new Timeout();

    case GeoServiceStatus.Success: return new Success();
    case GeoServiceStatus.NoGeoLocation: return new ValidationError();
    case GeoServiceStatus.OutOfUsefulRange: return new ValidationError();
    case GeoServiceStatus.OutOfMathematicalDomain: return new ValidationError();
    case GeoServiceStatus.NoDatumConverter: return new OperationFailed();
    case GeoServiceStatus.VerticalDatumConvertError: return new OperationFailed();
    case GeoServiceStatus.CSMapError: return new InternalError();
    case GeoServiceStatus.Pending: return new Pending();

    case RealityDataStatus.Success: return new Success();
    case RealityDataStatus.InvalidData: return new InvalidData();

    default: return new UnknownError();
  }
}
