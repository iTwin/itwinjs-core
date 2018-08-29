/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { BentleyError, LogFunction, GetMetaDataFunction } from "@bentley/bentleyjs-core";

/**
 * Status codes used by Presentation APIs.
 */
export enum PresentationStatus {
  Success = 0,
  Error = 0x10000,              /** Base error */
  NotInitialized = Error + 1,   /** Not initialized */
  UseAfterDisposal = Error + 2, /** Attempting to use something after disposal */
  InvalidArgument = Error + 3,  /** Argument is invalid */
  InvalidResponse = Error + 4,  /** Response is invalid */
  NoContent = Error + 5,        /** Requested content when there is none */
  UnknownBackend = Error + 6,   /** Backend is unknown - needs to besynced with frontend state */
}

/**
 * An error type thrown by Presentation APIs.
 */
export class PresentationError extends BentleyError {

  /**
   * Creates an instance of Error.
   * @param errorNumber Error code
   * @param message Optional brief description of the error. The `message` property combined with the `name`
   * property is used by the `Error.prototype.toString()` method to create a string representation of the Error.
   * @param log Optional log function which logs the error.
   * @param getMetaData Optional function that returns meta-data related to an error.
   */
  public constructor(errorNumber: PresentationStatus, message?: string, log?: LogFunction, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, log, "Presentation", getMetaData);
  }

  /**
   * Returns the name of each error status. The name is used by the `Error.prototype.toString()`
   * method to create a string representation of the error.
   */
  // tslint:disable-next-line:naming-convention
  protected _initName(): string {
    let value = PresentationStatus[this.errorNumber];
    if (!value)
      value = `Unknown Error (${this.errorNumber})`;
    return value;
  }
}
