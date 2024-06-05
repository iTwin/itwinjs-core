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

/**
 * Indicates if the given identifier is a SchemaId instance.
 * @param identifier The identifier to check.
 * @returns true if the identifier is the correct type.
 */
export function isSchemaIdentifier(identifier: AnyIdentifier): identifier is SchemaId {
  return identifier instanceof SchemaId;
}

/**
 * Indicates if the given identifier is a SchemaId instance.
 * @param identifier The identifier to check.
 * @returns true if the identifier is the correct type.
 */
export function isSchemaItemIdentifier(identifier: AnyIdentifier): identifier is SchemaItemId {
  return identifier instanceof SchemaItemId;
}

/**
 * Indicates if the given identifier is a ClassId instance.
 * @param identifier The identifier to check.
 * @returns true if the identifier is the correct type.
 */
export function isClassIdentifier(identifier: AnyIdentifier): identifier is ClassId {
  return identifier instanceof ClassId;
}

/**
 * Indicates if the given identifier is a PropertyId instance.
 * @param identifier The identifier to check.
 * @returns true if the identifier is the correct type.
 */
export function isPropertyIdentifier(identifier: AnyIdentifier): identifier is PropertyId {
  return identifier instanceof PropertyId;
}

/**
 * Indicates if the given identifier is a EnumerationId instance.
 * @param identifier The identifier to check.
 * @returns true if the identifier is the correct type.
 */
export function isEnumerationIdentifier(identifier: AnyIdentifier): identifier is EnumerationId {
  return identifier instanceof EnumerationId;
}

/**
 * Indicates if the given identifier is a CustomAttributeId instance.
 * @param identifier The identifier to check.
 * @returns true if the identifier is the correct type.
 */
export function isCustomAttributeIdentifier(identifier: AnyIdentifier): identifier is CustomAttributeId {
  return identifier instanceof CustomAttributeId;
}

/**
 * Indicates if the given identifier is a RelationshipConstraintId instance.
 * @param identifier The identifier to check.
 * @returns true if the identifier is the correct type.
 */
export function isRelationshipConstraintIdentifier(identifier: AnyIdentifier): identifier is RelationshipConstraintId {
  return identifier instanceof RelationshipConstraintId;
}

/**
 * @internal
 * An exception class for the ecschema-editing API. Contains identifiers for schema types involved in the
 * exception. An example being SchemaItemId which contains the name of the SchemaItem, SchemaItemKey, SchemaItemType, etc.
 * Typically will contain an innerError of type SchemaEditingError containing the identifier of the schema item that
 * caused the exception. The containing error instance will identify the method called (identified by the errorNumber)
 * and the identifier of the schema item being modified/created.
 */
export class SchemaEditingError extends BentleyError {
  private _ruleViolations?: AnyDiagnostic[];
  private _schemaKey: SchemaKey;

  /**
   * Constructs a new SchemaEditingError instance.
   * @param errorNumber The unique ECEditingStatus code identifying the error.
   * @param identifier The identifier instance containing information about the EC object involved with the exception.
   * @param innerError The SchemaEditingError containing the identifier of the EC object that caused the initial exception.
   * @param ruleViolations Will contain EC rule violations of type [[AnyDiagnostic]] for exceptions with the error code ECEditingStatus.RuleViolation.
   * @param message Optional error message. Most messages on automatically generated by this class based on the ECEditingStatus code.
   */
  public constructor(public override readonly errorNumber: number, public readonly identifier: AnyIdentifier, public readonly innerError?: AnyEditingError, ruleViolations?: AnyDiagnostic[], message?: string) {
    super(errorNumber, message);
    this._ruleViolations = ruleViolations;
    this._schemaKey = identifier.schemaKey,
    this.generateMessage();
  }

  /**
   * Gets the SchemaId instance.
   * @throws Error if the identifier is not an instance of SchemaId.
   */
  public get schemaId(): SchemaId {
    if (!isSchemaIdentifier(this.identifier))
      throw new Error("identifier is not a SchemaId.");
    return this.identifier as SchemaItemId;
  }

  /**
   * Gets the SchemaItemId instance.
   * @throws Error if the identifier is not an instance of SchemaItemId.
   */
  public get schemaItemId(): SchemaItemId {
    if (!isSchemaItemIdentifier(this.identifier))
      throw new Error("identifier is not a SchemaItemId.");
    return this.identifier as SchemaItemId;
  }

  /**
   * Gets the ClassId instance.
   * @throws Error if the identifier is not an instance of ClassId.
   */
  public get classId(): ClassId {
    if (!isClassIdentifier(this.identifier))
      throw new Error("identifier is not a ClassId.");
    return this.identifier;
  }

  /**
   * Gets the PropertyId instance.
   * @throws Error if the identifier is not an instance of PropertyId.
   */
  public get propertyId(): PropertyId {
    if (!isPropertyIdentifier(this.identifier))
      throw new Error("identifier is not a PropertyId.");
    return this.identifier;
  }

  /**
   * Gets the EnumerationId instance.
   * @throws Error if the identifier is not an instance of EnumerationId.
   */
  public get enumerationId(): EnumerationId {
    if (!isEnumerationIdentifier(this.identifier))
      throw new Error("identifier is not a EnumerationId.");
    return this.identifier;
  }

  /**
   * Gets the CustomAttributeId instance.
   * @throws Error if the identifier is not an instance of CustomAttributeId.
   */
  public get customAttributeId(): CustomAttributeId {
    if (!isCustomAttributeIdentifier(this.identifier))
      throw new Error("identifier is not a CustomAttributeId.");
    return this.identifier;
  }

  /**
   * Gets the RelationshipConstraintId instance.
   * @throws Error if the identifier is not an instance of RelationshipConstraintId.
   */
  public get relationshipConstraintId(): RelationshipConstraintId {
    if (!isRelationshipConstraintIdentifier(this.identifier))
      throw new Error("identifier is not a RelationshipConstraintId.");
    return this.identifier;
  }

  public get ruleViolations(): AnyDiagnostic[] | undefined {
    return this._ruleViolations;
  }

  public toDebugString(): string {
    let innerMessage = "";
    if (this.innerError) {
      if (this.innerError instanceof SchemaEditingError)
        innerMessage = `: Inner error: ${this.innerError.toDebugString()}`;
      else
        innerMessage = `: Inner error: ${this.innerError.message}`;
    }
    return this._appendMessage(`ECEditingStatus.${ECEditingStatus[this.errorNumber]}`) + innerMessage;
  }

  private _appendMessage(e: string) {
    return this.message ? `${e}: ${this.message}` : e;
  }

  private generateMessage() {
    if (this.message)
      return;

    switch(this.errorNumber) {
      case ECEditingStatus.SchemaNotFound:
        this.message = `Schema Key ${this._schemaKey.toString(true)} could not be found in the context.`;
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
