/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { AnyDiagnostic } from "../Validation/Diagnostic";
import { AnyEnumerator, CustomAttributeContainerProps, Enumeration, PrimitiveType, primitiveTypeToString, Property, RelationshipConstraint, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";

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

/**
 * A type that constrains the possible error types handled by SchemaEditingError
 */
export type AnyEditingError = SchemaEditingError | Error;

/**
 * Defines the possible property type names.
 */
export enum PropertyTypeName {
  ArrayProperty = "ArrayProperty",
  PrimitiveProperty = "PrimitiveProperty",
  EnumerationProperty = "EnumerationProperty",
  NavigationProperty = "NavigationProperty",
  StructProperty = "StructProperty"
}

/**
 * Defines the possible schema type identifiers.
 */
export enum SchemaTypeIdentifiers {
  SchemaIdentifier = "Schema",
  SchemaItemIdentifier = "SchemaItem",
  ClassIdentifier = "Class",
  PropertyIdentifier = "Property",
  EnumerationIdentifier = "Enumeration",
  EnumeratorIdentifier = "Enumerator",
  CustomAttributeIdentifier = "CustomAttribute",
  RelationshipConstraintIdentifier = "RelationshipConstraint"
}

/**
 * Type that constrains SchemaItemType enum to those used by EC Class types.
 */
type ECClassSchemaItems = SchemaItemType.EntityClass | SchemaItemType.StructClass | SchemaItemType.RelationshipClass | SchemaItemType.Mixin | SchemaItemType.CustomAttributeClass;

/**
 * Type that defines the possible SchemaTypeIdentifiers for SchemaItemId classes.
 */
type AnySchemaItemTypeIdentifier = SchemaTypeIdentifiers.SchemaItemIdentifier | SchemaTypeIdentifiers.ClassIdentifier;

/**
 * Type that encompasses all ISchemaTypeIdentifier interfaces
 */
type AnyIdentifier = ISchemaIdentifier | ISchemaItemIdentifier | IClassIdentifier | IPropertyIdentifier | ICustomAttributeIdentifier | IRelationshipConstraintIdentifier | IEnumeratorIdentifier;

/**
 * A base interface that defines what is needed to identity any schema type.
 * @beta
 */
interface ISchemaTypeIdentifier {
  readonly name: string;
  readonly schemaKey: SchemaKey;
  readonly typeIdentifier: SchemaTypeIdentifiers;
}

/**
 * Interface that defines the data needed to identify a Schema.
 */
interface ISchemaIdentifier extends ISchemaTypeIdentifier {
  readonly typeIdentifier: SchemaTypeIdentifiers.SchemaIdentifier;
}

/**
 * Interface that defines the data needed to identify a SchemaItem.
 */
interface ISchemaItemIdentifier extends ISchemaTypeIdentifier {
  readonly schemaItemType: SchemaItemType;
  readonly schemaItemKey: SchemaItemKey;
  readonly typeIdentifier: AnySchemaItemTypeIdentifier;
}

/**
 * Interface that defines the data needed to identify an EC Class.
 */
interface IClassIdentifier extends ISchemaTypeIdentifier {
  readonly schemaItemType: ECClassSchemaItems;
  readonly schemaItemKey: SchemaItemKey;
  readonly typeIdentifier: SchemaTypeIdentifiers.ClassIdentifier;
}

/**
 * Interface that defines the data needed to identify an EC Property.
 */
interface IPropertyIdentifier extends ISchemaTypeIdentifier {
  readonly fullName: string;
  readonly ecClass: ClassId;
  readonly typeName?: PropertyTypeName;
  readonly typeIdentifier: SchemaTypeIdentifiers.PropertyIdentifier;
}

/**
 * Interface that defines the data needed to identify an Enumerator.
 */
interface IEnumeratorIdentifier extends ISchemaTypeIdentifier {
  readonly enumeratorType: string;
  readonly enumeration: SchemaItemKey;
  readonly enumerationType: string;
  readonly typeIdentifier: SchemaTypeIdentifiers.EnumeratorIdentifier;
}

/**
 * Interface that defines the data needed to identify a CustomAttribute.
 */
interface ICustomAttributeIdentifier extends ISchemaTypeIdentifier {
  readonly containerFullName: string;
  readonly typeIdentifier: SchemaTypeIdentifiers.CustomAttributeIdentifier;
}

/**
 * Interface that defines the data needed to identify a RelationshipConstraint.
 */
interface IRelationshipConstraintIdentifier extends ISchemaTypeIdentifier {
  readonly relationshipKey: SchemaItemKey;
  readonly typeIdentifier: SchemaTypeIdentifiers.RelationshipConstraintIdentifier;
}

/**
 * An ISchemaIdentifier implementation to identify Schemas
 */
export class SchemaId implements ISchemaIdentifier {
  public readonly typeIdentifier = SchemaTypeIdentifiers.SchemaIdentifier;
  public readonly name: string;
  public readonly schemaKey: SchemaKey;
  constructor(schemaKey: SchemaKey) {
    this.name = schemaKey.name;
    this.schemaKey = schemaKey;
  }
}

/**
 * An ISchemItemIdentifier implementation to identify SchemaItems
 */
export class SchemaItemId implements ISchemaItemIdentifier {
  public readonly typeIdentifier: AnySchemaItemTypeIdentifier;
  public readonly name: string;
  public readonly schemaKey: SchemaKey;
  public readonly schemaItemType: SchemaItemType;
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

    this.schemaItemType = schemaItemType;
    this.name = this.schemaItemKey.fullName;
    this.typeIdentifier = SchemaTypeIdentifiers.SchemaItemIdentifier;
  }
}

