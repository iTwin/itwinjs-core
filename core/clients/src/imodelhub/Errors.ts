/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as deepAssign from "deep-assign";
import { ResponseError } from "./../Request";
import { WsgError } from "./../WsgClient";
import { Logger, LogFunction } from "@bentley/bentleyjs-core";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Id for errors that are returned for incorrect iModel Hub request. */
export enum IModelHubRequestErrorId {
  UndefinedArguementError,
  InvalidArgumentError,
  MissingDownloadUrlError,
  NotSupportedInBrowser,
  FileHandlerNotSet,
}

/**
 * Errors for incorrect iModel Hub requests.
 */
export class IModelHubRequestError extends Error {
  public id?: IModelHubRequestErrorId;

  /**
   * Create error for undefined arguments being passed.
   * @param argumentName Undefined argument name
   * @param downloadUrlMissing Set to true if argument is correct, but it is missing download Url.
   * @returns Created error.
   */
  public static undefinedArgument(argumentName: string): IModelHubRequestError {
    const error = new IModelHubRequestError();

    error.name = "Argument Error";
    error.id = IModelHubRequestErrorId.UndefinedArguementError;
    error.message = `Argument ${argumentName} is null or undefined.`;

    error.log();

    return error;
  }

  /**
   * Create error for invalid arguments being passed.
   * @param argumentName Invalid argument name
   * @returns Created error.
   */
  public static invalidArgument(argumentName: string): IModelHubRequestError {
    const error = new IModelHubRequestError();

    error.name = "Argument Error";
    error.id = IModelHubRequestErrorId.InvalidArgumentError;
    error.message = `Argument ${argumentName} has an invalid value.`;

    error.log();

    return error;
  }

  /**
   * Create error for arguments being passed that are missing download URL.
   * @param argumentName Argument name
   * @returns Created error.
   */
  public static missingDownloadUrl(argumentName: string): IModelHubRequestError {
    const error = new IModelHubRequestError();

    error.name = "Argument Error";
    error.id = IModelHubRequestErrorId.MissingDownloadUrlError;
    error.message = `Supplied ${argumentName} must include download URL. Use selectDownloadUrl() when getting ${argumentName}.`;

    error.log();

    return error;
  }

  /**
   * Create error for incompatible operation being used in browser.
   * @returns Created error.
   */
  public static browser(): IModelHubRequestError {
    const error = new IModelHubRequestError();

    error.name = "Not Supported";
    error.id = IModelHubRequestErrorId.NotSupportedInBrowser;
    error.message = "Operation is not supported in browser.";

    error.log();

    return error;
  }

  /**
   * Create error for incompatible operation being used in browser.
   * @returns Created error.
   */
  public static fileHandler(): IModelHubRequestError {
    const error = new IModelHubRequestError();

    error.name = "File Handler Not Set";
    error.id = IModelHubRequestErrorId.FileHandlerNotSet;
    error.message = "File handler is required to be set for file download / upload.";

    error.log();

    return error;
  }

  /**
   * Log this error.
   */
  private log(): void {
    Logger.logError(loggingCategory, `${this.name}: ${this.message}`);
  }
}

/** Id for errors returned from iModel Hub service. */
export enum IModelHubResponseErrorId {
  Unknown = -1,

  // iModel Hub Services Errors
  MissingRequiredProperties = 1,
  InvalidPropertiesValues,
  UserDoesNotHavePermission,
  InvalidBriefcase,
  BriefcaseDoesNotExist,
  BriefcaseDoesNotBelongToUser,
  AnotherUserPushing,
  ChangeSetAlreadyExists,
  ChangeSetDoesNotExist,
  FileIsNotUploaded,
  iModelIsNotInitialized,
  ChangeSetPointsToBadSeed,
  iModelHubOperationFailed,
  PullIsRequired,
  MaximumNumberOfBriefcasesPerUser,
  MaximumNumberOfBriefcasesPerUserPerMinute,
  DatabaseTemporarilyLocked,
  iModelAlreadyExists,
  iModelDoesNotExist,
  LockDoesNotExist,
  LocksExist,
  LockOwnedByAnotherBriefcase,
  UserAlreadyExists,
  UserDoesNotExist,
  CodeStateInvalid,
  CodeReservedByAnotherBriefcase,
  CodeDoesNotExist,
  CodesExist,
  FileDoesNotExist,
  FileAlreadyExists,
  iModelIsLocked,
  EventTypeDoesNotExist,
  EventSubscriptionDoesNotExist,
  EventSubscriptionAlreadyExists,
  ProjectAssociationIsNotEnabled,
  ProjectIdIsNotSpecified,
  FailedToGetProjectPermissions,
  ChangeSetAlreadyHasVersion,
  VersionAlreadyExists,
  QueryIdsNotSpecified,
}

