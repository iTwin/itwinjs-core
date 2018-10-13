/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import * as deepAssign from "deep-assign";
import { ResponseError } from "./../Request";
import { WsgError } from "./../WsgClient";
import {
  Logger, LogFunction, HttpStatus, WSStatus, IModelHubStatus, GetMetaDataFunction, Guid,
} from "@bentley/bentleyjs-core";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * Error returned from iModelHub service.
 */
export class IModelHubError extends WsgError {
  /** Extended data of the error. */
  public data: any;
  private static _idPrefix: string = "iModelHub.";

  /** @hidden */
  public constructor(errorNumber: number | HttpStatus, message?: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
  }

  /**
   * Get IModelHubStatus from the string value returned by the service.
   * @param error Error id returned by the service.
   * @returns IModelHubStatus id
   */
  private static getErrorId(error: string): IModelHubStatus {
    const id = IModelHubStatus[error.slice(IModelHubError._idPrefix.length) as keyof typeof IModelHubStatus];

    return id ? id : IModelHubStatus.Unknown;
  }

  /**
   * Check whether error could have extended data.
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
   * Make extended data available publically.
   */
  private copyExtendedData(): void {
    this.data = this._data;
  }

  /**
   * Create IModelHubError from id.
   * @hidden
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
   * Attempt to parse IModelHubError from server response.
   * @hidden
   * @param response Response from the server.
   * @returns Parsed error.
   */
  public static parse(response: any, log = true): ResponseError {
    const wsgError = super.parse(response, false);
    if (wsgError instanceof WsgError && wsgError.name && wsgError.name.startsWith(IModelHubError._idPrefix)) {
      const errorId = IModelHubError.getErrorId(wsgError.name);
      const error = new IModelHubError(errorId);

      deepAssign(error, wsgError);
      error.errorNumber = errorId;

      if (IModelHubError.requiresExtendedData(error.errorNumber!)) {
        error.copyExtendedData();
      }
      if (log)
        error.log();
      return error;
    }
    if (log)
      wsgError.log();
    return wsgError;
  }

  /**
   * Decides whether request should be retried or not.
   * @hidden
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
    const parsedError = IModelHubError.parse({ response }, false);

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
   * Get log function.
   * @hidden
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
   * Logs this error.
   * @hidden
   */
  public log(): void {
    (this.getLogLevel())(loggingCategory, this.logMessage(), this.getMetaData());
  }
}

/**
 * Errors for incorrect iModelHub requests.
 */
export class IModelHubClientError extends IModelHubError {
  /**
   * Creates IModelHubClientError from id.
   * @hidden
   * @param id Id of the error.
   * @param message Message for the error.
   * @returns Created error.
   */
  public static fromId(id: IModelHubStatus, message: string): IModelHubClientError {
    const error = new IModelHubClientError(id, message);
    error.log();
    return error;
  }

  /**
   * Create error for undefined arguments being passed.
   * @hidden
   * @param argumentName Undefined argument name
   * @returns Created error.
   */
  public static undefinedArgument(argumentName: string): IModelHubClientError {
    return this.fromId(IModelHubStatus.UndefinedArgumentError, `Argument ${argumentName} is null or undefined`);
  }

  /**
   * Create error for invalid arguments being passed.
   * @hidden
   * @param argumentName Invalid argument name
   * @returns Created error.
   */
  public static invalidArgument(argumentName: string): IModelHubClientError {
    return this.fromId(IModelHubStatus.InvalidArgumentError, `Argument ${argumentName} has an invalid value.`);
  }

  /**
   * Create error for arguments being passed that are missing download URL.
   * @hidden
   * @param argumentName Argument name
   * @returns Created error.
   */
  public static missingDownloadUrl(argumentName: string): IModelHubClientError {
    return this.fromId(IModelHubStatus.MissingDownloadUrlError,
      `Supplied ${argumentName} must include download URL. Use selectDownloadUrl() when getting ${argumentName}.`);
  }

  /**
   * Create error for incompatible operation being used in browser.
   * @hidden
   * @returns Created error.
   */
  public static browser(): IModelHubClientError {
    return this.fromId(IModelHubStatus.NotSupportedInBrowser, "Operation is not supported in browser.");
  }

  /**
   * Create error for incompatible operation being used in browser.
   * @hidden
   * @returns Created error.
   */
  public static fileHandler(): IModelHubClientError {
    return this.fromId(IModelHubStatus.FileHandlerNotSet, "File handler is required to be set for file download / upload.");
  }

  /**
   * Create error for a missing file.
   * @hidden
   * @returns Created error.
   */
  public static fileNotFound(): IModelHubClientError {
    return this.fromId(IModelHubStatus.FileNotFound, "Could not find the file to upload.");
  }
}

/** @hidden */
export class ArgumentCheck {
  public static defined(argumentName: string, argument?: any) {
    if (!argument)
      throw IModelHubClientError.undefinedArgument(argumentName);
  }

  public static definedNumber(argumentName: string, argument?: number) {
    if (typeof argument !== "number")
      throw IModelHubClientError.undefinedArgument(argumentName);
  }

  public static valid(argumentName: string, argument?: any) {
    if (!argument)
      throw IModelHubClientError.invalidArgument(argumentName);
  }

  public static validGuid(argumentName: string, argument?: string | Guid) {
    this.defined(argumentName, argument);
    if (!(argument instanceof Guid) && !Guid.isGuid(argument!))
      throw IModelHubClientError.invalidArgument(argumentName);
  }

  /** @hidden */
  public static nonEmptyArray(argumentName: string, argument?: any[]) {
    this.defined(argumentName, argument);
    if (argument!.length < 1)
      throw IModelHubClientError.invalidArgument(argumentName);
  }

  /**
   * Check if Briefcase Id is valid.
   * @hidden
   */
  private static isBriefcaseIdValid(briefcaseId: number): boolean {
    return briefcaseId > 1 && briefcaseId < 16 * 1024 * 1024;
  }

  /**
   * Check if Briefcase Id argument is valid.
   * @hidden
   */
  public static validBriefcaseId(argumentName: string, argument?: number) {
    this.definedNumber(argumentName, argument);
    if (!this.isBriefcaseIdValid(argument!))
      throw IModelHubClientError.invalidArgument(argumentName);
  }

  /** @hidden */
  private static isValidChangeSetId(changeSetId: string) {
    const pattern = new RegExp("^[0-9A-Fa-f]+$");
    return changeSetId.length === 40 && pattern.test(changeSetId);
  }

  /** @hidden */
  public static validChangeSetId(argumentName: string, argument?: string) {
    this.defined(argumentName, argument);
    if (!this.isValidChangeSetId(argument!))
      throw IModelHubClientError.invalidArgument(argumentName);
  }
}

/** Class for aggregating errors from multiple requests. Only thrown when more than 1 error has occured. */
export class AggregateResponseError extends Error {
  /** Errors that happened over multiple requests. */
  public errors: ResponseError[] = [];
}
