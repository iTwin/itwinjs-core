/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { BentleyError } from "@itwin/core-bentley";
import { AnyDiagnostic } from "../Validation/Diagnostic";

/** @alpha */
export enum ECEditingStatus {
  EC_EDITING_ERROR_BASE = 0x30000,
  Unknown = 0,
  RuleViolation = EC_EDITING_ERROR_BASE + 1,
  SchemaNotFound = EC_EDITING_ERROR_BASE + 2,
  SchemaItemNotFound = EC_EDITING_ERROR_BASE + 3,
  SchemaItemNotFoundInContext = EC_EDITING_ERROR_BASE + 4,
  PropertyAlreadyExists = EC_EDITING_ERROR_BASE + 5,
  PropertyNotFound = EC_EDITING_ERROR_BASE + 6,
  InvalidPropertyType = EC_EDITING_ERROR_BASE + 7,
  ElementUniqueAspect_BaseClassNotAnElement = EC_EDITING_ERROR_BASE + 8,
  ElementMultiAspect_BaseClassNotAnElement = EC_EDITING_ERROR_BASE + 9,
  SchemaItemNameNotSpecified = EC_EDITING_ERROR_BASE + 10,
  InvalidSchemaItemType = EC_EDITING_ERROR_BASE + 11,
  SchemaItemNameAlreadyExists = EC_EDITING_ERROR_BASE + 12,
  InvalidEnumeratorType = EC_EDITING_ERROR_BASE + 13,
  InvalidBaseClass = EC_EDITING_ERROR_BASE + 14,
  EnumeratorDoesNotExist = EC_EDITING_ERROR_BASE + 15,
  InvalidStrengthDirection = EC_EDITING_ERROR_BASE + 16,
}

/** @internal */
export class ECEditingError extends BentleyError {
  private _ruleViolations?: AnyDiagnostic[];

  public constructor(public override readonly errorNumber: number, message?: string, ruleViolations?: AnyDiagnostic[]) {
    if (!message && ruleViolations) {
      for (const diagnostic of ruleViolations){
        message += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
      }
    }
    super(errorNumber, message);
    this._ruleViolations = ruleViolations;
  }

  public set ruleViolations(diagnostics: AnyDiagnostic[]) {
    this._ruleViolations = diagnostics;
  }

  public get ruleViolations(): AnyDiagnostic[] | undefined {
    return this._ruleViolations;
  }

  public toDebugString(): string {
    switch (this.errorNumber) {
      case ECEditingStatus.SchemaItemNotFound: return this._appendMessage("ECEditingStatus.SchemaItemNotFound");
      case ECEditingStatus.SchemaItemNotFoundInContext: return this._appendMessage("ECEditingStatus.SchemaItemNotFoundInContext");
      case ECEditingStatus.ElementUniqueAspect_BaseClassNotAnElement: return this._appendMessage("ECEditingStatus.ElementUniqueAspect_BaseClassNotAnElement");
      case ECEditingStatus.ElementMultiAspect_BaseClassNotAnElement: return this._appendMessage("ECEditingStatus.ElementMultiAspect_BaseClassNotAnElement");
      case ECEditingStatus.SchemaItemNameNotSpecified: return this._appendMessage("ECEditingStatus.SchemaItemNameNotSpecified");
      case ECEditingStatus.InvalidSchemaItemType: return this._appendMessage("ECEditingStatus.InvalidSchemaItemType");
      case ECEditingStatus.RuleViolation: return this._appendMessage("ECEditingStatus.RuleViolation");
      default:
        /* istanbul ignore next */
        return this._appendMessage(`Error ${this.errorNumber.toString()}`);
    }
  }

  private _appendMessage(e: string): string {
    return this.message ? `${e}: ${this.message}` : e;
  }
}
