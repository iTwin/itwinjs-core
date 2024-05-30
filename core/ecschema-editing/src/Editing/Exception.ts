/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { BentleyError } from "@itwin/core-bentley";
import { AnyDiagnostic } from "../Validation/Diagnostic";
import { SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";

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
  BaseClassIsNotElement = EC_EDITING_ERROR_BASE + 8,
  BaseClassIsNotElementUniqueAspect = EC_EDITING_ERROR_BASE + 9,
  BaseClassIsNotElementMultiAspect = EC_EDITING_ERROR_BASE + 10,
  SchemaItemNameNotSpecified = EC_EDITING_ERROR_BASE + 11,
  InvalidSchemaItemType = EC_EDITING_ERROR_BASE + 12,
  SchemaItemNameAlreadyExists = EC_EDITING_ERROR_BASE + 13,
  InvalidEnumeratorType = EC_EDITING_ERROR_BASE + 14,
  InvalidBaseClass = EC_EDITING_ERROR_BASE + 15,
  EnumeratorDoesNotExist = EC_EDITING_ERROR_BASE + 16,
  InvalidStrengthDirection = EC_EDITING_ERROR_BASE + 17,
  InvalidECName = EC_EDITING_ERROR_BASE + 18,
  InvalidFormatUnitsSpecified = EC_EDITING_ERROR_BASE + 19,
  // Outer Errors
  CreateSchemaItemFailed = EC_EDITING_ERROR_BASE + 1000,
  CreateSchemaItemFromPropsFailed = EC_EDITING_ERROR_BASE + 1001,
  CreateElementFailed = EC_EDITING_ERROR_BASE + 1001,
  CreateElementUniqueAspectFailed = EC_EDITING_ERROR_BASE + 1001,
  CreateElementMultiAspectFailed = EC_EDITING_ERROR_BASE + 1001,
  SetBaseClassFailed = EC_EDITING_ERROR_BASE + 1002,
  SetSourceConstraintFailed = EC_EDITING_ERROR_BASE + 1002,
  SetTargetConstraintFailed = EC_EDITING_ERROR_BASE + 1003,
  AddConstraintClassFailed = EC_EDITING_ERROR_BASE + 1004,
  RemoveConstraintClassFailed = EC_EDITING_ERROR_BASE + 1005,
  SetAbstractConstraintFailed = EC_EDITING_ERROR_BASE + 1006,
  AddCustomAttributeToConstraintFailed = EC_EDITING_ERROR_BASE + 1007,
  AddCustomAttributeToPropertyFailed = EC_EDITING_ERROR_BASE + 1007,
  CreateNavigationPropertyFailed = EC_EDITING_ERROR_BASE + 1008,
  CreateNavigationPropertyFromPropsFailed = EC_EDITING_ERROR_BASE + 1009,
  SetInvertsUnitFailed = EC_EDITING_ERROR_BASE + 1010,
  SetUnitSystemFailed = EC_EDITING_ERROR_BASE + 1011,
  SetDescriptionFailed = EC_EDITING_ERROR_BASE + 1011,
  SetLabelFailed = EC_EDITING_ERROR_BASE + 1011,
  SetIsReadOnlyFailed = EC_EDITING_ERROR_BASE + 1011,
  SetPriorityFailed = EC_EDITING_ERROR_BASE + 1011,
  SetCategoryFailed = EC_EDITING_ERROR_BASE + 1011,
  SetMinOccursFailed = EC_EDITING_ERROR_BASE + 1011,
  SetMaxOccursFailed = EC_EDITING_ERROR_BASE + 1011,
  SetExtendedTypeNameFailed = EC_EDITING_ERROR_BASE + 1011,
  SetMinLengthFailed = EC_EDITING_ERROR_BASE + 1011,
  SetMaxLengthFailed = EC_EDITING_ERROR_BASE + 1011,
  SetMinValueFailed = EC_EDITING_ERROR_BASE + 1011,
  SetMaxValueFailed = EC_EDITING_ERROR_BASE + 1011,
  SetPropertyNameFailed = EC_EDITING_ERROR_BASE + 1011,
  AddMixinFailed = EC_EDITING_ERROR_BASE + 1011,
}

export type AnyEditingError = SchemaEditingError | Error;

export enum TaskType {
  Add,
  Create,
  Update,
  Change,
  Delete
}

export enum SchemaTypeName {
  Schema = "Schema",
  RelationshipConstraint = "RelationshipConstraint",
  CustomAttribute = "CustomAttribute"
}

export enum PropertyTypeName {
  ArrayProperty = "ArrayProperty",
  PrimitiveProperty = "PrimitiveProperty",
  EnumerationProperty = "EnumerationProperty",
  NavigationProperty = "NavigationProperty",
  StructProperty = "StructProperty"
}

export interface ErrorIdentifier {
  schemaKey: SchemaKey;
  key?: SchemaItemKey;
  itemName?: string;
  type?: SchemaItemType;
  propertyName?: string;
  propertyType?: PropertyTypeName;
}

export function schemaItemIdentifier(type: SchemaItemType, key: SchemaItemKey, propertyName?: string, propertyType?: PropertyTypeName): ErrorIdentifier {
  return { schemaKey: key.schemaKey, itemName: key.fullName, type, key, propertyName, propertyType };
}

export function schemaItemIdentifierFromName(schemaKey: SchemaKey, type: SchemaItemType, name: string): ErrorIdentifier {
  const key = new SchemaItemKey(name, schemaKey);
  return { schemaKey, type, key, itemName: key.fullName };
}

