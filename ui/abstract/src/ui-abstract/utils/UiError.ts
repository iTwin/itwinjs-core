/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { BentleyError, LogFunction, GetMetaDataFunction, Logger, BentleyStatus } from "@bentley/bentleyjs-core";

/** iModel.js UI UiError class is a subclass of BentleyError. Errors are logged.
 * @public
 */
export class UiError extends BentleyError {

  /** Constructs UiError using BentleyError. */
  public constructor(category: string, message: string, errorNumber: number = BentleyStatus.ERROR, log: LogFunction = Logger.logError, getMetaData?: GetMetaDataFunction | undefined) {
    super(errorNumber, message, log, category, getMetaData);
  }
}
