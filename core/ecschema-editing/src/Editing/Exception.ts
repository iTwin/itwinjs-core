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
  SchemaNotFound,
  SchemaItemNotFound,
  SchemaItemNotFoundInContext,
  PropertyAlreadyExists,
  PropertyNotFound,
  InvalidPropertyType,
  BaseClassIsNotElement,
  BaseClassIsNotElementUniqueAspect,
  BaseClassIsNotElementMultiAspect,
  SchemaItemNameNotSpecified,
  InvalidSchemaItemType,
  SchemaItemNameAlreadyExists,
  InvalidEnumeratorType,
  InvalidBaseClass,
  EnumeratorDoesNotExist,
  InvalidStrengthDirection,
  InvalidECName,
  InvalidFormatUnitsSpecified,
  // Outer Errors
  CreateSchemaItemFailed,
  CreateSchemaItemFromPropsFailed,
  CreateElementFailed,
  CreateElementUniqueAspectFailed,
  CreateElementMultiAspectFailed,
  SetBaseClassFailed,
  SetSourceConstraintFailed,
  SetTargetConstraintFailed,
  AddConstraintClassFailed,
  RemoveConstraintClassFailed,
  SetAbstractConstraintFailed,
  AddCustomAttributeToConstraintFailed,
  AddCustomAttributeToPropertyFailed,
  AddCustomAttributeToClassFailed,
  CreateNavigationPropertyFailed,
  CreateNavigationPropertyFromPropsFailed,
  SetInvertsUnitFailed,
  SetUnitSystemFailed,
  SetDescriptionFailed,
  SetLabelFailed,
  SetIsReadOnlyFailed,
  SetPriorityFailed ,
  SetCategoryFailed,
  SetMinOccursFailed,
  SetMaxOccursFailed,
  SetExtendedTypeNameFailed,
  SetMinLengthFailed,
  SetMaxLengthFailed,
  SetMinValueFailed,
  SetMaxValueFailed,
  SetPropertyNameFailed,
  AddMixinFailed,
  AddEnumeratorFailed,
  SetEnumeratorLabelFailed,
  SetEnumeratorDescriptionFailed,
  AddPresentationUnitFailed,
  AddPresentationOverrideFormat,
  CreateFormatOverride,
  SetPropertyCategoryPriorityFailed,
  CreatePrimitiveProperty,
  CreatePrimitivePropertyFromProps,
  CreateEnumerationProperty,
  CreateEnumerationPropertyFromProps,
  CreatePrimitiveArrayProperty,
  CreatePrimitiveArrayPropertyFromProps,
  CreateEnumerationArrayProperty,
  CreateEnumerationArrayPropertyFromProps,
  CreateStructProperty,
  CreateStructPropertyFromProps,
  CreateStructArrayProperty,
  CreateStructArrayPropertyFromProps,
  DeleteProperty,
  DeleteClass,
  SetClassName,
  AddSchemaReference,
  SetSchemaVersion,
  IncrementSchemaMinorVersion,
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

export interface SchemaIdentifier {
  schemaKey: SchemaKey;
}

export interface SchemaItemIdentifier extends SchemaIdentifier {
  key: SchemaItemKey;
  itemName: string;
  type: SchemaItemType;
}

export interface PropertyIdentifier extends SchemaItemIdentifier {
  propertyName: string;
  propertyType?: PropertyTypeName;
}

export interface EnumerationIdentifier extends SchemaItemIdentifier {
  enumerationType: string;
  enumeratorName?: string;
}

export interface CustomAttributeContainerIdentifier extends SchemaIdentifier {
  fullName: string;
  customAttributeName: string;
}

type AnyIdentifier = SchemaIdentifier | SchemaItemIdentifier | PropertyIdentifier | EnumerationIdentifier | CustomAttributeContainerIdentifier;

function isSchemaIdentifier(identifier: AnyIdentifier) {
  return (identifier as SchemaIdentifier).schemaKey !== undefined;
}

function isSchemaItemIdentifier(identifier: AnyIdentifier) {
  return (identifier as SchemaItemIdentifier).itemName !== undefined &&
    (identifier as SchemaItemIdentifier).type !== undefined;
}

function isPropertyIdentifier(identifier: AnyIdentifier) {
  return (identifier as PropertyIdentifier).propertyName !== undefined;
}

function isEnumerationIdentifier(identifier: AnyIdentifier) {
  return (identifier as EnumerationIdentifier).enumerationType !== undefined;
}

function isCustomAttributeContainerIdentifier(identifier: AnyIdentifier) {
  return (identifier as CustomAttributeContainerIdentifier).customAttributeName !== undefined &&
    (identifier as CustomAttributeContainerIdentifier).fullName !== undefined;
}

export function schemaItemIdentifier(type: SchemaItemType, key: SchemaItemKey): SchemaItemIdentifier {
  return { schemaKey: key.schemaKey, key, itemName: key.fullName, type };
}

export function schemaItemIdentifierFromName(schemaKey: SchemaKey, type: SchemaItemType, name: string): SchemaItemIdentifier {
  const key = new SchemaItemKey(name, schemaKey);
  return { schemaKey, type, key, itemName: key.fullName };
}

export function propertyIdentifier(type: SchemaItemType, key: SchemaItemKey, propertyName: string, propertyType?: PropertyTypeName): PropertyIdentifier {
  return { schemaKey: key.schemaKey, itemName: key.fullName, type, key, propertyName, propertyType };
}

