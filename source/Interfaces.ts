/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECVersion, ECClassModifier, CustomAttributeContainerType, PrimitiveType, SchemaMatchType,
      RelationshipMultiplicity, StrengthType, RelatedInstanceDirection, SchemaChildType } from "./ECObjects";
import { SchemaContext } from "Context";

export interface SchemaKeyInterface {
  name: string;
  version: ECVersion;
  readVersion: number;
  writeVersion: number;
  minorVersion: number;
  checksum: number;
  matches(rhs: SchemaKeyInterface, matchType: SchemaMatchType): boolean;
}

/**
 * The properties that make up a SchemaChildKey.
 */
export interface SchemaChildKeyProps {
  name: string;
  type?: SchemaChildType;
  schema?: SchemaKeyInterface;
}

/**
 * The SchemaChildKey serves as a container of all the important information contained within a SchemaChild. It can be used as
 * a way to identify and thus search for a specific SchemaChild.
 */
export interface SchemaChildKeyInterface extends SchemaChildKeyProps {
  matches(rhs: SchemaChildKeyInterface): boolean;
}

export interface SchemaProps {
  schemaKey: SchemaKeyInterface;
  alias: string;
  label?: string;
  description?: string;
  references?: SchemaInterface[];
  children?: SchemaChildInterface[];
}

/**
 * Extends the properties that are defined on a Schema to add the methods that are available on any class that implements this interface.
 */
export interface SchemaInterface extends SchemaProps {
  getChild<T extends SchemaChildInterface>(name: string): T | undefined;
  createEntityClass(name: string): EntityClassInterface;
  createMixinClass(name: string): MixinInterface;
  createStructClass(name: string): StructClassInterface;
  createCustomAttributeClass(name: string): CustomAttributeClassInterface;
  createRelationshipClass(name: string): RelationshipClassInterface;
  createKindOfQuantity(name: string): KindOfQuantityInterface;
  createEnumeration(name: string): EnumerationInterface;
  createPropertyCategory(name: string): PropertyCategoryInterface;
  addReference(refSchema: SchemaInterface): void;
  getReference<T extends SchemaInterface>(refSchemaName: string): T | undefined;
  fromJson(obj: any): void;
}

export interface SchemaChildProps {
  key: SchemaChildKeyInterface;
  name: string;
  label?: string;
  description?: string;
}

export interface SchemaChildInterface extends SchemaChildProps {
  getSchema(context?: SchemaContext): SchemaInterface | undefined;
  fromJson(obj: any): void;
}

export interface ECClassProps extends SchemaChildProps {
  modifier: ECClassModifier;
  baseClass?: string | ECClassInterface; // string should be a ECFullName
  properties?: PropertyInterface[];
}

export interface ECClassInterface extends SchemaChildInterface, ECClassProps {
  getProperty<T extends PropertyInterface>(name: string): T | undefined;
  createPrimitiveProperty(name: string, type?: string | PrimitiveType): PrimitivePropertyInterface;
  createPrimitiveArrayProperty(name: string, type?: string | PrimitiveType): PrimitiveArrayPropertyInteface;
  createStructProperty(name: string, type?: string | SchemaChildInterface): StructPropertyInterface; // TODO: Need to make type only StructInterface
  createStructArrayProperty(name: string, type?: string | SchemaChildInterface): StructArrayPropertyInterface; // TODO: Need to make type only StructInterface
}

export interface EntityClassProps extends ECClassProps {
  mixin?: string[] | MixinInterface[]; // string should be an ECFullName
}

export interface EntityClassInterface extends ECClassInterface, EntityClassProps {
  createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction: string | RelatedInstanceDirection): NavigationPropertyInterface;
}

export interface StructClassInterface extends ECClassInterface, ECClassProps { }

export interface MixinProps extends EntityClassProps {
  appliesTo?: string | EntityClassInterface; // string should be an ECFullName
}

// Normally we don't want empty interfaces because they don't add anything, but it is being used here to define one interface
// that contains the properties from MixinProps and the method signatures from ECClassInterface.
export interface MixinInterface extends ECClassInterface, MixinProps { }

export interface RelationshipClassProps extends ECClassProps {
  strength: StrengthType;
  strengthDirection: RelatedInstanceDirection;
  source: RelationshipConstraintInterface;
  target: RelationshipConstraintInterface;
}

export interface RelationshipClassInterface extends ECClassInterface, RelationshipClassProps {
  createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction: string | RelatedInstanceDirection): NavigationPropertyInterface;
}

export interface RelationshipConstraintProps {
  relClass?: RelationshipClassInterface;
  multiplicity?: RelationshipMultiplicity;
  roleLabel?: string;
  polymorphic?: boolean;
  abstractConstraint?: EntityClassInterface | RelationshipClassInterface;
  // customAttributes: object[];  // TODO: Fix this
  constraintClasses?: EntityClassInterface[] | RelationshipClassInterface[];
}

export interface RelationshipConstraintInterface extends RelationshipConstraintProps {
  fromJson(obj: any): void;
}

export interface CustomAttributeClassProps extends ECClassProps {
  containerType: CustomAttributeContainerType;
}

export interface CustomAttributeClassInterface extends ECClassInterface, CustomAttributeClassProps { }

export interface EnumerationProps extends SchemaChildProps {
  isStrict: boolean;
  type: PrimitiveType.Integer | PrimitiveType.String;
}

// Normally we don't want empty interfaces because they don't add anything, but it is being used here to define one interface
// that contains the properties from EnumerationProps and method signatures from SchemaChildInterface.
export interface EnumerationInterface extends SchemaChildInterface, EnumerationProps { }

export interface EnumeratorProps {
  enumeration: EnumerationInterface;
  value: number | string;
  label?: string;
}

export interface FormatUnitSpecInterface {
  unit: string;
  format: string;
}

export interface KindOfQuantityProps extends SchemaChildProps {
  persistenceUnit: FormatUnitSpecInterface;
  presentationUnits: FormatUnitSpecInterface[];
  precision: number;
}

// Normally we don't want empty interfaces because they don't add anything, but it is being used here to define one interface
// that contains the properties from KindOfQuantityProps and method signatures from SchemaChildInterface.
export interface KindOfQuantityInterface extends SchemaChildInterface, KindOfQuantityProps { }

export interface PropertyCategoryProps extends SchemaChildProps {
  priority: number;
}

// Normally we don't want empty interfaces because they don't add anything, but it is being used here to define one interface
// that contains the properties from PropertyCategoryProps and method signatures from SchemaChildInterface.
export interface PropertyCategoryInterface extends SchemaChildInterface, PropertyCategoryProps { }

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
