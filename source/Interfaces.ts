/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECVersion, ECClassModifier, CustomAttributeContainerType, PrimitiveType, SchemaMatchType,
      RelationshipMultiplicity, StrengthType, RelatedInstanceDirection } from "./ECObjects";

export interface SchemaKeyInterface {
  name: string;
  version: ECVersion;
  readVersion: number;
  writeVersion: number;
  minorVersion: number;
  checksum: number;
  matches(rhs: SchemaKeyInterface, matchType: SchemaMatchType): boolean;
}

export interface SchemaInterface {
  schemaKey: SchemaKeyInterface;
  alias: string;
  label?: string;
  description?: string;
  references?: SchemaInterface[];
  children?: SchemaChildInterface[];
  getChild<T extends SchemaChildInterface>(name: string): T | undefined;
  createEntityClass(name: string): EntityClassInterface;
  createMixinClass(name: string): MixinInterface;
  createStructClass(name: string): ClassInterface;
  createCustomAttributeClass(name: string): ClassInterface;
  createRelationshipClass(name: string): RelationshipClassInterface;
  createKindOfQuantity(name: string): SchemaChildInterface; // Should return a KindOfQuantityInterface
  createEnumeration(name: string): SchemaChildInterface; // Should return a EnumerationInterface
  createPropertyCategory(name: string): SchemaChildInterface; // Should return a PropertyCategoryInterface
  addReference(refSchema: SchemaInterface): void;
  getReference(refSchemaName: string): SchemaInterface | undefined;
  fromJson(obj: any): void;
}

export interface SchemaChildInterface {
  schema?: SchemaInterface;
  schemaVersion?: ECVersion;
  name: string;
  label?: string;
  description?: string;
  fromJson(obj: any): void;
}

export interface ClassInterface extends SchemaChildInterface {
  modifier: ECClassModifier;
  baseClass?: string | ClassInterface; // string should be a ECFullName
  properties?: PropertyInterface[];
  getProperty<T extends PropertyInterface>(name: string): T | undefined;
  createPrimitiveProperty(name: string, type?: string | PrimitiveType): PrimitivePropertyInterface;
  createPrimitiveArrayProperty(name: string, type?: string | PrimitiveType): PrimitiveArrayPropertyInteface;
  createStructProperty(name: string, type?: string | SchemaChildInterface): StructPropertyInterface; // TODO: Need to make type only StructInterface
  createStructArrayProperty(name: string, type?: string | SchemaChildInterface): StructArrayPropertyInterface; // TODO: Need to make type only StructInterface
}

export interface EntityClassInterface extends ClassInterface {
  mixin?: string[] | MixinInterface[]; // string should be an ECFullName
  createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction: string | RelatedInstanceDirection): NavigationPropertyInterface;
}

export interface MixinInterface extends ClassInterface {
  appliesTo?: string | EntityClassInterface; // string should be an ECFullName
}

export interface RelationshipClassInterface extends ClassInterface {
  strength: StrengthType;
  strengthDirection: RelatedInstanceDirection;
  source: RelationshipConstraintInterface;
  target: RelationshipConstraintInterface;
  createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction: string | RelatedInstanceDirection): NavigationPropertyInterface;
}

export interface RelationshipConstraintInterface {
  relClass?: RelationshipClassInterface;
  multiplicity: RelationshipMultiplicity;
  roleLabel: string;
  polymorphic: boolean;
  abstractConstraint: EntityClassInterface | RelationshipClassInterface;
  // customAttributes: object[];  // TODO: Fix this
  constraintClasses: EntityClassInterface[] | RelationshipClassInterface[];
  fromJson(obj: any): void;
}

export interface CustomAttributeClassInterface {
  containerType: CustomAttributeContainerType;
}

export interface EnumerationInterface {
  isStrict: boolean;
  type: PrimitiveType.Integer | PrimitiveType.String;
}

export interface PropertyInterface {
  name: string; // Probably should be an ECName
  description?: string;
  label?: string;
  readOnly?: boolean;
  priority?: number;
  category?: SchemaChildInterface; // Should be a PropertyCategoryInterface
  kindOfQuantity?: any; // Should be KindOfQuantity interface
  fromJson(obj: any): void;
}

export interface PrimitivePropertyInterface extends PropertyInterface {
  type: PrimitiveType | EnumerationInterface;
  extendedTypeName?: string;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

export interface StructPropertyInterface extends PropertyInterface {
  type: SchemaChildInterface; // Should be a StructClassInterface
}

export interface ArrayPropertyInterface {
  minOccurs?: number;
  maxOccurs?: number;
}

export interface PrimitiveArrayPropertyInteface extends PrimitivePropertyInterface, ArrayPropertyInterface { }
export interface StructArrayPropertyInterface extends StructPropertyInterface, ArrayPropertyInterface { }

export interface NavigationPropertyInterface extends PropertyInterface {
  relationship: RelationshipClassInterface;
  direction: RelatedInstanceDirection;
}
