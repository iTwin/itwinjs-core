/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECClassModifier, CustomAttributeContainerType, PrimitiveType, RelationshipMultiplicity, RelationshipEnd,
        StrengthType, RelatedInstanceDirection, SchemaKey, SchemaChildKey } from "ECObjects";
import { SchemaContext } from "Context";
import { CustomAttributeContainerProps } from "Metadata/CustomAttribute";

export interface SchemaProps extends CustomAttributeContainerProps {
  schemaKey: SchemaKey;
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
  key: SchemaChildKey;
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
  createPrimitiveProperty(name: string, type?: string | PrimitiveType | EnumerationInterface): PrimitivePropertyInterface;
  createPrimitiveArrayProperty(name: string, type?: string | PrimitiveType | EnumerationInterface): PrimitiveArrayPropertyInterface;
  createStructProperty(name: string, type: string | StructClassInterface): StructPropertyInterface;
  createStructArrayProperty(name: string, type: string | StructClassInterface): StructArrayPropertyInterface;
}

export interface EntityClassProps extends ECClassProps {
  mixin?: string[] | MixinInterface[];
}

export interface EntityClassInterface extends ECClassInterface, EntityClassProps {
  createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction?: string | RelatedInstanceDirection): NavigationPropertyInterface;
}

export interface StructClassInterface extends ECClassInterface, ECClassProps { }

export interface MixinProps extends EntityClassProps {
  appliesTo?: string | EntityClassInterface;
}
export interface MixinInterface extends ECClassInterface, MixinProps { }

export interface RelationshipClassProps extends ECClassProps {
  strength: StrengthType;
  strengthDirection: RelatedInstanceDirection;
  source: RelationshipConstraintInterface;
  target: RelationshipConstraintInterface;
}

export interface RelationshipClassInterface extends ECClassInterface, RelationshipClassProps {
  createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction?: string | RelatedInstanceDirection): NavigationPropertyInterface;
}

export interface RelationshipConstraintProps extends CustomAttributeContainerProps {
  relationshipEnd: RelationshipEnd;
  relClass?: RelationshipClassInterface;
  multiplicity?: RelationshipMultiplicity;
  roleLabel?: string;
  polymorphic?: boolean;
  abstractConstraint?: EntityClassInterface | RelationshipClassInterface;
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
export interface KindOfQuantityInterface extends SchemaChildInterface, KindOfQuantityProps { }

export interface PropertyCategoryProps extends SchemaChildProps {
  priority: number;
}
export interface PropertyCategoryInterface extends SchemaChildInterface, PropertyCategoryProps { }

export interface ECPropertyProps {
  name: string; // Probably should be an ECName
  class: ECClassInterface;
  description?: string;
  label?: string;
  readOnly?: boolean;
  priority?: number;
  category?: PropertyCategoryInterface;
  kindOfQuantity?: KindOfQuantityInterface;
}

export interface PropertyInterface extends ECPropertyProps {
  fromJson(obj: any): void;
}

export interface PrimitivePropertyProps extends ECPropertyProps {
  type: PrimitiveType | EnumerationInterface;
  extendedTypeName?: string;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

export interface PrimitivePropertyInterface extends PropertyInterface, PrimitivePropertyProps { }

export interface StructPropertyProps extends ECPropertyProps {
  type: StructClassInterface;
}
export interface StructPropertyInterface extends PropertyInterface, StructPropertyProps { }

export interface ArrayPropertyProps {
  minOccurs?: number;
  maxOccurs?: number;
}

export interface PrimitiveArrayPropertyInterface extends PrimitivePropertyInterface, ArrayPropertyProps { }
export interface StructArrayPropertyInterface extends StructPropertyInterface, ArrayPropertyProps { }

export interface NavigationPropertyProps extends ECPropertyProps {
  relationship: RelationshipClassInterface;
  direction: RelatedInstanceDirection;
}
export interface NavigationPropertyInterface extends PropertyInterface, NavigationPropertyProps { }
