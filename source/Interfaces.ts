/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECClassModifier, CustomAttributeContainerType, PrimitiveType, RelationshipMultiplicity, RelationshipEnd,
        StrengthType, RelatedInstanceDirection, SchemaKey, SchemaChildKey } from "ECObjects";
import { CustomAttributeContainerProps } from "Metadata/CustomAttribute";

export interface SchemaProps extends CustomAttributeContainerProps {
  readonly schemaKey: SchemaKey;
  alias?: string;
  label?: string;
  description?: string;
  references?: SchemaInterface[];
  children?: SchemaChildInterface[];
}

/**
 * Extends the properties that are defined on a Schema to add the methods that are available on any class that implements this interface.
 */
export interface SchemaInterface extends SchemaSyncInterface {
  /* async */ getChild<T extends SchemaChildInterface>(name: string, includeReference?: boolean): Promise<T | undefined>;
  /* async */ addChild<T extends SchemaChildInterface>(child: T): Promise<void>;
  /* async */ createEntityClass(name: string): Promise<EntityClassInterface>;
  /* async */ createMixinClass(name: string): Promise<MixinInterface>;
  /* async */ createStructClass(name: string): Promise<StructClassInterface>;
  /* async */ createCustomAttributeClass(name: string): Promise<CustomAttributeClassInterface>;
  /* async */ createRelationshipClass(name: string): Promise<RelationshipClassInterface>;
  /* async */ createKindOfQuantity(name: string): Promise<KindOfQuantityInterface>;
  /* async */ createEnumeration(name: string): Promise<EnumerationInterface>;
  /* async */ createPropertyCategory(name: string): Promise<PropertyCategoryInterface>;
  /* async */ addReference(refSchema: SchemaInterface): Promise<void>;
  /* async */ getReference<T extends SchemaInterface>(refSchemaName: string): Promise<T | undefined>;
  fromJson(obj: any): void;
}

export interface SchemaSyncInterface extends SchemaProps {
  getChildSync<T extends SchemaChildInterface>(name: string, includeReference?: boolean): T | undefined;
  addChildSync<T extends SchemaChildInterface>(child: T): void;
  createEntityClassSync(name: string): EntityClassInterface;
  createMixinClassSync(name: string): MixinInterface;
  createStructClassSync(name: string): StructClassInterface;
  createCustomAttributeClassSync(name: string): CustomAttributeClassInterface;
  createRelationshipClassSync(name: string): RelationshipClassInterface;
  createKindOfQuantitySync(name: string): KindOfQuantityInterface;
  createEnumerationSync(name: string): EnumerationInterface;
  createPropertyCategorySync(name: string): PropertyCategoryInterface;
  addReferenceSync(refSchema: SchemaInterface): void;
  getReferenceSync<T extends SchemaInterface>(refSchemaName: string): T | undefined;
}

export interface SchemaChildProps {
  readonly schema: SchemaInterface;
  readonly key: SchemaChildKey;
  readonly name: string;
  label?: string;
  description?: string;
}

export interface SchemaChildInterface extends SchemaChildProps {
  fromJson(obj: any): void;
}

export interface ECClassProps extends SchemaChildProps {
  modifier: ECClassModifier;
  baseClass?: string | ECClassInterface;
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
