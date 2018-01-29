/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECClassModifier, CustomAttributeContainerType, PrimitiveType, RelationshipMultiplicity, RelationshipEnd,
        StrengthType, RelatedInstanceDirection, SchemaKey, SchemaChildKey } from "ECObjects";
import { CustomAttributeContainerProps } from "Metadata/CustomAttribute";
import { DelayedPromise } from "DelayedPromise";

export interface SchemaProps extends CustomAttributeContainerProps {
  readonly schemaKey: SchemaKey;
  alias?: string;
  label?: string;
  description?: string;
  references?: SchemaInterface[];
  children?: SchemaChildInterface[];
}

export type LazyLoadedSchema = Readonly<SchemaKey> & DelayedPromise<SchemaInterface>;
export type LazyLoadedProperty = Readonly<{ name: string }> & DelayedPromise<PropertyInterface>;

export type LazyLoadedSchemaChild<T extends SchemaChildInterface> = Readonly<T["key"]> & DelayedPromise<T>;
export type LazyLoadedECClass = LazyLoadedSchemaChild<ECClassInterface>;
export type LazyLoadedEntityClass = LazyLoadedSchemaChild<EntityClassInterface>;
export type LazyLoadedMixin = LazyLoadedSchemaChild<MixinInterface>;
export type LazyLoadedStructClass = LazyLoadedSchemaChild<StructClassInterface>;
export type LazyLoadedCustomAttributeClass = LazyLoadedSchemaChild<CustomAttributeClassInterface>;
export type LazyLoadedRelationshipClass = LazyLoadedSchemaChild<RelationshipClassInterface>;
export type LazyLoadedEnumeration = LazyLoadedSchemaChild<EnumerationInterface>;
export type LazyLoadedKindOfQuantity = LazyLoadedSchemaChild<KindOfQuantityInterface>;
export type LazyLoadedPropertyCategory = LazyLoadedSchemaChild<PropertyCategoryInterface>;
export type LazyLoadedRelationshipConstraintClass = Readonly<SchemaChildKey> & DelayedPromise<EntityClassInterface | MixinInterface | RelationshipClassInterface>;

export type AnyClassType = EntityClassInterface | MixinInterface | StructClassInterface | CustomAttributeClassInterface | RelationshipClassInterface;
export type AnySchemaChildType = AnyClassType | EnumerationInterface | KindOfQuantityInterface | PropertyCategoryInterface;

/**
 * Extends the properties that are defined on a Schema to add the methods that are available on any class that implements this interface.
 */
export interface SchemaInterface extends SchemaProps {
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

export interface SchemaSyncInterface extends SchemaInterface  {
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
  addReferenceSync(refSchema: SchemaSyncInterface): void;
  getReferenceSync<T extends SchemaSyncInterface>(refSchemaName: string): T | undefined;
}

export interface SchemaChildProps {
  readonly schema: SchemaInterface;
  readonly key: SchemaChildKey;
  readonly name: string;
  label?: string;
  description?: string;
}

export interface SchemaChildInterface extends SchemaChildProps {
  /* async */ fromJson(obj: any): Promise<void>;
}

export interface SchemaChildSyncInterface extends SchemaChildInterface {
  readonly schema: SchemaSyncInterface;
}

export interface ECClassProps extends SchemaChildProps {
  modifier: ECClassModifier;
  baseClass?: LazyLoadedECClass;
  properties?: LazyLoadedProperty[];
}

export interface ECClassInterface extends SchemaChildInterface, ECClassProps {
  /* async */ getProperty<T extends PropertyInterface>(name: string): Promise<T | undefined>;
  /* async */ createPrimitiveProperty(name: string, type?: string | PrimitiveType | EnumerationInterface): Promise<PrimitivePropertyInterface>;
  /* async */ createPrimitiveArrayProperty(name: string, type?: string | PrimitiveType | EnumerationInterface): Promise<PrimitiveArrayPropertyInterface>;
  /* async */ createStructProperty(name: string, type: string | StructClassInterface): Promise<StructPropertyInterface>;
  /* async */ createStructArrayProperty(name: string, type: string | StructClassInterface): Promise<StructArrayPropertyInterface>;
}

export interface EntityClassProps extends ECClassProps {
  mixin?: LazyLoadedMixin[];
}

export interface EntityClassInterface extends ECClassInterface, EntityClassProps {
  readonly key: SchemaChildKey.EntityClass;
  /* async */ createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction?: string | RelatedInstanceDirection): Promise<NavigationPropertyInterface>;
}