/**
 * An IClassIdentifier implementation to identify Class instances.
 */
export class ClassId extends SchemaItemId implements IClassIdentifier {
  public override readonly typeIdentifier = SchemaTypeIdentifiers.ClassIdentifier;
  public override readonly schemaItemType: ECClassSchemaItems;
  constructor(schemaItemType: ECClassSchemaItems, schemaItemKeyOrName: SchemaItemKey | string, schemaKey?: SchemaKey) {
    super(schemaItemType, schemaItemKeyOrName, schemaKey);
    this.schemaItemType = schemaItemType;
  }
}

/**
 * An IPropertyIdentifier implementation to identify Property instances.
 */
export class PropertyId implements IPropertyIdentifier {
  public readonly typeIdentifier = SchemaTypeIdentifiers.PropertyIdentifier;
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

/**
 * An IEnumeratorIdentifier implementation to identify Enumerator instances.
 */
export class EnumeratorId implements IEnumeratorIdentifier{
  public readonly typeIdentifier = SchemaTypeIdentifiers.EnumeratorIdentifier;
  public readonly enumeration: SchemaItemKey;
  public readonly enumerationType: string;
  public readonly enumeratorType: string;
  public readonly name: string;
  public readonly schemaKey: SchemaKey;

  constructor(enumerator: AnyEnumerator | string, enumeration: Enumeration) {
    this.enumeration = enumeration.key;
    this.enumerationType = enumeration.type ? primitiveTypeToString(enumeration.type): "string";
    this.enumeratorType = getEnumeratorType(enumeration ?? PrimitiveType.String, enumerator);
    this.name = typeof(enumerator) === "string" ? enumerator : enumerator.name;
    this.schemaKey = enumeration.schema.schemaKey;
  }
}

/**
 * An ICustomAttributeIdentifier implementation to identify CustomAttribute instances.
 */
export class CustomAttributeId implements ICustomAttributeIdentifier {
  public readonly typeIdentifier = SchemaTypeIdentifiers.CustomAttributeIdentifier;
  public readonly name: string;
  public readonly schemaKey: SchemaKey;
  public readonly containerFullName: string;
  constructor(name: string, container: CustomAttributeContainerProps) {
    this.name = name;
    this.schemaKey = container.schema.schemaKey;
    this.containerFullName = container.fullName;
  }
}

/**
 * An IRelationshipConstraintIdentifier implementation to identify RelationshipConstraints.
 */
export class RelationshipConstraintId implements IRelationshipConstraintIdentifier {
  public readonly typeIdentifier = SchemaTypeIdentifiers.RelationshipConstraintIdentifier;
  public readonly name: string;
  public readonly relationshipKey: SchemaItemKey;
  public readonly schemaKey: SchemaKey;
  constructor(constraint: RelationshipConstraint) {
    this.name = constraint.isSource ? "Source" : "Target";
    this.relationshipKey = constraint.relationshipClass.key;
    this.schemaKey = this.relationshipKey.schemaKey;
  }
}

/**
 * @internal
 * An exception class for the ecschema-editing API. Contains identifiers for schema types involved in the
 * exception. An example being SchemaItemId which contains the name of the SchemaItem, SchemaItemKey, SchemaItemType, etc.
 * Typically will contain an innerError of type SchemaEditingError containing the identifier of the schema item that
 * caused the exception. The containing error instance will identify the method called (identified by the errorNumber)
 * and the identifier of the schema item being modified/created.
 */
export class SchemaEditingError extends Error {
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
  public constructor(public readonly errorNumber: ECEditingStatus, public readonly identifier: AnyIdentifier, public readonly innerError?: AnyEditingError, ruleViolations?: AnyDiagnostic[], message?: string) {
    super(message);
    this._ruleViolations = ruleViolations;
    this._schemaKey = identifier.schemaKey,
    this.generateMessage();
  }

