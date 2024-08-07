import { SchemaItemType, SchemaKey, SchemaItemKey, Property, AnyEnumerator, Enumeration, primitiveTypeToString, PrimitiveType, CustomAttributeContainerProps, RelationshipConstraint, ECClass } from "@itwin/ecschema-metadata";

/**
 * Defines the possible property type names.
 * @alpha
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
 * @alpha
 */
export enum SchemaTypeIdentifiers {
  SchemaIdentifier = "Schema",
  SchemaItemIdentifier = "SchemaItem",
  ClassIdentifier = "Class",
  BaseClassIdentifier = "BaseClass",
  PropertyIdentifier = "Property",
  EnumeratorIdentifier = "Enumerator",
  CustomAttributeIdentifier = "CustomAttribute",
  RelationshipConstraintIdentifier = "RelationshipConstraint",
  AbstractConstraintIdentifier = "AbstractRelationshipConstraint"
}

/**
 * Type that constrains SchemaItemType enum to those used by EC Class types.
 * @alpha
 */
export type ECClassSchemaItems = SchemaItemType.EntityClass | SchemaItemType.StructClass | SchemaItemType.RelationshipClass | SchemaItemType.Mixin | SchemaItemType.CustomAttributeClass;

/**
 * Type that defines the possible SchemaTypeIdentifiers for SchemaItemId classes.
 * @alpha
 */
export type AnySchemaItemTypeIdentifier = SchemaTypeIdentifiers.SchemaItemIdentifier | SchemaTypeIdentifiers.ClassIdentifier | SchemaTypeIdentifiers.BaseClassIdentifier;

/**
 * Type that encompasses all ISchemaTypeIdentifier interfaces
 * @alpha
 */
export type AnyIdentifier = ISchemaIdentifier | ISchemaItemIdentifier | IClassIdentifier | IBaseClassIdentifier | IPropertyIdentifier | ICustomAttributeIdentifier | IRelationshipConstraintIdentifier | IEnumeratorIdentifier;

/**
 * JSON Object interface to deserialize into a ISchemaTypeIdentifier
 */
export interface SchemaTypeIdentifierProps {
  readonly name: string;
  readonly schemaKey: string;
  readonly typeIdentifier: string;
}

/**
 * A base interface that defines what is needed to identity any schema type.
 * @alpha
 */
export interface ISchemaTypeIdentifier {
  readonly name: string;
  readonly schemaKey: SchemaKey;
  readonly typeIdentifier: SchemaTypeIdentifiers;
}

/**
 * JSON Object interface to deserialize into a ISchemaIdentifier
 */
export type SchemaIdentifierProps = SchemaTypeIdentifierProps;

/**
 * JSON Object interface to deserialize into an IClassIdentifier
 */
export type ClassIdentifierProps = SchemaIdentifierProps;

/**
 * JSON Object interface to deserialize into an ISchemaItemIdentifier
 */
export interface SchemaItemIdentifierProps extends SchemaTypeIdentifierProps {
  readonly schemaItemType: string;
  readonly schemaItemKey: string;
}

/**
 * JSON Object interface to deserialize into an IBaseClassIdentifier
 */
export interface BaseClassIdentifierProps extends SchemaTypeIdentifierProps {
  readonly schemaItemType: string;
  readonly schemaItemKey: string;
  readonly baseClass?: ClassIdentifierProps;
}

/**
 * JSON Object interface to deserialize into an IPropertyIdentifier
 */
export interface PropertyIdentifierProps extends SchemaTypeIdentifierProps{
  readonly fullName?: string;
  readonly ecClass?: ClassIdentifierProps;
  readonly typeName?: PropertyTypeName;
}

/**
 * JSON Object interface to deserialize into an IEnumeratorIdentifier
 */
export interface EnumeratorIdentifierProps extends SchemaTypeIdentifierProps{
  readonly enumeratorType: string;
  readonly enumeration: SchemaItemIdentifierProps;
  readonly enumerationType: string;
}

/**
 * JSON Object interface to deserialize into an ICustomAttributeIdentifier
 */
export interface CustomAttributeIdentifierProps extends SchemaTypeIdentifierProps{
  readonly containerFullName: string;
}

/**
 * JSON Object interface to deserialize into an ICustomAttributeIdentifier
 */
