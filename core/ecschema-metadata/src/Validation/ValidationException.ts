/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, BentleyError } from "@bentley/bentleyjs-core";
import { ECValidationStatus } from "./Diagnostics";

export class ECValidationError extends BentleyError {
  public constructor(public readonly errorNumber: number, message?: string) {
    super(errorNumber, message);
    assert(errorNumber as number !== ECValidationStatus.Success as number, message);
  }

  public toDebugString(): string {
    switch (this.errorNumber) {
      case ECValidationStatus.BaseClassIsSealed: return this._appendMessage("ECValidationStatus.BaseClassIsSealed");
      default:
        assert(false);
        /* istanbul ignore next */
        return this._appendMessage("Error " + this.errorNumber.toString());
    }
  }

  private _appendMessage(e: string): string {
    return this.message ? e + ": " + this.message : e;
  }
}