  /**
   * Gets the SchemaId instance.
   * @throws Error if the identifier is not an instance of SchemaId.
   */
  public get schemaId(): SchemaId {
    if (this.identifier.typeIdentifier !== SchemaTypeIdentifiers.SchemaIdentifier)
      throw new Error("identifier is not a SchemaId.");
    return this.identifier as SchemaId;
  }

  /**
   * Gets the SchemaItemId instance.
   * @throws Error if the identifier is not an instance of SchemaItemId.
   */
  public get schemaItemId(): SchemaItemId {
    if (this.isSchemaItemIdentifier(this.identifier))
      throw new Error("identifier is not a SchemaItemId.");
    return this.identifier as SchemaItemId;
  }

  /**
   * Gets the ClassId instance.
   * @throws Error if the identifier is not an instance of ClassId.
   */
  public get classId(): ClassId {
    if (this.identifier.typeIdentifier !== SchemaTypeIdentifiers.ClassIdentifier)
      throw new Error("identifier is not a ClassId.");
    return this.identifier as ClassId;
  }

  /**
   * Gets the PropertyId instance.
   * @throws Error if the identifier is not an instance of PropertyId.
   */
  public get propertyId(): PropertyId {
    if (this.identifier.typeIdentifier !== SchemaTypeIdentifiers.PropertyIdentifier)
      throw new Error("identifier is not a PropertyId.");
    return this.identifier;
  }

  /**
   * Gets the EnumeratorId instance.
   * @throws Error if the identifier is not an instance of EnumeratorId.
   */
  public get enumeratorId(): EnumeratorId {
    if (this.identifier.typeIdentifier !== SchemaTypeIdentifiers.EnumeratorIdentifier)
      throw new Error("identifier is not a EnumerationId.");
    return this.identifier as EnumeratorId;
  }

  /**
   * Gets the CustomAttributeId instance.
   * @throws Error if the identifier is not an instance of CustomAttributeId.
   */
  public get customAttributeId(): CustomAttributeId {
    if (this.identifier.typeIdentifier !== SchemaTypeIdentifiers.CustomAttributeIdentifier)
      throw new Error("identifier is not a CustomAttributeId.");
    return this.identifier;
  }

  /**
   * Gets the RelationshipConstraintId instance.
   * @throws Error if the identifier is not an instance of RelationshipConstraintId.
   */
  public get relationshipConstraintId(): RelationshipConstraintId {
    if (this.identifier.typeIdentifier !== SchemaTypeIdentifiers.RelationshipConstraintIdentifier)
      throw new Error("identifier is not a RelationshipConstraintId.");
    return this.identifier;
  }

  /** Gets rule violations that were reported during validation. Returns an array of [[AnyDiagnostic]] if
   * the errorNumber is ECEditingStatus.RuleViolation, otherwise undefined.
   */
  public get ruleViolations(): AnyDiagnostic[] | undefined {
    return this._ruleViolations;
  }

  /**
   * Returns a readable string containing the ECEditingStatus along with the error message. Any
   * innerError will also be appended.
   * @returns
   */
  public toDebugString(): string {
    let innerMessage = "";
    if (this.innerError) {
      if (this.innerError instanceof SchemaEditingError)
        innerMessage = ` Inner error: ${this.innerError.toDebugString()}`;
      else
        innerMessage = ` Inner error: ${this.innerError.message}`;
    }
    return this._appendMessage(`ECEditingStatus.${ECEditingStatus[this.errorNumber]}`) + innerMessage;
  }

