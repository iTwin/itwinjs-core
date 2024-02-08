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
export type StatusCategoryHandler = (error: BentleyError) => StatusCategory | undefined;

/** A group of related statuses for aggregate reporting purposes.
 * @alpha
 */
export abstract class StatusCategory {
  public static handlers: Set<StatusCategoryHandler> = new Set();

  public static for(error: BentleyError): StatusCategory {
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

function lookupCategory(error: BentleyError): StatusCategory {
  switch (error.errorNumber) {
    case BentleyStatus.SUCCESS.valueOf(): return new Success();
    case BentleyStatus.ERROR.valueOf(): return new UnknownError();

    case IModelStatus.Success.valueOf(): return new Success();
    case IModelStatus.AlreadyLoaded.valueOf(): return new StateViolation();
    case IModelStatus.AlreadyOpen.valueOf(): return new StateViolation();
    case IModelStatus.BadArg.valueOf(): return new ValidationError();
    case IModelStatus.BadElement.valueOf(): return new ValidationError();
    case IModelStatus.BadModel.valueOf(): return new ValidationError();
    case IModelStatus.BadRequest.valueOf(): return new BadRequest();
    case IModelStatus.BadSchema.valueOf(): return new ValidationError();
    case IModelStatus.CannotUndo.valueOf(): return new OperationFailed();
    case IModelStatus.CodeNotReserved.valueOf(): return new StateViolation();
    case IModelStatus.DeletionProhibited.valueOf(): return new Forbidden();
    case IModelStatus.DuplicateCode.valueOf(): return new Conflict();
    case IModelStatus.DuplicateName.valueOf(): return new Conflict();
    case IModelStatus.ElementBlockedChange.valueOf(): return new ConstraintViolation();
    case IModelStatus.FileAlreadyExists.valueOf(): return new Conflict();
    case IModelStatus.FileNotFound.valueOf(): return new NotFound();
    case IModelStatus.FileNotLoaded.valueOf(): return new FileSystemError();
    case IModelStatus.ForeignKeyConstraint.valueOf(): return new ConstraintViolation();
    case IModelStatus.IdExists.valueOf(): return new Conflict();
    case IModelStatus.InDynamicTransaction.valueOf(): return new StateViolation();
    case IModelStatus.InvalidCategory.valueOf(): return new ValidationError();
    case IModelStatus.InvalidCode.valueOf(): return new ValidationError();
    case IModelStatus.InvalidCodeSpec.valueOf(): return new ValidationError();
    case IModelStatus.InvalidId.valueOf(): return new ValidationError();
    case IModelStatus.InvalidName.valueOf(): return new ValidationError();
    case IModelStatus.InvalidParent.valueOf(): return new Conflict();
    case IModelStatus.InvalidProfileVersion.valueOf(): return new InvalidData();
    case IModelStatus.IsCreatingChangeSet.valueOf(): return new StateViolation();
    case IModelStatus.LockNotHeld.valueOf(): return new Forbidden();
    case IModelStatus.Mismatch2d3d.valueOf(): return new ValidationError();
    case IModelStatus.MismatchGcs.valueOf(): return new ValidationError();
    case IModelStatus.MissingDomain.valueOf(): return new ValidationError();
    case IModelStatus.MissingHandler.valueOf(): return new ValidationError();
    case IModelStatus.MissingId.valueOf(): return new ValidationError();
    case IModelStatus.NoGeometry.valueOf(): return new NoContent();
    case IModelStatus.NoMultiTxnOperation.valueOf(): return new StateViolation();
    case IModelStatus.NotEnabled.valueOf(): return new NotEnabled();
    case IModelStatus.NotFound.valueOf(): return new NotFound();
    case IModelStatus.NotOpen.valueOf(): return new StateViolation();
    case IModelStatus.NotOpenForWrite.valueOf(): return new Forbidden();
    case IModelStatus.NotSameUnitBase.valueOf(): return new ValidationError();
    case IModelStatus.NothingToRedo.valueOf(): return new NothingToDo();
    case IModelStatus.NothingToUndo.valueOf(): return new NothingToDo();
    case IModelStatus.ParentBlockedChange.valueOf(): return new Forbidden();
    case IModelStatus.ReadError.valueOf(): return new FileSystemError();
    case IModelStatus.ReadOnly.valueOf(): return new ReadOnly();
    case IModelStatus.ReadOnlyDomain.valueOf(): return new ReadOnly();
    case IModelStatus.RepositoryManagerError.valueOf(): return new NetworkError();
    case IModelStatus.SQLiteError.valueOf(): return new InternalError();
    case IModelStatus.TransactionActive.valueOf(): return new StateViolation();
    case IModelStatus.UnitsMissing.valueOf(): return new ValidationError();
    case IModelStatus.UnknownFormat.valueOf(): return new InvalidData();
    case IModelStatus.UpgradeFailed.valueOf(): return new OperationFailed();
    case IModelStatus.ValidationFailed.valueOf(): return new ValidationError();
    case IModelStatus.VersionTooNew.valueOf(): return new VersioningViolation();
    case IModelStatus.VersionTooOld.valueOf(): return new VersioningViolation();
    case IModelStatus.ViewNotFound.valueOf(): return new NotFound();
    case IModelStatus.WriteError.valueOf(): return new FileSystemError();
    case IModelStatus.WrongClass.valueOf(): return new ValidationError();
    case IModelStatus.WrongIModel.valueOf(): return new ValidationError();
    case IModelStatus.WrongDomain.valueOf(): return new ValidationError();
    case IModelStatus.WrongElement.valueOf(): return new ValidationError();
    case IModelStatus.WrongHandler.valueOf(): return new ValidationError();
    case IModelStatus.WrongModel.valueOf(): return new ValidationError();
    case IModelStatus.ConstraintNotUnique.valueOf(): return new ConstraintViolation();
    case IModelStatus.NoGeoLocation.valueOf(): return new ValidationError();
    case IModelStatus.ServerTimeout.valueOf(): return new Timeout();
    case IModelStatus.NoContent.valueOf(): return new NoContent();
    case IModelStatus.NotRegistered.valueOf(): return new NotImplemented();
    case IModelStatus.FunctionNotFound.valueOf(): return new NotImplemented();
    case IModelStatus.NoActiveCommand.valueOf(): return new StateViolation();

    case BriefcaseStatus.CannotAcquire.valueOf(): return new OperationFailed();
    case BriefcaseStatus.CannotDownload.valueOf(): return new OperationFailed();
    case BriefcaseStatus.CannotUpload.valueOf(): return new OperationFailed();
    case BriefcaseStatus.CannotCopy.valueOf(): return new OperationFailed();
    case BriefcaseStatus.CannotDelete.valueOf(): return new OperationFailed();
    case BriefcaseStatus.VersionNotFound.valueOf(): return new NotFound();
    case BriefcaseStatus.CannotApplyChanges.valueOf(): return new OperationFailed();
    case BriefcaseStatus.DownloadCancelled.valueOf(): return new Cancelled();
    case BriefcaseStatus.ContainsDeletedChangeSets.valueOf(): return new ValidationError();

    case RpcInterfaceStatus.Success.valueOf(): return new Success();
    case RpcInterfaceStatus.IncompatibleVersion.valueOf(): return new VersioningViolation();

    case ChangeSetStatus.Success.valueOf(): return new Success();
    case ChangeSetStatus.ApplyError.valueOf(): return new OperationFailed();
    case ChangeSetStatus.ChangeTrackingNotEnabled.valueOf(): return new NotEnabled();
    case ChangeSetStatus.CorruptedChangeStream.valueOf(): return new Corruption();
    case ChangeSetStatus.FileNotFound.valueOf(): return new NotFound();
    case ChangeSetStatus.FileWriteError.valueOf(): return new FileSystemError();
    case ChangeSetStatus.HasLocalChanges.valueOf(): return new StateViolation();
    case ChangeSetStatus.HasUncommittedChanges.valueOf(): return new StateViolation();
    case ChangeSetStatus.InvalidId.valueOf(): return new Corruption();
    case ChangeSetStatus.InvalidVersion.valueOf(): return new Corruption();
    case ChangeSetStatus.InDynamicTransaction.valueOf(): return new StateViolation();
    case ChangeSetStatus.IsCreatingChangeSet.valueOf(): return new StateViolation();
    case ChangeSetStatus.IsNotCreatingChangeSet.valueOf(): return new StateViolation();
    case ChangeSetStatus.MergePropagationError.valueOf(): return new OperationFailed();
    case ChangeSetStatus.NothingToMerge.valueOf(): return new NothingToDo();
    case ChangeSetStatus.NoTransactions.valueOf(): return new OperationFailed();
    case ChangeSetStatus.ParentMismatch.valueOf(): return new ValidationError();
    case ChangeSetStatus.SQLiteError.valueOf(): return new InternalError();
    case ChangeSetStatus.WrongDgnDb.valueOf(): return new ValidationError();
    case ChangeSetStatus.CouldNotOpenDgnDb.valueOf(): return new OperationFailed();
    case ChangeSetStatus.MergeSchemaChangesOnOpen.valueOf(): return new BadRequest();
    case ChangeSetStatus.ReverseOrReinstateSchemaChanges.valueOf(): return new Conflict();
    case ChangeSetStatus.ProcessSchemaChangesOnOpen.valueOf(): return new BadRequest();
    case ChangeSetStatus.CannotMergeIntoReadonly.valueOf(): return new ValidationError();
    case ChangeSetStatus.CannotMergeIntoMaster.valueOf(): return new ValidationError();
    case ChangeSetStatus.CannotMergeIntoReversed.valueOf(): return new ValidationError();

    case RepositoryStatus.Success.valueOf(): return new Success();
    case RepositoryStatus.ServerUnavailable.valueOf(): return new NetworkError();
    case RepositoryStatus.LockAlreadyHeld.valueOf(): return new Conflict();
    case RepositoryStatus.SyncError.valueOf(): return new NetworkError();
    case RepositoryStatus.InvalidResponse.valueOf(): return new NetworkError();
    case RepositoryStatus.PendingTransactions.valueOf(): return new StateViolation();
    case RepositoryStatus.LockUsed.valueOf(): return new StateViolation();
    case RepositoryStatus.CannotCreateChangeSet.valueOf(): return new InternalError();
    case RepositoryStatus.InvalidRequest.valueOf(): return new NetworkError();
    case RepositoryStatus.ChangeSetRequired.valueOf(): return new StateViolation();
    case RepositoryStatus.CodeUnavailable.valueOf(): return new Conflict();
    case RepositoryStatus.CodeNotReserved.valueOf(): return new StateViolation();
    case RepositoryStatus.CodeUsed.valueOf(): return new StateViolation();
    case RepositoryStatus.LockNotHeld.valueOf(): return new Forbidden();
    case RepositoryStatus.RepositoryIsLocked.valueOf(): return new Locked();
    case RepositoryStatus.ChannelConstraintViolation.valueOf(): return new ConstraintViolation();

    case HttpStatus.Success.valueOf(): return new Success();

    case IModelHubStatus.Success.valueOf(): return new Success();
    case IModelHubStatus.Unknown.valueOf(): return new UnknownError();
    case IModelHubStatus.MissingRequiredProperties.valueOf(): return new ValidationError();
    case IModelHubStatus.InvalidPropertiesValues.valueOf(): return new ValidationError();
    case IModelHubStatus.UserDoesNotHavePermission.valueOf(): return new PermissionsViolation();
    case IModelHubStatus.UserDoesNotHaveAccess.valueOf(): return new PermissionsViolation();
    case IModelHubStatus.InvalidBriefcase.valueOf(): return new ValidationError();
    case IModelHubStatus.BriefcaseDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.BriefcaseDoesNotBelongToUser.valueOf(): return new PermissionsViolation();
    case IModelHubStatus.AnotherUserPushing.valueOf(): return new StateViolation();
    case IModelHubStatus.ChangeSetAlreadyExists.valueOf(): return new Conflict();
    case IModelHubStatus.ChangeSetDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.FileIsNotUploaded.valueOf(): return new StateViolation();
    case IModelHubStatus.iModelIsNotInitialized.valueOf(): return new StateViolation();
    case IModelHubStatus.ChangeSetPointsToBadSeed.valueOf(): return new InvalidData();
    case IModelHubStatus.OperationFailed.valueOf(): return new OperationFailed();
    case IModelHubStatus.PullIsRequired.valueOf(): return new StateViolation();
    case IModelHubStatus.MaximumNumberOfBriefcasesPerUser.valueOf(): return new Throttled();
    case IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute.valueOf(): return new Throttled();
    case IModelHubStatus.DatabaseTemporarilyLocked.valueOf(): return new Locked();
    case IModelHubStatus.iModelIsLocked.valueOf(): return new Locked();
    case IModelHubStatus.CodesExist.valueOf(): return new Conflict();
    case IModelHubStatus.LocksExist.valueOf(): return new Conflict();
    case IModelHubStatus.iModelAlreadyExists.valueOf(): return new Conflict();
    case IModelHubStatus.iModelDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.FileDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.FileAlreadyExists.valueOf(): return new Conflict();
    case IModelHubStatus.LockDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.LockOwnedByAnotherBriefcase.valueOf(): return new Conflict();
    case IModelHubStatus.CodeStateInvalid.valueOf(): return new StateViolation();
    case IModelHubStatus.CodeReservedByAnotherBriefcase.valueOf(): return new Conflict();
    case IModelHubStatus.CodeDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.EventTypeDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.EventSubscriptionDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.EventSubscriptionAlreadyExists.valueOf(): return new StateViolation();
    case IModelHubStatus.ITwinIdIsNotSpecified.valueOf(): return new ValidationError();
    case IModelHubStatus.FailedToGetITwinPermissions.valueOf(): return new OperationFailed();
    case IModelHubStatus.FailedToGetITwinMembers.valueOf(): return new OperationFailed();
    case IModelHubStatus.ChangeSetAlreadyHasVersion.valueOf(): return new Conflict();
    case IModelHubStatus.VersionAlreadyExists.valueOf(): return new Conflict();
    case IModelHubStatus.JobSchedulingFailed.valueOf(): return new InternalError();
    case IModelHubStatus.ConflictsAggregate.valueOf(): return new Conflict();
    case IModelHubStatus.FailedToGetITwinById.valueOf(): return new OperationFailed();
    case IModelHubStatus.DatabaseOperationFailed.valueOf(): return new OperationFailed();
    case IModelHubStatus.SeedFileInitializationFailed.valueOf(): return new OperationFailed();
    case IModelHubStatus.FailedToGetAssetPermissions.valueOf(): return new OperationFailed();
    case IModelHubStatus.FailedToGetAssetMembers.valueOf(): return new OperationFailed();
    case IModelHubStatus.ITwinDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.LockChunkDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.CheckpointAlreadyExists.valueOf(): return new Conflict();
    case IModelHubStatus.CheckpointDoesNotExist.valueOf(): return new NotFound();
    case IModelHubStatus.UndefinedArgumentError.valueOf(): return new ValidationError();
    case IModelHubStatus.InvalidArgumentError.valueOf(): return new ValidationError();
    case IModelHubStatus.MissingDownloadUrlError.valueOf(): return new ValidationError();
    case IModelHubStatus.NotSupportedInBrowser.valueOf(): return new NotSupported();
    case IModelHubStatus.FileHandlerNotSet.valueOf(): return new NotImplemented();
    case IModelHubStatus.FileNotFound.valueOf(): return new NotFound();
    case IModelHubStatus.InitializationTimeout.valueOf(): return new Timeout();

    case GeoServiceStatus.Success.valueOf(): return new Success();
    case GeoServiceStatus.NoGeoLocation.valueOf(): return new ValidationError();
    case GeoServiceStatus.OutOfUsefulRange.valueOf(): return new ValidationError();
    case GeoServiceStatus.OutOfMathematicalDomain.valueOf(): return new ValidationError();
    case GeoServiceStatus.NoDatumConverter.valueOf(): return new OperationFailed();
    case GeoServiceStatus.VerticalDatumConvertError.valueOf(): return new OperationFailed();
    case GeoServiceStatus.CSMapError.valueOf(): return new InternalError();
    case GeoServiceStatus.Pending.valueOf(): return new Pending();

    case RealityDataStatus.Success.valueOf(): return new Success();
    case RealityDataStatus.InvalidData.valueOf(): return new InvalidData();

    default: return new UnknownError();
  }
}
