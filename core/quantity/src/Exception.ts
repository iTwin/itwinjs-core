/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { BentleyError } from "@bentley/bentleyjs-core/lib/BentleyError";

export const enum QuantityStatus {
  QUANTITY_ERROR_BASE = 0x88DF,
  Success = 0,
  InvalidJson = QUANTITY_ERROR_BASE + 1,
  InvalidCompositeFormat = QUANTITY_ERROR_BASE + 2,
}

export class QuantityError extends BentleyError {
  public constructor(public readonly errorNumber: number, message?: string) {
    super(errorNumber, message);
  }
}