  private generateMessage() {
    if (this.message)
      return;

    switch(this.errorNumber) {
      case ECEditingStatus.SchemaNotFound:
        this.message = `Schema Key ${this._schemaKey.toString(true)} could not be found in the context.`;
        return;
      case ECEditingStatus.SchemaItemNotFound:
        this.message = `${this.schemaItemId.schemaItemType} ${this.schemaItemId.name} could not be found in the schema ${this._schemaKey.name}.`;
        return;
      case ECEditingStatus.SchemaItemNotFoundInContext:
        this.message = `${this.schemaItemId.schemaItemType} ${this.schemaItemId.name} could not be found in the schema context.`;
        return;
      case ECEditingStatus.InvalidSchemaItemType:
        this.message = `Expected ${this.schemaItemId.name} to be of type ${this.schemaItemId.schemaItemType}.`;
        return;
      case ECEditingStatus.SchemaItemNameNotSpecified:
        this.message = `Could not create a new ${this.schemaItemId.schemaItemType} in schema ${this._schemaKey.name}. No name was supplied within props.`;
        return;
      case ECEditingStatus.SchemaItemNameAlreadyExists:
        this.message = `${this.schemaItemId.schemaItemType} ${this.schemaItemId.name} already exists in the schema ${this._schemaKey.name}.`;
        return;
      case ECEditingStatus.RuleViolation:
        this.message = this._getRuleViolationMessage();
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
        this.message = `The Enumeration ${this.enumeratorId.enumeration.fullName} has type ${this.enumeratorId.enumerationType}, while Enumerator ${this.enumeratorId.name} has type ${this.enumeratorId.enumeratorType}.`;
        return;
      case ECEditingStatus.EnumeratorDoesNotExist:
        this.message = `Enumerator ${this.enumeratorId.name} does not exists in Enumeration ${this.enumeratorId.enumeration.name}.`;
        return;
      case ECEditingStatus.InvalidECName:
        this.message = `Could not rename class ${this.schemaItemId.name} because the specified name is not a valid ECName.`;
        return;
      default:
        this.message = this._createTaskErrorMessage();
    }
  }

  private _appendMessage(e: string) {
    return this.message ? `${e}: ${this.message}` : e;
  }

  private _getRuleViolationMessage(): string {
    if (!this._ruleViolations)
      return "";

    let violations = "";
    for (const diagnostic of this._ruleViolations) {
      violations += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
    }

    switch (this.identifier.typeIdentifier) {
      case SchemaTypeIdentifiers.SchemaIdentifier:
        return `Rule violations occurred from Schema ${this.schemaId.name}: ${violations}`;
      case SchemaTypeIdentifiers.SchemaItemIdentifier:
        return `Rule violations occurred from ${this.schemaItemId.schemaItemType} ${this.schemaItemId.name}: ${violations}`;
      case SchemaTypeIdentifiers.ClassIdentifier:
        return `Rule violations occurred from ${this.schemaItemId.schemaItemType} ${this.schemaItemId.name}: ${violations}`;
      case SchemaTypeIdentifiers.CustomAttributeIdentifier:
        return `Rule violations occurred from CustomAttribute ${this.customAttributeId.name}, container ${this.customAttributeId.containerFullName}: ${violations}`;
      case SchemaTypeIdentifiers.RelationshipConstraintIdentifier:
        return `Rule violations occurred from ${this.relationshipConstraintId.name} constraint of RelationshipClass ${this.relationshipConstraintId.relationshipKey.fullName}: ${violations}`;
      default:
        throw new Error ("Invalid identifier.");
    }
  }

  private _createTaskErrorMessage() {
    // Make sure we have an inner error or else it is not a task error
    if (!this.innerError)
      return "";

    switch (this.identifier.typeIdentifier) {
      case SchemaTypeIdentifiers.SchemaIdentifier:
      case SchemaTypeIdentifiers.SchemaItemIdentifier:
      case SchemaTypeIdentifiers.ClassIdentifier:
      case SchemaTypeIdentifiers.RelationshipConstraintIdentifier:
        return `While performing task '${ECEditingStatus[this.errorNumber]}' an error occurred editing ${this.identifier.typeIdentifier} ${this.identifier.name}.`;
      case SchemaTypeIdentifiers.PropertyIdentifier:
        return `While performing task '${ECEditingStatus[this.errorNumber]}' an error occurred editing ${this.identifier.typeIdentifier} ${this.identifier.fullName}.`;
      default:
        throw new Error ("Invalid identifier.");
    }
  }

  private isSchemaItemIdentifier(identifier: AnyIdentifier) {
    if (identifier.typeIdentifier !== SchemaTypeIdentifiers.SchemaItemIdentifier &&
      identifier.typeIdentifier !== SchemaTypeIdentifiers.ClassIdentifier)
      return true;

    return false;
  }
}

function getEnumeratorType(enumeration: Enumeration, enumerator: AnyEnumerator | string) {
  if (typeof(enumerator) === "string") {
    return enumeration.type ? primitiveTypeToString(enumeration.type) : "string";
  }

  return typeof(enumerator.value) === "string" ? "string" : "int";
}
