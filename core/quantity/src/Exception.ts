/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { BentleyError } from "@bentley/bentleyjs-core/lib/BentleyError";

/**
 * Status codes used during Quantity parsing and formatting processing.
 */
export const enum QuantityStatus {
  QUANTITY_ERROR_BASE = 0x88DF,
  Success = 0,
  InvalidJson = QUANTITY_ERROR_BASE + 1,
  InvalidCompositeFormat = QUANTITY_ERROR_BASE + 2,
}

/** The error type thrown by this module. See [[QuantityStatus]] for `errorNumber` values. */
export class QuantityError extends BentleyError {
  public constructor(public readonly errorNumber: number, message?: string) {
    super(errorNumber, message);
  }
}
