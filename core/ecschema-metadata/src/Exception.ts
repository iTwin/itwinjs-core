/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { BentleyError } from "@itwin/core-bentley";

/** @public @preview */
export enum ECSchemaStatus {
  ECSCHEMA_ERROR_BASE = 0x88EC,
  Success = 0,
  DuplicateItem = ECSCHEMA_ERROR_BASE + 1,
  DuplicateProperty = ECSCHEMA_ERROR_BASE + 2,
  DuplicateSchema = ECSCHEMA_ERROR_BASE + 3,
  ImmutableSchema = ECSCHEMA_ERROR_BASE + 4,
  InvalidContainerType = ECSCHEMA_ERROR_BASE + 5,
  InvalidECJson = ECSCHEMA_ERROR_BASE + 6,
  InvalidECName = ECSCHEMA_ERROR_BASE + 7,
  InvalidECVersion = ECSCHEMA_ERROR_BASE + 8,
  InvalidEnumValue = ECSCHEMA_ERROR_BASE + 9,
  InvalidModifier = ECSCHEMA_ERROR_BASE + 10,
  InvalidMultiplicity = ECSCHEMA_ERROR_BASE + 11,
  InvalidPrimitiveType = ECSCHEMA_ERROR_BASE + 12,
  InvalidSchemaItemType = ECSCHEMA_ERROR_BASE + 13,
  InvalidStrength = ECSCHEMA_ERROR_BASE + 14,
  InvalidStrengthDirection = ECSCHEMA_ERROR_BASE + 15,
  InvalidRelationshipEnd = ECSCHEMA_ERROR_BASE + 16,
  InvalidType = ECSCHEMA_ERROR_BASE + 17,
  MissingSchemaUrl = ECSCHEMA_ERROR_BASE + 18,
  UnableToLocateSchema = ECSCHEMA_ERROR_BASE + 19,
  InvalidSchemaXML = ECSCHEMA_ERROR_BASE + 20,
  InvalidSchemaString = ECSCHEMA_ERROR_BASE + 21,
  ClassNotFound = ECSCHEMA_ERROR_BASE + 22,
  SchemaContextUndefined = ECSCHEMA_ERROR_BASE + 23,
  DifferentSchemaContexts = ECSCHEMA_ERROR_BASE + 24,
  InvalidSchemaComparisonArgument = ECSCHEMA_ERROR_BASE + 25,
  InvalidSchemaAlias = ECSCHEMA_ERROR_BASE + 26,
  InvalidSchemaKey = ECSCHEMA_ERROR_BASE + 27,
  UnableToLoadSchema = ECSCHEMA_ERROR_BASE + 28,
  NewerECSpecVersion = ECSCHEMA_ERROR_BASE + 29,
}

/** @internal */
export class ECSchemaError extends BentleyError {
  public constructor(public override readonly errorNumber: number, message?: string) {
    super(errorNumber, message);
  }

  public toDebugString(): string {
    switch (this.errorNumber) {
      case ECSchemaStatus.DuplicateItem: return this._appendMessage("ECSchemaStatus.DuplicateItem");
      case ECSchemaStatus.DuplicateProperty: return this._appendMessage("ECSchemaStatus.DuplicateProperty");
      case ECSchemaStatus.DuplicateSchema: return this._appendMessage("ECSchemaStatus.DuplicateSchema");
      case ECSchemaStatus.ImmutableSchema: return this._appendMessage("ECSchemaStatus.ImmutableSchema");
      case ECSchemaStatus.InvalidContainerType: return this._appendMessage("ECSchemaStatus.InvalidContainerType");
      case ECSchemaStatus.InvalidECJson: return this._appendMessage("ECSchemaStatus.InvalidECJson");
      case ECSchemaStatus.InvalidECName: return this._appendMessage("ECSchemaStatus.InvalidECName");
      case ECSchemaStatus.InvalidECVersion: return this._appendMessage("ECSchemaStatus.InvalidECVersion");
      case ECSchemaStatus.InvalidEnumValue: return this._appendMessage("ECSchemaStatus.InvalidEnumValue");
      case ECSchemaStatus.InvalidModifier: return this._appendMessage("ECSchemaStatus.InvalidModifier");
      case ECSchemaStatus.InvalidMultiplicity: return this._appendMessage("ECSchemaStatus.InvalidMultiplicity");
      case ECSchemaStatus.InvalidPrimitiveType: return this._appendMessage("ECSchemaStatus.InvalidPrimitiveType");
      case ECSchemaStatus.InvalidSchemaItemType: return this._appendMessage("ECSchemaStatus.InvalidSchemaItemType");
      case ECSchemaStatus.InvalidStrength: return this._appendMessage("ECSchemaStatus.InvalidStrength");
      case ECSchemaStatus.InvalidStrengthDirection: return this._appendMessage("ECSchemaStatus.InvalidStrengthDirection");
      case ECSchemaStatus.InvalidRelationshipEnd: return this._appendMessage("ECSchemaStatus.InvalidRelationshipEnd");
      case ECSchemaStatus.InvalidType: return this._appendMessage("ECSchemaStatus.InvalidType");
      case ECSchemaStatus.MissingSchemaUrl: return this._appendMessage("ECSchemaStatus.MissingSchemaUrl");
      case ECSchemaStatus.UnableToLocateSchema: return this._appendMessage("ECSchemaStatus.UnableToLocateSchema");
      case ECSchemaStatus.ClassNotFound: return this._appendMessage("ECSchemaStatus.ClassNotFound");
      case ECSchemaStatus.SchemaContextUndefined: return this._appendMessage("ECSchemaStatus.SchemaContextUndefined");
      case ECSchemaStatus.DifferentSchemaContexts: return this._appendMessage("ECSchemaStatus.DifferentSchemaContexts");
      default:
        /* istanbul ignore next */
        return this._appendMessage(`Error ${this.errorNumber.toString()}`);
    }
  }

  private _appendMessage(e: string): string {
    return this.message ? `${e}: ${this.message}` : e;
  }
}