export interface RelationshipConstraintIdentifierProps extends ISchemaTypeIdentifier{
  readonly relationshipKey: SchemaItemIdentifierProps;
}

/**
 * JSON Object interface to deserialize into an IAbstractConstraintIdentifier
 */
export interface AbstractConstraintIdentifierProps extends ISchemaTypeIdentifier{
  readonly relationshipKey: SchemaItemIdentifierProps;
  readonly abstractConstraintKey: SchemaItemIdentifierProps;
}

/**
 * Interface that defines the data needed to identify a Schema.
 * @alpha
 */
export interface ISchemaIdentifier extends ISchemaTypeIdentifier {
  readonly typeIdentifier: SchemaTypeIdentifiers.SchemaIdentifier;
}

/**
 * Interface that defines the data needed to identify a SchemaItem.
 * @alpha
 */
export interface ISchemaItemIdentifier extends ISchemaTypeIdentifier {
  readonly schemaItemType: SchemaItemType;
  readonly schemaItemKey: SchemaItemKey;
  readonly typeIdentifier: AnySchemaItemTypeIdentifier;
}

/**
 * Interface that defines the data needed to identify an EC Class.
 * @alpha
 */
export interface IClassIdentifier extends ISchemaTypeIdentifier {
  readonly schemaItemType: ECClassSchemaItems;
  readonly schemaItemKey: SchemaItemKey;
  readonly typeIdentifier: SchemaTypeIdentifiers.ClassIdentifier;
}

/**
 * Interface that defines the data needed to identify an EC base Class.
 * @alpha
 */
export interface IBaseClassIdentifier extends ISchemaTypeIdentifier {
  readonly schemaItemType: ECClassSchemaItems;
  readonly schemaItemKey: SchemaItemKey;
  readonly typeIdentifier: SchemaTypeIdentifiers.BaseClassIdentifier;
  readonly baseClass: ClassId;
}

/**
 * Interface that defines the data needed to identify an EC Property.
 * @alpha
 */
export interface IPropertyIdentifier extends ISchemaTypeIdentifier {
  readonly fullName: string;
  readonly ecClass: ClassId;
  readonly typeName?: PropertyTypeName;
  readonly typeIdentifier: SchemaTypeIdentifiers.PropertyIdentifier;
}

/**
 * Interface that defines the data needed to identify an Enumerator.
 * @alpha
 */
interface IEnumeratorIdentifier extends ISchemaTypeIdentifier {
  readonly enumeratorType: string;
  readonly enumeration: SchemaItemKey;
  readonly enumerationType: string;
  readonly typeIdentifier: SchemaTypeIdentifiers.EnumeratorIdentifier;
}

/**
 * Interface that defines the data needed to identify a CustomAttribute.
 * @alpha
 */
export interface ICustomAttributeIdentifier extends ISchemaTypeIdentifier {
  readonly containerFullName: string;
  readonly typeIdentifier: SchemaTypeIdentifiers.CustomAttributeIdentifier;
}

/**
 * Interface that defines the data needed to identify a RelationshipConstraint.
 * @alpha
 */
export interface IRelationshipConstraintIdentifier extends ISchemaTypeIdentifier {
  readonly relationshipKey: SchemaItemKey;
  readonly typeIdentifier: SchemaTypeIdentifiers.RelationshipConstraintIdentifier;
}

/**
 * Interface that defines the data needed to identify an AbstractConstraint.
 * @alpha
 */
export interface IAbstractConstraintIdentifier extends ISchemaTypeIdentifier {
  readonly relationshipKey: SchemaItemKey;
  readonly typeIdentifier: SchemaTypeIdentifiers.AbstractConstraintIdentifier;
  readonly abstractConstraintKey: SchemaItemKey;
}

/**
 * An ISchemaIdentifier implementation to identify Schemas
 * @alpha
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
 * @alpha
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
 * @alpha
 */
export class ClassId extends SchemaItemId implements IClassIdentifier {
  public override readonly typeIdentifier = SchemaTypeIdentifiers.ClassIdentifier;
  public override readonly schemaItemType: ECClassSchemaItems;
  constructor(schemaItemType: ECClassSchemaItems, schemaItemKeyOrName: SchemaItemKey | string, schemaKey?: SchemaKey) {
    super(schemaItemType, schemaItemKeyOrName, schemaKey);
    this.schemaItemType = schemaItemType;
  }

