/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelBank */

import * as deepAssign from "deep-assign";
import { ResponseError } from "./../Request";
import { WsgError } from "./../WsgClient";
import { Logger, LogFunction, HttpStatus, WSStatus, IModelHubStatus, GetMetaDataFunction } from "@bentley/bentleyjs-core";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * Error returned from iModelBank service.
 */
export class IModelBankError extends WsgError {
  // public id?: IModelHubStatus;
  public data: any;
  private static _idPrefix: string = "iModelHub.";
  public constructor(errorNumber: number | HttpStatus, message?: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
  }

  /**
   * Gets IModelHubStatus from the string value returned by the service.
   * @param error Error id returned by the service.
   * @returns IModelHubStatus id
   */
  private static getErrorId(error: string): IModelHubStatus {
    const id = IModelHubStatus[error.slice(IModelBankError._idPrefix.length) as keyof typeof IModelHubStatus];

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
   * Creates IModelBankError from id.
   * @param id Id of the error.
   * @param message Message for the error.
   * @returns Created error.
   */
  public static fromId(id: IModelHubStatus, message: string): IModelBankError {
    const error = new IModelBankError(id);
    error.name = IModelHubStatus[id];
    error.message = message;
    return error;
  }

  /**
   * Attempts to parse IModelBankError from server response.
   * @param response Response from the server.
   * @returns Parsed error.
   */
  public static parse(response: any, log = true): ResponseError {
    const wsgError = WsgError.parse(response, false);
    if (wsgError instanceof WsgError && wsgError.name && wsgError.name.startsWith(IModelBankError._idPrefix)) {
      const errorId = IModelBankError.getErrorId(wsgError.name);
      const error = new IModelBankError(errorId);

      deepAssign(error, wsgError);
      error.errorNumber = errorId;

      if (IModelBankError.requiresExtendedData(error.errorNumber!)) {
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
    const parsedError = IModelBankError.parse({ response }, false);

    if (!(parsedError instanceof WsgError)) {
      return super.shouldRetry(error, response);
    }

    if ((parsedError instanceof IModelBankError)) {
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
    (this.getLogLevel())(loggingCategory, this.logMessage(), this.getMetaData());
  }
}
