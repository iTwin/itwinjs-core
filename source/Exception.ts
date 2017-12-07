/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core/lib/Assert";

export const enum ECObjectsStatus {
  ECOBJECTS_ERROR_BASE = 0x10000,
  Success = 0,
  DuplicateChild = ECOBJECTS_ERROR_BASE + 1,
  DuplicateProperty = ECOBJECTS_ERROR_BASE + 2,
  DuplicateSchema = ECOBJECTS_ERROR_BASE + 3,
  ImmutableSchema = ECOBJECTS_ERROR_BASE + 4,
  InvalidContainerType = ECOBJECTS_ERROR_BASE + 5,
  InvalidECJson = ECOBJECTS_ERROR_BASE + 6,
  InvalidECName = ECOBJECTS_ERROR_BASE + 7,
  InvalidECVersion = ECOBJECTS_ERROR_BASE + 8,
  InvalidEnumValue = ECOBJECTS_ERROR_BASE + 9,
  InvalidModifier = ECOBJECTS_ERROR_BASE + 10,
  InvalidMultiplicity = ECOBJECTS_ERROR_BASE + 11,
  InvalidPrimitiveType = ECOBJECTS_ERROR_BASE + 12,
  InvalidStrength = ECOBJECTS_ERROR_BASE + 13,
  InvalidStrengthDirection = ECOBJECTS_ERROR_BASE + 14,
  MissingSchemaUrl = ECOBJECTS_ERROR_BASE + 15,
  UnableToLocateSchema = ECOBJECTS_ERROR_BASE + 16,
}

export class ECObjectsError extends Error {
  public constructor(public readonly errorNumber: number | ECObjectsStatus, message?: string) {
    super(message);
    assert(errorNumber as number !== ECObjectsStatus.Success as number);
  }

  public toDebugString(): string {
    switch (this.errorNumber) {
      case ECObjectsStatus.DuplicateChild: return this._appendMessage("ECObjectsStatus.DuplicateChild");
      case ECObjectsStatus.DuplicateProperty: return this._appendMessage("ECObjectsStatus.DuplicateProperty");
      case ECObjectsStatus.DuplicateSchema: return this._appendMessage("ECObjectsStatus.DuplicateSchema");
      case ECObjectsStatus.ImmutableSchema: return this._appendMessage("ECObjectsStatus.ImmutableSchema");
      case ECObjectsStatus.InvalidContainerType: return this._appendMessage("ECObjectsStatus.InvalidContainerType");
      case ECObjectsStatus.InvalidECJson: return this._appendMessage("ECObjectsStatus.InvalidECJson");
      case ECObjectsStatus.InvalidECName: return this._appendMessage("ECObjectsStatus.InvalidECName");
      case ECObjectsStatus.InvalidECVersion: return this._appendMessage("ECObjectsStatus.InvalidECVersion");
      case ECObjectsStatus.InvalidEnumValue: return this._appendMessage("ECObjectsStatus.InvalidEnumValue");
      case ECObjectsStatus.InvalidModifier: return this._appendMessage("ECObjectsStatus.InvalidModifier");
      case ECObjectsStatus.InvalidMultiplicity: return this._appendMessage("ECObjectsStatus.InvalidMultiplicity");
      case ECObjectsStatus.InvalidPrimitiveType: return this._appendMessage("ECObjectsStatus.InvalidPrimitiveType");
      case ECObjectsStatus.InvalidStrength: return this._appendMessage("ECObjectsStatus.InvalidStrength");
      case ECObjectsStatus.InvalidStrengthDirection: return this._appendMessage("ECObjectsStatus.InvalidStrengthDirection");
      case ECObjectsStatus.MissingSchemaUrl: return this._appendMessage("ECObjectsStatus.MissingSchemaUrl");
      case ECObjectsStatus.UnableToLocateSchema: return this._appendMessage("ECObjectsStatus.UnableToLocateSchema");
      default:
        assert(false);
        return this._appendMessage("Error " + this.errorNumber.toString());
    }
  }

  private _appendMessage(e: string): string {
    return this.message ? e + ": " + this.message : e;
  }
}
