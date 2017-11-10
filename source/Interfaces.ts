/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECVersion, ECClassModifier, CustomAttributeContainerType, PrimitiveType, SchemaMatchType, 
      RelationshipMultiplicity, StrengthType, StrengthDirection } from "./ECObjects";

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
  createKindOfQuantity(name: string): SchemaChildInterface;
  createEnumeration(name: string): SchemaChildInterface;
  createPropertyCategory(name: string): SchemaChildInterface;
  addReference(refSchema: SchemaInterface): void;
  getReference(refSchemaName: string): SchemaInterface | undefined;
  fromJson(obj: any): void;
}

export interface SchemaChildInterface {
  schema?: string | SchemaInterface;
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
  createProperty(name: string): any;
}

export interface EntityClassInterface extends ClassInterface {
  mixin?: string[] | MixinInterface[]; // string should be an ECFullName
}

export interface MixinInterface extends ClassInterface {
  appliesTo?: string | EntityClassInterface; // string should be an ECFullName
}

export interface RelationshipClassInterface extends ClassInterface {
  strength: StrengthType;
  strengthDirection: StrengthDirection;
  source: RelationshipConstraintInterface;
  target: RelationshipConstraintInterface;
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

}