export interface StructClassInterface extends ECClassInterface, ECClassProps {
  readonly key: SchemaChildKey.StructClass;
}

export interface MixinProps extends EntityClassProps {
  appliesTo?: LazyLoadedEntityClass;
}
export interface MixinInterface extends ECClassInterface, MixinProps {
  readonly key: SchemaChildKey.Mixin;
}

export interface RelationshipClassProps extends ECClassProps {
  strength: StrengthType;
  strengthDirection: RelatedInstanceDirection;
  source: RelationshipConstraintInterface;
  target: RelationshipConstraintInterface;
}

export interface RelationshipClassInterface extends ECClassInterface, RelationshipClassProps {
  readonly key: SchemaChildKey.RelationshipClass;
  /* async */ createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction?: string | RelatedInstanceDirection): Promise<NavigationPropertyInterface>;
}

export interface RelationshipConstraintProps extends CustomAttributeContainerProps {
  relationshipEnd: RelationshipEnd;
  relClass?: RelationshipClassInterface;
  multiplicity?: RelationshipMultiplicity;
  roleLabel?: string;
  polymorphic?: boolean;
  abstractConstraint?: LazyLoadedRelationshipConstraintClass;
  constraintClasses?: LazyLoadedRelationshipConstraintClass[];
}

export interface RelationshipConstraintInterface extends RelationshipConstraintProps {
  fromJson(obj: any): void;
}

export interface CustomAttributeClassProps extends ECClassProps {
  containerType: CustomAttributeContainerType;
}
export interface CustomAttributeClassInterface extends ECClassInterface, CustomAttributeClassProps {
  readonly key: SchemaChildKey.CustomAttributeClass;
}

export interface EnumerationProps extends SchemaChildProps {
  isStrict: boolean;
  type: PrimitiveType.Integer | PrimitiveType.String;
}
export interface EnumerationInterface extends SchemaChildInterface, EnumerationProps {
  readonly key: SchemaChildKey.Enumeration;
}

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
export interface KindOfQuantityInterface extends SchemaChildInterface, KindOfQuantityProps {
  readonly key: SchemaChildKey.KindOfQuantity;
}

export interface PropertyCategoryProps extends SchemaChildProps {
  priority: number;
}
export interface PropertyCategoryInterface extends SchemaChildInterface, PropertyCategoryProps {
  readonly key: SchemaChildKey.PropertyCategory;
}

export interface ECPropertyProps {
  name: string; // Probably should be an ECName
  class: ECClassInterface;
  description?: string;
  label?: string;
  readOnly?: boolean;
  priority?: number;
  category?: LazyLoadedPropertyCategory;
  kindOfQuantity?: LazyLoadedKindOfQuantity;
}

export interface PropertyInterface extends ECPropertyProps {
  fromJson(obj: any): void;
}

export interface PrimitivePropertyProps extends ECPropertyProps {
  type: PrimitiveType | LazyLoadedEnumeration;
  extendedTypeName?: string;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

export interface PrimitivePropertyInterface extends PropertyInterface, PrimitivePropertyProps { }

export interface StructPropertyProps extends ECPropertyProps {
  type: LazyLoadedStructClass;
}
export interface StructPropertyInterface extends PropertyInterface, StructPropertyProps { }

export interface ArrayPropertyProps {
  minOccurs?: number;
  maxOccurs?: number;
}

export interface PrimitiveArrayPropertyInterface extends PrimitivePropertyInterface, ArrayPropertyProps { }
export interface StructArrayPropertyInterface extends StructPropertyInterface, ArrayPropertyProps { }

export interface NavigationPropertyProps extends ECPropertyProps {
  relationship: LazyLoadedRelationshipClass;
  direction: RelatedInstanceDirection;
}
export interface NavigationPropertyInterface extends PropertyInterface, NavigationPropertyProps { }