  public static fromECClass(ecClass: ECClass | undefined): ClassId | undefined{
    if (!ecClass)
      return undefined;
    return new ClassId(ecClass.schemaItemType as ECClassSchemaItems, ecClass.key);
  }
}

/**
 * An IBaseClassIdentifier implementation to identify Base Class instances.
 * @alpha
 */
export class BaseClassId extends SchemaItemId implements IBaseClassIdentifier {
  public override readonly typeIdentifier = SchemaTypeIdentifiers.BaseClassIdentifier;
  public override readonly schemaItemType: ECClassSchemaItems;
  public readonly baseClass: ClassId;

  constructor(schemaItemType: ECClassSchemaItems, classKey: SchemaItemKey, baseClassKey: SchemaItemKey) {
    super(schemaItemType, classKey);
    this.schemaItemType = schemaItemType;
    this.baseClass = new ClassId(schemaItemType, baseClassKey);
  }
}

/**
 * An IPropertyIdentifier implementation to identify Property instances.
 * @alpha
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
 * @alpha
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
 * @alpha
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
 * @alpha
 */
export class RelationshipConstraintId implements IRelationshipConstraintIdentifier {
  public readonly typeIdentifier = SchemaTypeIdentifiers.RelationshipConstraintIdentifier;
  public readonly name: string;
  public readonly relationshipKey: SchemaItemKey;
  public readonly schemaKey: SchemaKey;
  public readonly constraintClassKey?: SchemaItemKey;

  constructor(constraintOrName: RelationshipConstraint | string, relationshipClassKey?: SchemaItemKey, constraintClassKey?: SchemaItemKey) {
    if (typeof constraintOrName === "string") {
      this.name = constraintOrName;
      if (!relationshipClassKey)
        throw new Error("relationshipClassKey is required if constraintOrName is a string");

      this.relationshipKey = relationshipClassKey;
      this.schemaKey = this.relationshipKey.schemaKey;
      this.constraintClassKey = constraintClassKey;
      return;
    }

    this.name = constraintOrName.isSource ? "Source" : "Target";
    this.relationshipKey = constraintOrName.relationshipClass.key;
    this.schemaKey = this.relationshipKey.schemaKey;
    this.constraintClassKey = constraintClassKey;
  }
}

/**
 * An IRelationshipConstraintIdentifier implementation to identify an AbstractConstraint within a RelationshipConstraint.
 * @alpha
 */
export class AbstractConstraintId implements IAbstractConstraintIdentifier {
  public readonly typeIdentifier = SchemaTypeIdentifiers.AbstractConstraintIdentifier;
  public readonly name: string;
  public readonly relationshipKey: SchemaItemKey;
  public readonly schemaKey: SchemaKey;
  public readonly abstractConstraintKey: SchemaItemKey;

  constructor(constraintOrName: RelationshipConstraint | string, abstractConstraintKey?: SchemaItemKey, relationshipClassKey?: SchemaItemKey) {
    if (typeof constraintOrName === "string") {
      this.name = constraintOrName;

      if (!abstractConstraintKey)
        throw new Error("abstractConstraintKey is required if constraintOrName is a string");

      this.abstractConstraintKey = abstractConstraintKey;

      if (!relationshipClassKey)
        throw new Error("relationshipClassKey is required if constraintOrName is a string");

      this.relationshipKey = relationshipClassKey;
      this.schemaKey = this.relationshipKey.schemaKey;
      return;
    }

    this.name = constraintOrName.isSource ? "Source" : "Target";
    this.relationshipKey = constraintOrName.relationshipClass.key;
    this.schemaKey = this.relationshipKey.schemaKey;

    if (!constraintOrName.abstractConstraint)
      throw new Error("abstractConstraint is undefined");

    this.abstractConstraintKey = new SchemaItemKey(constraintOrName.abstractConstraint.name, constraintOrName.abstractConstraint.schemaKey);
  }
}

function getEnumeratorType(enumeration: Enumeration, enumerator: AnyEnumerator | string) {
  if (typeof(enumerator) === "string") {
    return enumeration.type ? primitiveTypeToString(enumeration.type) : "string";
  }

  return typeof(enumerator.value) === "string" ? "string" : "int";
}
