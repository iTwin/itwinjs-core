/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core/lib/Assert";

export const enum ECObjectsStatus {
  ECOBJECTS_ERROR_BASE = 0x10000,
  Success = 0,
  InvalidECName = ECOBJECTS_ERROR_BASE + 1,
  InvalidECVersion = ECOBJECTS_ERROR_BASE + 2,
  ImmutableSchema = ECOBJECTS_ERROR_BASE + 3,
  MissingSchemaUrl = ECOBJECTS_ERROR_BASE + 4,
  InvalidModifier = ECOBJECTS_ERROR_BASE + 5,
  InvalidECJson = ECOBJECTS_ERROR_BASE + 6,
}

export class ECObjectsError extends Error {
  public constructor(public readonly errorNumber: number | ECObjectsStatus, message?: string) {
    super(message);
    assert(errorNumber as number !== ECObjectsStatus.Success as number);
  }

  public toDebugString(): string {
    switch (this.errorNumber) {
      case ECObjectsStatus.InvalidECName: return this._appendMessage("ECObjectsStatus.InvalidECName");
      case ECObjectsStatus.InvalidECVersion: return this._appendMessage("ECObjectsStatus.InvalidECVersion");
      case ECObjectsStatus.ImmutableSchema: return this._appendMessage("ECObjectsStatus.ImmutableSchema");
      case ECObjectsStatus.MissingSchemaUrl: return this._appendMessage("ECObjectsStatus.MissingSchemaUrl");
      case ECObjectsStatus.InvalidModifier: return this._appendMessage("ECObjectsStatus.InvalidModifier");
      case ECObjectsStatus.InvalidECJson: return this._appendMessage("ECObjectsStatus.InvalidECJson");
      default:
        assert(false);
        return this._appendMessage("Error " + this.errorNumber.toString());
    }
  }

  private _appendMessage(e: string): string {
    return this.message ? e + ": " + this.message : e;
  }
}
