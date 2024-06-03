/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { BentleyError } from "@itwin/core-bentley";
import { AnyDiagnostic } from "../Validation/Diagnostic";
import { AnyEnumerator, CustomAttributeContainerProps, Enumeration, primitiveTypeToString, Property, RelationshipConstraint, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";

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
  CreateSchemaItemFromProps,
  CreateElement,
  CreateElementUniqueAspect,
  CreateElementMultiAspect,
  SetBaseClass,
  SetSourceConstraint,
  SetTargetConstraint,
  AddConstraintClass,
  RemoveConstraintClass,
  SetAbstractConstraint,
  AddCustomAttributeToConstraint,
  AddCustomAttributeToProperty,
  AddCustomAttributeToClass,
  CreateNavigationProperty,
  CreateNavigationPropertyFromProps,
  SetInvertsUnit,
  SetUnitSystem,
  SetDescription,
  SetLabel,
  SetIsReadOnly,
  SetPriority,
  SetCategory,
  SetMinOccurs,
  SetMaxOccurs,
  SetExtendedTypeName,
  SetMinLength,
  SetMaxLength,
  SetMinValue,
  SetMaxValue,
  SetPropertyName,
  AddMixin,
  AddEnumerator,
  SetEnumeratorLabel,
  SetEnumeratorDescription,
  AddPresentationUnit,
  AddPresentationOverride,
  CreateFormatOverride,
  SetPropertyCategoryPriority,
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

export enum PropertyTypeName {
  ArrayProperty = "ArrayProperty",
  PrimitiveProperty = "PrimitiveProperty",
  EnumerationProperty = "EnumerationProperty",
  NavigationProperty = "NavigationProperty",
  StructProperty = "StructProperty"
}

type ECClassSchemaItems = SchemaItemType.EntityClass | SchemaItemType.StructClass | SchemaItemType.RelationshipClass | SchemaItemType.Mixin | SchemaItemType.CustomAttributeClass;

export interface SchemaTypeIdentifier {
  name: string;
}

export class SchemaId implements SchemaTypeIdentifier {
  public readonly name: string;
  public readonly schemaKey: SchemaKey;
  constructor(schemaKey: SchemaKey) {
    this.name = schemaKey.name;
    this.schemaKey = schemaKey;
  }
}

export class SchemaItemId implements SchemaTypeIdentifier {
  public readonly name: string;
  public readonly type: SchemaItemType;
  public readonly schemaKey: SchemaKey;
  public readonly schemaItemKey: SchemaItemKey;
  constructor(schemaItemType: SchemaItemType, schemaItemKeyOrName: SchemaItemKey | string, schemaKey?: SchemaKey) {
    if (typeof(schemaItemKeyOrName) === "string") {
      if (!schemaKey)
        throw new Error("schemaKey if required if the specified schemaItem the name of the schema item.");

      this.schemaKey = schemaKey!;
      this.schemaItemKey = new SchemaItemKey(schemaItemKeyOrName, schemaKey);
    } else {
      this.schemaKey = schemaItemKeyOrName.schemaKey;
      this.schemaItemKey = schemaItemKeyOrName;
    }

    this.type = schemaItemType;
    this.name = this.schemaItemKey.fullName;
  }
}

export class ClassId extends SchemaItemId {
  constructor(schemaItemType: ECClassSchemaItems, schemaItemKeyOrName: SchemaItemKey | string, schemaKey?: SchemaKey) {
    super(schemaItemType, schemaItemKeyOrName, schemaKey);
  }
}

export class PropertyId implements SchemaTypeIdentifier {
  public readonly name: string;
  public readonly fullName: string;
  public readonly ecClass: ClassId;
  public readonly schemaKey: SchemaKey;
  public readonly typeName?: PropertyTypeName;

  constructor(schemaItemType: ECClassSchemaItems, classKey: SchemaItemKey, property: Property | string, typeName?: PropertyTypeName) {
    this.name = property instanceof Property ? property.name : property;
    this.fullName = property instanceof Property ? property.fullName : `${classKey.name}.${property}`;
    this.ecClass = new ClassId(schemaItemType, classKey);
    this.schemaKey = classKey.schemaKey;
    this.typeName = typeName;
  }
}

export class EnumerationId extends SchemaItemId {
  public readonly enumerationType: string;
  public readonly enumeratorName: string;
  public readonly enumeratorType: string;
  constructor(enumeration: Enumeration, enumerator: AnyEnumerator | string) {
    super(SchemaItemType.Enumeration, enumeration.key);
    this.enumerationType = enumeration.type ? primitiveTypeToString(enumeration.type) : "string";
    this.enumeratorName = typeof(enumerator) === "string" ? enumerator : enumerator.name;
    this.enumeratorType = this.getEnumeratorType(enumeration, enumerator);
  }

  private getEnumeratorType(enumeration: Enumeration, enumerator: AnyEnumerator | string) {
    if (typeof(enumerator) === "string")
      return enumeration.isString ? "string" : "int";

    return typeof(enumerator.value) === "string" ? "string" : "int";
  }
}

export class CustomAttributeId implements SchemaTypeIdentifier {
  public readonly name: string;
  public readonly schemaKey: SchemaKey;
  public readonly containerFullName: string;
  constructor(name: string, container: CustomAttributeContainerProps) {
    this.name = name;
    this.schemaKey = container.schema.schemaKey;
    this.containerFullName = container.fullName;
  }
}

export class RelationshipConstraintId implements SchemaTypeIdentifier {
  public readonly name: string;
  public readonly relationshipKey: SchemaItemKey;
  public readonly schemaKey: SchemaKey;
  constructor(constraint: RelationshipConstraint) {
    this.name = constraint.fullName;
    this.relationshipKey = constraint.relationshipClass.key;
    this.schemaKey = this.relationshipKey.schemaKey;
  }
}

type AnyIdentifier = SchemaId | PropertyId | CustomAttributeId | RelationshipConstraintId | EnumerationId;

export function isSchemaIdentifier(identifier: AnyIdentifier): identifier is SchemaId {
  return identifier instanceof SchemaId;
}

export function isSchemaItemIdentifier(identifier: AnyIdentifier): identifier is SchemaItemId {
  return identifier instanceof SchemaItemId;
}

export function isClassIdentifier(identifier: AnyIdentifier): identifier is ClassId {
  return identifier instanceof ClassId;
}

export function isPropertyIdentifier(identifier: AnyIdentifier): identifier is PropertyId {
  return identifier instanceof PropertyId;
}

export function isEnumerationIdentifier(identifier: AnyIdentifier): identifier is EnumerationId {
  return identifier instanceof EnumerationId;
}

export function isCustomAttributeIdentifier(identifier: AnyIdentifier): identifier is CustomAttributeId {
  return identifier instanceof CustomAttributeId;
}

export function isRelationshipConstraintIdentifier(identifier: AnyIdentifier): identifier is RelationshipConstraintId {
  return identifier instanceof RelationshipConstraintId;
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

  public get schemaId(): SchemaId {
    if (!isSchemaIdentifier(this._identifier))
      throw new Error("identifier is not a SchemaId.");

    return this._identifier as SchemaId;
  }

  public get schemaItemId(): SchemaItemId {
    if (!isSchemaItemIdentifier(this._identifier))
      throw new Error("identifier is not a SchemaItemId.");
    return this._identifier as SchemaItemId;
  }

  public get classId(): ClassId {
    if (!isClassIdentifier(this._identifier))
      throw new Error("identifier is not a ClassId.");
    return this._identifier;
  }

  public get propertyId(): PropertyId {
    if (!isPropertyIdentifier(this._identifier))
      throw new Error("identifier is not a PropertyId.");
    return this._identifier;
  }

  public get enumerationId(): EnumerationId {
    if (!isEnumerationIdentifier(this._identifier))
      throw new Error("identifier is not a EnumerationId.");
    return this._identifier;
  }

  public get customAttributeId(): CustomAttributeId {
    if (!isCustomAttributeIdentifier(this._identifier))
      throw new Error("identifier is not a CustomAttributeId.");
    return this._identifier;
  }

  public get relationshipConstraintId(): RelationshipConstraintId {
    if (!isRelationshipConstraintIdentifier(this._identifier))
      throw new Error("identifier is not a RelationshipConstraintId.");
    return this._identifier;
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
        this.message = `${this.schemaItemId.type} ${this.schemaItemId.name} could not be found in the schema ${this._schemaKey.name}.`;
        return;
      case ECEditingStatus.SchemaItemNotFoundInContext:
        this.message = `${this.schemaItemId.type} ${this.schemaItemId.name} could not be found in the schema context.`;
        return;
      case ECEditingStatus.InvalidSchemaItemType:
        this.message = `Expected ${this.schemaItemId.name} to be of type ${this.schemaItemId.type}.`;
        return;
      case ECEditingStatus.SchemaItemNameNotSpecified:
        this.message = `Could not create a new ${this.schemaItemId.type} in schema ${this._schemaKey.name}. No name was supplied within props.`;
        return;
      case ECEditingStatus.SchemaItemNameAlreadyExists:
        this.message = `${this.schemaItemId.type} ${this.schemaItemId.name} already exists in the schema ${this._schemaKey.name}.`;
        return;
      case ECEditingStatus.RuleViolation:
        this.message = this.getRuleViolationMessage();
        return;
      case ECEditingStatus.PropertyNotFound:
        this.message = `An ECProperty with the name ${this.propertyId.name} could not be found in the class ${this.propertyId.ecClass.name}.`;
        return;
      case ECEditingStatus.PropertyAlreadyExists:
        this.message = `An ECProperty with the name ${this.propertyId.name} already exists in the class ${this.propertyId.ecClass.name}.`;
        return;
      case ECEditingStatus.InvalidPropertyType:
        this.message = `Expected property ${this.propertyId.name} to be of type ${this.propertyId.typeName}.`;
        return;
      case ECEditingStatus.BaseClassIsNotElement:
        this.message = `Expected base class ${this.schemaItemId.name} to derive from BisCore.Element.`;
        return;
      case ECEditingStatus.BaseClassIsNotElementUniqueAspect:
        this.message = `Expected base class ${this.schemaItemId.name} to derive from BisCore.ElementUniqueAspect.`;
        return;
      case ECEditingStatus.BaseClassIsNotElementMultiAspect:
        this.message = `Expected base class ${this.schemaItemId.name} to derive from BisCore.ElementMultiAspect.`;
        return;
      case ECEditingStatus.InvalidFormatUnitsSpecified:
        this.message = `The specified Format unit ${this.schemaItemId.name} is not of type Unit or InvertedUnit`;
        return;
      case ECEditingStatus.InvalidEnumeratorType:
        this.message = `The Enumeration ${this.enumerationId.name} has type ${this.enumerationId.enumerationType}, while Enumerator ${this.enumerationId.enumeratorName} has type ${this.enumerationId.enumeratorType}.`;
        return;
      case ECEditingStatus.EnumeratorDoesNotExist:
        this.message = `Enumerator ${this.enumerationId.enumeratorName} does not exists in Enumeration ${this.enumerationId.name}.`;
        return;
      case ECEditingStatus.InvalidECName:
        this.message = `Could not rename class ${this.schemaItemId.name} because the specified name is not a valid ECName.`;
        return;
    }
  }

  private getRuleViolationMessage(): string {
    if (!this._ruleViolations)
      return "";

    let violations = "";
    for (const diagnostic of this._ruleViolations) {
      violations += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
    }

    if (isSchemaIdentifier(this.identifier))
      return `Rule violations occurred from Schema ${this.schemaId.name}: ${violations}`;

    if (isSchemaItemIdentifier(this.identifier))
      return `Rule violations occurred from ${this.schemaItemId.type} ${this.schemaItemId.name}: ${violations}`;

    if (isCustomAttributeIdentifier(this.identifier))
      return `Rule violations occurred from CustomAttribute ${this.customAttributeId.name}, container ${this.customAttributeId.containerFullName}: ${violations}`;

    if (isRelationshipConstraintIdentifier(this.identifier))
      return `Rule violations occurred from constraint ${this.relationshipConstraintId.name} of RelationshipClass ${this.relationshipConstraintId.relationshipKey.fullName}: ${violations}`;

    throw new Error ("Could not generate rule violation message due to invalid identifier.");
  }
}