/**
 * Error returned from iModel Hub service.
 */
export class IModelHubResponseError extends WsgError {
  public id?: IModelHubResponseErrorId;
  public data: any;
  private static _idPrefix: string = "iModelHub.";

  /**
   * Sets IModelHubResponseErrorId from the string value returned by the service.
   * @param error Error id returned by the service.
   */
  private setErrorId(error: string): void {
    this.id = IModelHubResponseErrorId[error.slice(IModelHubResponseError._idPrefix.length) as keyof typeof IModelHubResponseErrorId];

    if (!this.id)
      this.id =  IModelHubResponseErrorId.Unknown;
  }

  /**
   * Checks whether error could have extended data.
   * @param id Id of the error.
   * @returns True if service can return extended data for this error id.
   */
  private static requiresExtendedData(id: IModelHubResponseErrorId): boolean {
    switch (id) {
      case IModelHubResponseErrorId.LockOwnedByAnotherBriefcase:
      case IModelHubResponseErrorId.iModelAlreadyExists:
      case IModelHubResponseErrorId.FileAlreadyExists:
      case IModelHubResponseErrorId.PullIsRequired:
      case IModelHubResponseErrorId.CodeStateInvalid:
      case IModelHubResponseErrorId.CodeReservedByAnotherBriefcase:
        return true;

      default:
        return false;
    }
  }

  /**
   * Makes extended data available publically.
   */
  private copyExtendedData(): void {
    this.data = this._data;
  }

  /**
   * Creates IModelHubResponseError from id.
   * @param id Id of the error.
   * @param message Message for the error.
   * @returns Created error.
   */
  public static fromId(id: IModelHubResponseErrorId, message: string): IModelHubResponseError {
    const error = new IModelHubResponseError();
    error.id = id;
    error.name = IModelHubResponseErrorId[id];
    error.message = message;
    return error;
  }

  /**
   * Attempts to parse IModelHubResponseError from server response.
   * @param response Response from the server.
   * @returns Parsed error.
   */
  public static parse(response: any): ResponseError {
    const wsgError = super.parse(response);
    if (wsgError instanceof WsgError && wsgError.name && wsgError.name.startsWith(IModelHubResponseError._idPrefix)) {
      const error = new IModelHubResponseError();

      deepAssign(error, wsgError);

      error.setErrorId(wsgError.name);

      if (IModelHubResponseError.requiresExtendedData(error.id!)) {
        error.copyExtendedData();
      }

      return error;
    }
    return wsgError;
  }

  /**
   * Decides whether request should be retried or not
   * @param error Superagent Error
   * @param response Superagent Response
   */
  public static shouldRetry(error: any, response: any): boolean {
    if (response === undefined || response === null) {
      return super.shouldRetry(error, response);
    }
    const parsedError = IModelHubResponseError.parse({response});

    if (!(parsedError instanceof IModelHubResponseError)) {
      return super.shouldRetry(error, response);
     }

    return false;
  }

  /**
   * Get log function
   */
  public getLogLevel(): LogFunction {
    switch (this.id) {
      case IModelHubResponseErrorId.AnotherUserPushing:
      case IModelHubResponseErrorId.PullIsRequired:
      case IModelHubResponseErrorId.LockOwnedByAnotherBriefcase:
      case IModelHubResponseErrorId.CodeReservedByAnotherBriefcase:
        return Logger.logWarning;

      default:
        return Logger.logError;
    }
  }

  /**
   * Logs this error
   */
  public log(): void {
    Logger.logError(loggingCategory, this.logMessage());
  }
}

/** Class for aggregating multiple errors from multiple requests */
export class AggregateResponseError extends Error {
  public errors: ResponseError[] = [];
}
