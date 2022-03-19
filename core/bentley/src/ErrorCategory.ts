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

class Success extends ErrorCategory { public name = "Success"; public code = HTTP.Successful.OK; }

class BadRequest extends ErrorCategory { public name = "BadRequest"; public code = HTTP.ClientError.BadRequest; }
class Forbidden extends ErrorCategory { public name = "Forbidden"; public code = HTTP.ClientError.Forbidden; }
class Conflict extends ErrorCategory { public name = "Conflict"; public code = HTTP.ClientError.Conflict; }
class PreconditionFailed extends ErrorCategory { public name = "PreconditionFailed"; public code = HTTP.ClientError.PreconditionFailed; }
class UnprocessableEntity extends ErrorCategory { public name = "UnprocessableEntity"; public code = HTTP.ClientError.UnprocessableEntity; }

class Failed extends ErrorCategory { public name = "Failed"; public code = HTTP.ServerError.InternalServerError; }
class Unknown extends ErrorCategory { public name = "Unknown"; public code = HTTP.ServerError.NotImplemented; }

function lookupCategory(error: BentleyError) {
  switch (error.errorNumber) {
    case IModelStatus.AlreadyLoaded:
    case IModelStatus.AlreadyOpen:
      return new UnprocessableEntity();

    case IModelStatus.BadArg:
    case IModelStatus.BadElement:
    case IModelStatus.BadModel:
    case IModelStatus.BadRequest:
    case IModelStatus.BadSchema:
      return new BadRequest();

    case IModelStatus.CannotUndo:
      return new Conflict();

    case IModelStatus.CodeNotReserved:
      return new PreconditionFailed();

    case IModelStatus.DeletionProhibited:
      return new Forbidden();

    case IModelStatus.DuplicateCode:
      return new error()

    case IModelStatus.DuplicateName:
      return new error()

    case IModelStatus.ElementBlockedChange:
      return new error()

    case IModelStatus.FileAlreadyExists:
      return new error()

    case IModelStatus.FileNotFound:
      return new error()

    case IModelStatus.FileNotLoaded:
      return new error()

    case IModelStatus.ForeignKeyConstraint:
      return new error()

    case IModelStatus.IdExists:
      return new error()

    case IModelStatus.InDynamicTransaction:
      return new error()

    case IModelStatus.InvalidCategory:
      return new error()

    case IModelStatus.InvalidCode:
      return new error()

    case IModelStatus.InvalidCodeSpec:
      return new error()

    case IModelStatus.InvalidId:
      return new error()

    case IModelStatus.InvalidName:
      return new error()

    case IModelStatus.InvalidParent:
      return new error()

    case IModelStatus.InvalidProfileVersion:
      return new error()

    case IModelStatus.IsCreatingChangeSet:
      return new error()

    case IModelStatus.LockNotHeld:
      return new error()

    case IModelStatus.Mismatch2d3d:
      return new error()

    case IModelStatus.MismatchGcs:
      return new error()

    case IModelStatus.MissingDomain:
      return new error()

    case IModelStatus.MissingHandler:
      return new error()

    case IModelStatus.MissingId:
      return new error()

    case IModelStatus.NoGeometry:
      return new error()

    case IModelStatus.NoMultiTxnOperation:
      return new error()

    case IModelStatus.NotEnabled:
      return new error()

    case IModelStatus.NotFound:
      return new error()

    case IModelStatus.NotOpen:
      return new error()

    case IModelStatus.NotOpenForWrite:
      return new error()

    case IModelStatus.NotSameUnitBase:
      return new error()

    case IModelStatus.NothingToRedo:
      return new error()

    case IModelStatus.NothingToUndo:
      return new error()

    case IModelStatus.ParentBlockedChange:
      return new error()

    case IModelStatus.ReadError:
      return new error()

    case IModelStatus.ReadOnly:
      return new error()

    case IModelStatus.ReadOnlyDomain:
      return new error()

    case IModelStatus.RepositoryManagerError:
      return new error()

    case IModelStatus.SQLiteError:
      return new error()

    case IModelStatus.TransactionActive:
      return new error()

    case IModelStatus.UnitsMissing:
      return new error()

    case IModelStatus.UnknownFormat:
      return new error()

    case IModelStatus.UpgradeFailed:
      return new error()

    case IModelStatus.ValidationFailed:
      return new error()

    case IModelStatus.VersionTooNew:
      return new error()

    case IModelStatus.VersionTooOld:
      return new error()

    case IModelStatus.ViewNotFound:
      return new error()

    case IModelStatus.WriteError:
      return new error()

    case IModelStatus.WrongClass:
      return new error()

    case IModelStatus.WrongIModel:
      return new error()

    case IModelStatus.WrongDomain:
      return new error()

    case IModelStatus.WrongElement:
      return new error()

    case IModelStatus.WrongHandler:
      return new error()

    case IModelStatus.WrongModel:
      return new error()

    case IModelStatus.ConstraintNotUnique:
      return new error()

    case IModelStatus.NoGeoLocation:
      return new error()

    case IModelStatus.ServerTimeout:
      return new error()

    case IModelStatus.NoContent:
      return new error()

    case IModelStatus.NotRegistered:
      return new error()

    case IModelStatus.FunctionNotFound:
      return new error()

    case IModelStatus.NoActiveCommand:
      return new error()

    case BriefcaseStatus.CannotAcquire:
      return new error();

    case BriefcaseStatus.CannotDownload:
      return new error();

    case BriefcaseStatus.CannotUpload:
      return new error();

    case BriefcaseStatus.CannotCopy:
      return new error();

    case BriefcaseStatus.CannotDelete:
      return new error();

    case BriefcaseStatus.VersionNotFound:
      return new error();

    case BriefcaseStatus.CannotApplyChanges:
      return new error();

    case BriefcaseStatus.DownloadCancelled:
      return new error();

    case BriefcaseStatus.ContainsDeletedChangeSets:
      return new error();

    case RpcInterfaceStatus.IncompatibleVersion:
      return new error();

    case ChangeSetStatus.ApplyError:
      return new error();

    case ChangeSetStatus.ChangeTrackingNotEnabled:
      return new error();

    case ChangeSetStatus.CorruptedChangeStream:
      return new error();

    case ChangeSetStatus.FileNotFound:
      return new error();

    case ChangeSetStatus.FileWriteError:
      return new error();

    case ChangeSetStatus.HasLocalChanges:
      return new error();

    case ChangeSetStatus.HasUncommittedChanges:
      return new error();

    case ChangeSetStatus.InvalidId:
      return new error();

    case ChangeSetStatus.InvalidVersion:
      return new error();

    case ChangeSetStatus.InDynamicTransaction:
      return new error();

    case ChangeSetStatus.IsCreatingChangeSet:
      return new error();

    case ChangeSetStatus.IsNotCreatingChangeSet:
      return new error();

    case ChangeSetStatus.MergePropagationError:
      return new error();

    case ChangeSetStatus.NothingToMerge:
      return new error();

    case ChangeSetStatus.NoTransactions:
      return new error();

    case ChangeSetStatus.ParentMismatch:
      return new error();

    case ChangeSetStatus.SQLiteError:
      return new error();

    case ChangeSetStatus.WrongDgnDb:
      return new error();

    case ChangeSetStatus.CouldNotOpenDgnDb:
      return new error();

    case ChangeSetStatus.MergeSchemaChangesOnOpen:
      return new error();

    case ChangeSetStatus.ReverseOrReinstateSchemaChanges:
      return new error();

    case ChangeSetStatus.ProcessSchemaChangesOnOpen:
      return new error();

    case ChangeSetStatus.CannotMergeIntoReadonly:
      return new error();

    case ChangeSetStatus.CannotMergeIntoMaster:
      return new error();

    case ChangeSetStatus.CannotMergeIntoReversed:
      return new error();

    case RepositoryStatus.ServerUnavailable:
      return new error();

    case RepositoryStatus.LockAlreadyHeld:
      return new error();

    case RepositoryStatus.SyncError:
      return new error();

    case RepositoryStatus.InvalidResponse:
      return new error();

    case RepositoryStatus.PendingTransactions:
      return new error();

    case RepositoryStatus.LockUsed:
      return new error();

    case RepositoryStatus.CannotCreateChangeSet:
      return new error();

    case RepositoryStatus.InvalidRequest:
      return new error();

    case RepositoryStatus.ChangeSetRequired:
      return new error();

    case RepositoryStatus.CodeUnavailable:
      return new error();

    case RepositoryStatus.CodeNotReserved:
      return new error();

    case RepositoryStatus.CodeUsed:
      return new error();

    case RepositoryStatus.LockNotHeld:
      return new error();

    case RepositoryStatus.RepositoryIsLocked:
      return new error();

    case RepositoryStatus.ChannelConstraintViolation:
      return new error();

    case IModelHubStatus.Unknown:
      return new error();

    case IModelHubStatus.MissingRequiredProperties:
      return new error();

    case IModelHubStatus.InvalidPropertiesValues:
      return new error();

    case IModelHubStatus.UserDoesNotHavePermission:
      return new error();

    case IModelHubStatus.UserDoesNotHaveAccess:
      return new error();

    case IModelHubStatus.InvalidBriefcase:
      return new error();

    case IModelHubStatus.BriefcaseDoesNotExist:
      return new error();

    case IModelHubStatus.BriefcaseDoesNotBelongToUser:
      return new error();

    case IModelHubStatus.AnotherUserPushing:
      return new error();

    case IModelHubStatus.ChangeSetAlreadyExists:
      return new error();

    case IModelHubStatus.ChangeSetDoesNotExist:
      return new error();

    case IModelHubStatus.FileIsNotUploaded:
      return new error();

    case IModelHubStatus.iModelIsNotInitialized:
      return new error();

    case IModelHubStatus.ChangeSetPointsToBadSeed:
      return new error();

    case IModelHubStatus.OperationFailed:
      return new error();

    case IModelHubStatus.PullIsRequired:
      return new error();

    case IModelHubStatus.MaximumNumberOfBriefcasesPerUser:
      return new error();

    case IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute:
      return new error();

    case IModelHubStatus.DatabaseTemporarilyLocked:
      return new error();

    case IModelHubStatus.iModelIsLocked:
      return new error();

    case IModelHubStatus.CodesExist:
      return new error();

    case IModelHubStatus.LocksExist:
      return new error();

    case IModelHubStatus.iModelAlreadyExists:
      return new error();

    case IModelHubStatus.iModelDoesNotExist:
      return new error();

    case IModelHubStatus.FileDoesNotExist:
      return new error();

    case IModelHubStatus.FileAlreadyExists:
      return new error();

    case IModelHubStatus.LockDoesNotExist:
      return new error();

    case IModelHubStatus.LockOwnedByAnotherBriefcase:
      return new error();

    case IModelHubStatus.CodeStateInvalid:
      return new error();

    case IModelHubStatus.CodeReservedByAnotherBriefcase:
      return new error();

    case IModelHubStatus.CodeDoesNotExist:
      return new error();

    case IModelHubStatus.EventTypeDoesNotExist:
      return new error();

    case IModelHubStatus.EventSubscriptionDoesNotExist:
      return new error();

    case IModelHubStatus.EventSubscriptionAlreadyExists:
      return new error();

    case IModelHubStatus.ITwinIdIsNotSpecified:
      return new error();

    case IModelHubStatus.FailedToGetITwinPermissions:
      return new error();

    case IModelHubStatus.FailedToGetITwinMembers:
      return new error();

    case IModelHubStatus.ChangeSetAlreadyHasVersion:
      return new error();

    case IModelHubStatus.VersionAlreadyExists:
      return new error();

    case IModelHubStatus.JobSchedulingFailed:
      return new error();

    case IModelHubStatus.ConflictsAggregate:
      return new error();

    case IModelHubStatus.FailedToGetITwinById:
      return new error();

    case IModelHubStatus.DatabaseOperationFailed:
      return new error();

    case IModelHubStatus.SeedFileInitializationFailed:
      return new error();

    case IModelHubStatus.FailedToGetAssetPermissions:
      return new error();

    case IModelHubStatus.FailedToGetAssetMembers:
      return new error();

    case IModelHubStatus.ITwinDoesNotExist:
      return new error();

    case IModelHubStatus.LockChunkDoesNotExist:
      return new error();

    case IModelHubStatus.CheckpointAlreadyExists:
      return new error();

    case IModelHubStatus.CheckpointDoesNotExist:
      return new error();

    case IModelHubStatus.UndefinedArgumentError:
      return new error();

    case IModelHubStatus.InvalidArgumentError:
      return new error();

    case IModelHubStatus.MissingDownloadUrlError:
      return new error();

    case IModelHubStatus.NotSupportedInBrowser:
      return new error();

    case IModelHubStatus.FileHandlerNotSet:
      return new error();

    case IModelHubStatus.FileNotFound:
      return new error();

    case IModelHubStatus.InitializationTimeout:
      return new error();

    case AuthStatus.Error:
      return new error();

    case GeoServiceStatus.NoGeoLocation:
      return new error();

    case GeoServiceStatus.OutOfUsefulRange:
      return new error();

    case GeoServiceStatus.OutOfMathematicalDomain:
      return new error();

    case GeoServiceStatus.NoDatumConverter:
      return new error();

    case GeoServiceStatus.VerticalDatumConvertError:
      return new error();

    case GeoServiceStatus.CSMapError:
      return new error();

    case GeoServiceStatus.Pending:
      return new error();

    case RealityDataStatus.InvalidData:
      return new error();

    case BentleyStatus.SUCCESS:
    case IModelStatus.Success:
    case RpcInterfaceStatus.Success:
    case ChangeSetStatus.Success:
    case RepositoryStatus.Success:
    case HttpStatus.Success:
    case IModelHubStatus.Success:
    case AuthStatus.Success:
    case GeoServiceStatus.Success:
      return new Success();

    case BentleyStatus.ERROR:
      return new Failed();

    default:
      return new Unknown();
  }
}