export function enumerationIdentifier(type: SchemaItemType, key: SchemaItemKey, enumerationType: string, enumeratorName: string ): EnumerationIdentifier {
  return { schemaKey: key.schemaKey, key, itemName: key.fullName, type, enumerationType, enumeratorName};
}

export function customAttributeContainerIdentifier(schemaKey: SchemaKey, fullName: string, customAttributeName: string ): CustomAttributeContainerIdentifier {
  return { schemaKey, fullName, customAttributeName };
}

/** @internal */
export class SchemaEditingError extends BentleyError {
  private _ruleViolations?: AnyDiagnostic[];
  private _identifier: AnyIdentifier;
  private _schemaKey: SchemaKey;
  private _unknownError?: Error;

  public constructor(public override readonly errorNumber: number, public identifier: AnyIdentifier, public innerError?: AnyEditingError, ruleViolations?: AnyDiagnostic[], message?: string) {
    super(errorNumber, message);
    this._schemaKey = identifier.schemaKey;
    this._identifier = identifier;
    this._ruleViolations = ruleViolations;
    this.generateMessage();
  }

  public get schemaId(): SchemaIdentifier {
    if (!isSchemaIdentifier(this._identifier))
      throw Error("Identifier is not a SchemaIdentifier");
    return this._identifier as SchemaIdentifier;
  }

  public get schemaItemId(): SchemaItemIdentifier {
    if (!isSchemaItemIdentifier(this._identifier))
      throw Error("Identifier is not a SchemaItemIdentifier");
    return this._identifier as SchemaItemIdentifier;
  }

  public get propertyId(): PropertyIdentifier {
    if (!isPropertyIdentifier(this._identifier))
      throw Error("Identifier is not a PropertyIdentifier");
    return this._identifier as PropertyIdentifier;
  }

  public get enumerationId(): EnumerationIdentifier {
    if (!isEnumerationIdentifier(this._identifier))
      throw Error("Identifier is not a EnumerationIdentifier");
    return this._identifier as EnumerationIdentifier;
  }

  public get customAttributeContainerId(): CustomAttributeContainerIdentifier {
    if (!isCustomAttributeContainerIdentifier(this._identifier))
      throw Error("Identifier is not a CustomAttributeContainerIdentifier");
    return this._identifier as CustomAttributeContainerIdentifier;
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
        this.message = `Schema Key ${this.schemaKey.toString(true)} could not be found in the context.`;
        return;
      case ECEditingStatus.SchemaItemNotFound:
        this.message = `${this.schemaItemId.type} ${this.schemaItemId.itemName} could not be found in the schema ${this._schemaKey.name}.`;
        return;
      case ECEditingStatus.SchemaItemNotFoundInContext:
        this.message = `${this.schemaItemId.type} ${this.schemaItemId.itemName} could not be found in the schema context.`;
        return;
      case ECEditingStatus.InvalidSchemaItemType:
        this.message = `Expected ${this.schemaItemId.itemName} to be of type ${this.schemaItemId.type}.`;
        return;
      case ECEditingStatus.SchemaItemNameNotSpecified:
        this.message = `Could not create a new ${this.schemaItemId.type} in schema ${this._schemaKey.name}. No name was supplied within props.`;
        return;
      case ECEditingStatus.SchemaItemNameAlreadyExists:
        this.message = `${this.schemaItemId.type} ${this.schemaItemId.itemName} already exists in the schema ${this._schemaKey.name}.`;
        return;
      case ECEditingStatus.RuleViolation:
        this.message = `Rule violations occurred from ${this.schemaItemId.type} ${this.schemaItemId.itemName}: ${this.getRuleViolationMessage()}`;
        return;
      case ECEditingStatus.PropertyNotFound:
        this.message = `An ECProperty with the name ${this.propertyId.propertyName} could not be found in the class ${this.propertyId.itemName}.`;
        return;
      case ECEditingStatus.PropertyAlreadyExists:
        this.message = `An ECProperty with the name ${this.propertyId.propertyName} already exists in the class ${this.propertyId.itemName}.`;
        return;
      case ECEditingStatus.InvalidPropertyType:
        this.message = `Expected property ${this.propertyId.propertyName} to be of type ${this.propertyId.propertyType}.`;
        return;
      case ECEditingStatus.BaseClassIsNotElement:
        this.message = `Expected base class ${this.schemaItemId.itemName} to derive from BisCore.Element.`;
        return;
      case ECEditingStatus.BaseClassIsNotElementUniqueAspect:
        this.message = `Expected base class ${this.schemaItemId.itemName} to derive from BisCore.ElementUniqueAspect.`;
        return;
      case ECEditingStatus.BaseClassIsNotElementMultiAspect:
        this.message = `Expected base class ${this.schemaItemId.itemName} to derive from BisCore.ElementMultiAspect.`;
        return;
      case ECEditingStatus.InvalidFormatUnitsSpecified:
        this.message = `The specified Format unit ${this.schemaItemId.itemName} is not of type Unit or InvertedUnit`;
        return;
      case ECEditingStatus.InvalidEnumeratorType:
        const enumeratorType = this.enumerationId.enumerationType === "string" ? "integer" : "string";
        this.message = `The Enumeration ${this.enumerationId.itemName} has type ${this.enumerationId.enumerationType}, while ${this.enumerationId.enumeratorName} has type ${typeof (enumeratorType)}.`;
        return;
      case ECEditingStatus.EnumeratorDoesNotExist:
        this.message = `Enumerator ${this.enumerationId.enumeratorName} does not exists in Enumeration ${this.enumerationId.itemName}.`;
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
