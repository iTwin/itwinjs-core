/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECVersion, ECClassModifier, CustomAttributeContainerType, PrimitiveType, SchemaMatchType } from "./ECObjects";

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
  createEntityClass(name: string): any;
  createMixinClass(name: string): any;
  createStructClass(name: string): any;
  createCustomAttributeClass(name: string): any;
  createKindOfQuantity(name: string): any;
  createEnumeration(name: string): any;
  createPropertyCategory(name: string): any;
  addReference(refSchema: SchemaInterface): void;
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

export interface EntityInterface extends ClassInterface {
  mixin?: string | MixinInterface; // string should be an ECFullName
}

export interface MixinInterface extends ClassInterface {
  appliesTo?: string | EntityInterface; // string should be an ECFullName
}

export interface RelationshipInterface extends ClassInterface {
  strength: string;
  strengthDirection: string;
  source: RelationshipConstraintInterface;
  target: RelationshipConstraintInterface;
}

export interface RelationshipConstraintInterface {
  multiplicity: string;
  roleLabel: string;
  polymorphic: boolean;
  abstractConstraint: string; // string should be an ECFullName
  customAttributes: object[];  // TODO: Fix this
  constraintClasses: EntityInterface[] | RelationshipInterface[];
}

export interface CustomAttributeInterface {
  containerType: CustomAttributeContainerType;
}

export interface ECEnumeration {
  isStrict: boolean;
  type: PrimitiveType.Integer | PrimitiveType.String;
}

export interface PropertyInterface {

}
