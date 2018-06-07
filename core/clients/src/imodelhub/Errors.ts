/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as deepAssign from "deep-assign";
import { ResponseError } from "./../Request";
import { WsgError } from "./../WsgClient";
import { Logger, LogFunction, HttpStatus, WSStatus, IModelHubStatus } from "@bentley/bentleyjs-core";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * Error returned from iModel Hub service.
 */
export class IModelHubError extends WsgError {
  // public id?: IModelHubStatus;
  public data: any;
  private static _idPrefix: string = "iModelHub.";

  /**
   * Gets IModelHubStatus from the string value returned by the service.
   * @param error Error id returned by the service.
   * @returns IModelHubStatus id
   */
  private static getErrorId(error: string): IModelHubStatus {
    const id = IModelHubStatus[error.slice(IModelHubError._idPrefix.length) as keyof typeof IModelHubStatus];

    return id ? id : IModelHubStatus.Unknown;
  }

  /**
   * Checks whether error could have extended data.
   * @param id Id of the error.
   * @returns True if service can return extended data for this error id.
   */
  private static requiresExtendedData(id: IModelHubStatus): boolean {
    switch (id) {
      case IModelHubStatus.LockOwnedByAnotherBriefcase:
      case IModelHubStatus.iModelAlreadyExists:
      case IModelHubStatus.FileAlreadyExists:
      case IModelHubStatus.PullIsRequired:
      case IModelHubStatus.CodeStateInvalid:
      case IModelHubStatus.CodeReservedByAnotherBriefcase:
      case IModelHubStatus.ConflictsAggregate:
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
   * Creates IModelHubError from id.
   * @param id Id of the error.
   * @param message Message for the error.
   * @returns Created error.
   */
  public static fromId(id: IModelHubStatus, message: string): IModelHubError {
    const error = new IModelHubError(id);
    error.name = IModelHubStatus[id];
    error.message = message;
    return error;
  }

  /**
   * Attempts to parse IModelHubError from server response.
   * @param response Response from the server.
   * @returns Parsed error.
   */
  public static parse(response: any): ResponseError {
    const wsgError = super.parse(response);
    if (wsgError instanceof WsgError && wsgError.name && wsgError.name.startsWith(IModelHubError._idPrefix)) {
      const errorId = IModelHubError.getErrorId(wsgError.name);
      const error = new IModelHubError(errorId);

      deepAssign(error, wsgError);
      error.errorNumber = errorId;

      if (IModelHubError.requiresExtendedData(error.errorNumber!)) {
        error.copyExtendedData();
      }

      return error;
    }
    return wsgError;
  }

  /**
   * Decides whether request should be retried or not
   * @param error Error returned by request
   * @param response Response returned by request
   */
  public static shouldRetry(error: any, response: any): boolean {
    if (response === undefined || response === null) {
      return super.shouldRetry(error, response);
    }

    if (super.parseHttpStatus(response.statusType) === HttpStatus.Success) {
      return false;
    }
    const parsedError = IModelHubError.parse({ response });

    if (!(parsedError instanceof WsgError)) {
      return super.shouldRetry(error, response);
    }

    if ((parsedError instanceof IModelHubError)) {
      return false;
    }

    const errorCodesToRetry: number[] = [HttpStatus.ServerError,
    WSStatus.Unknown];

    const errorStatus = super.getErrorStatus(parsedError.name !== undefined ?
      super.getWSStatusId(parsedError.name) : WSStatus.Unknown, response.statusType);
    return errorCodesToRetry.includes(errorStatus);
  }

  /**
   * Get log function
   */
  public getLogLevel(): LogFunction {
    switch (this.errorNumber) {
      case IModelHubStatus.AnotherUserPushing:
      case IModelHubStatus.PullIsRequired:
      case IModelHubStatus.LockOwnedByAnotherBriefcase:
      case IModelHubStatus.CodeReservedByAnotherBriefcase:
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

/**
 * Errors for incorrect iModel Hub requests.
 */
export class IModelHubRequestError extends IModelHubError {
  /**
   * Create error for undefined arguments being passed.
   * @param argumentName Undefined argument name
   * @param downloadUrlMissing Set to true if argument is correct, but it is missing download Url.
   * @returns Created error.
   */
  public static undefinedArgument(argumentName: string): IModelHubRequestError {
    const error = new IModelHubRequestError(IModelHubStatus.UndefinedArguementError);

    error.name = "Argument Error";
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
    const error = new IModelHubRequestError(IModelHubStatus.InvalidArgumentError);

    error.name = "Argument Error";
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
    const error = new IModelHubRequestError(IModelHubStatus.MissingDownloadUrlError);

    error.name = "Argument Error";
    error.message = `Supplied ${argumentName} must include download URL. Use selectDownloadUrl() when getting ${argumentName}.`;

    error.log();

    return error;
  }

  /**
   * Create error for incompatible operation being used in browser.
   * @returns Created error.
   */
  public static browser(): IModelHubRequestError {
    const error = new IModelHubRequestError(IModelHubStatus.NotSupportedInBrowser);

    error.name = "Not Supported";
    error.message = "Operation is not supported in browser.";

    error.log();

    return error;
  }

  /**
   * Create error for incompatible operation being used in browser.
   * @returns Created error.
   */
  public static fileHandler(): IModelHubRequestError {
    const error = new IModelHubRequestError(IModelHubStatus.FileHandlerNotSet);

    error.name = "File Handler Not Set";
    error.message = "File handler is required to be set for file download / upload.";

    error.log();

    return error;
  }

  /**
   * Create error for a missing file.
   * @returns Created error.
   */
  public static fileNotFound(): IModelHubRequestError {
    const error = new IModelHubRequestError(IModelHubStatus.FileNotFound);

    error.name = "File Not Found";
    error.message = "Could not find the file to upload.";

    error.log();

    return error;
  }
}

/** Class for aggregating multiple errors from multiple requests */
export class AggregateResponseError extends Error {
  public errors: ResponseError[] = [];
}