/** @internal */
export class SchemaEditingError extends BentleyError {
  private _ruleViolations?: AnyDiagnostic[];
  private _identifier: ErrorIdentifier;
  private _schemaKey: SchemaKey;
  private _unknownError?: Error;

  public constructor(public override readonly errorNumber: number, public identifier: ErrorIdentifier, public innerError?: AnyEditingError, ruleViolations?: AnyDiagnostic[], message?: string) {
    super(errorNumber, message);
    this._schemaKey = identifier.schemaKey;
    this._identifier = identifier;
    this._ruleViolations = ruleViolations;
    this.generateMessage();
  }

  public get schemaKey(): SchemaKey {
    return this._schemaKey;
  }

  public get unknownError(): Error | undefined {
    return this._unknownError;
  }

  public get ruleViolations(): AnyDiagnostic[] | undefined {
    return this._ruleViolations;
  }

  public toDebugString(): string {
    switch (this.errorNumber) {
      case ECEditingStatus.SchemaItemNotFound: return this._appendMessage("ECEditingStatus.SchemaItemNotFound");
      case ECEditingStatus.SchemaItemNotFoundInContext: return this._appendMessage("ECEditingStatus.SchemaItemNotFoundInContext");
      case ECEditingStatus.BaseClassIsNotElement: return this._appendMessage("ECEditingStatus.BaseClassIsNotElement");
      case ECEditingStatus.BaseClassIsNotElementUniqueAspect: return this._appendMessage("ECEditingStatus.BaseClassIsNotElementUniqueAspect");
      case ECEditingStatus.BaseClassIsNotElementMultiAspect: return this._appendMessage("ECEditingStatus.BaseClassIsNotMultiAspectElement");
      case ECEditingStatus.SchemaItemNameNotSpecified: return this._appendMessage("ECEditingStatus.SchemaItemNameNotSpecified");
      case ECEditingStatus.InvalidSchemaItemType: return this._appendMessage("ECEditingStatus.InvalidSchemaItemType");
      case ECEditingStatus.RuleViolation: return this._appendMessage("ECEditingStatus.RuleViolation");
      default:
        /* istanbul ignore next */
        return this._appendMessage(`Error ${this.errorNumber.toString()}`);
    }
  }

  private _appendMessage(e: string) {
    return this.message ? `${e}: ${this.message}` : e;
  }

  private generateMessage() {
    if (this.message)
      return;

    switch(this.errorNumber) {
      case ECEditingStatus.SchemaNotFound:
        this.message = `Schema Key ${this._schemaKey?.toString(true)} could not be found in the context.`;
        return;
      case ECEditingStatus.SchemaItemNotFound:
        this.message = `${this._identifier?.type} ${this._identifier.itemName} could not be found in the schema ${this._schemaKey?.name}.`;
        return;
      case ECEditingStatus.SchemaItemNotFoundInContext:
        this.message = `${this._identifier?.type} ${this._identifier.itemName} could not be found in the schema context.`;
        return;
      case ECEditingStatus.InvalidSchemaItemType:
        this.message = `Expected ${this._identifier.itemName} to be of type ${this._identifier?.type}.`;
        return;
      case ECEditingStatus.SchemaItemNameNotSpecified:
        this.message = `Could not create a new ${this._identifier?.type} in schema ${this._schemaKey?.name}. No name was supplied within props.`;
        return;
      case ECEditingStatus.SchemaItemNameAlreadyExists:
        this.message = `${this._identifier?.type} ${this._identifier.itemName} already exists in the schema ${this._schemaKey?.name}.`;
        return;
      case ECEditingStatus.RuleViolation:
        this.message = `Rule violations occurred from ${this._identifier?.type} ${this._identifier.itemName}: ${this.getRuleViolationMessage()}`;
        return;
      case ECEditingStatus.PropertyNotFound:
        this.message = `An ECProperty with the name ${this._identifier.propertyName} could not be found in the class ${this._identifier.itemName}.`;
        return;
      case ECEditingStatus.PropertyAlreadyExists:
        this.message = `An ECProperty with the name ${this._identifier.propertyName} already exists in the class ${this._identifier.itemName}.`;
        return;
      case ECEditingStatus.InvalidPropertyType:
        this.message = `Expected property ${this._identifier.propertyName} to be of type ${this._identifier.propertyType}.`;
        return;
      case ECEditingStatus.BaseClassIsNotElement:
        this.message = `Expected base class ${this._identifier.itemName} to derive from BisCore.Element.`;
        return;
      case ECEditingStatus.BaseClassIsNotElementUniqueAspect:
        this.message = `Expected base class ${this._identifier.itemName} to derive from BisCore.ElementUniqueAspect.`;
        return;
      case ECEditingStatus.BaseClassIsNotElementMultiAspect:
        this.message = `Expected base class ${this._identifier.itemName} to derive from BisCore.ElementMultiAspect.`;
        return;
      case ECEditingStatus.InvalidFormatUnitsSpecified:
        this.message = `The specified Format unit ${this._identifier.itemName} is not of type Unit or InvertedUnit`;
        return;
    }
  }

  private getRuleViolationMessage(): string {
    if (!this._ruleViolations)
      return "";

    let violations = "";
    for (const diagnostic of this._ruleViolations){
      violations += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
    }
    return violations;
  }
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
