/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECClassModifier, CustomAttributeContainerType, PrimitiveType, RelationshipMultiplicity, RelationshipEnd,
  StrengthType, RelatedInstanceDirection, SchemaKey, SchemaChildKey, SchemaChildType } from "./ECObjects";
import { CustomAttributeContainerProps } from "./Metadata/CustomAttribute";
import { DelayedPromise } from "./DelayedPromise";

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

export interface JsonDeserializable {
  /* async */ fromJson(obj: any): Promise<void>;
}

/**
 * Extends the properties that are defined on a Schema to add the methods that are available on any class that implements this interface.
 */
export interface SchemaInterface extends SchemaProps, JsonDeserializable {
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
  readonly type: SchemaChildType;
  readonly name: string;
  label?: string;
  description?: string;
}

export interface SchemaChildInterface extends SchemaChildProps, JsonDeserializable {}

export interface SchemaChildSyncInterface extends SchemaChildInterface {
  readonly schema: SchemaSyncInterface;
}

export interface ECClassProps extends SchemaChildProps {
  modifier: ECClassModifier;
  baseClass?: LazyLoadedECClass;
  properties?: LazyLoadedProperty[];
}

export interface ECClassInterface extends SchemaChildInterface, ECClassProps {
  /* async */ getProperty(name: string): Promise<PropertyInterface | undefined>;
  /* async */ createPrimitiveProperty(name: string, type: PrimitiveType): Promise<PrimitivePropertyInterface>;
  /* async */ createPrimitiveProperty(name: string, type: EnumerationInterface): Promise<EnumerationPropertyInterface>;
  /* async */ createPrimitiveProperty(name: string, type?: string): Promise<PropertyInterface>;
  /* async */ createPrimitiveArrayProperty(name: string, type: PrimitiveType): Promise<PrimitiveArrayPropertyInterface>;
  /* async */ createPrimitiveArrayProperty(name: string, type: EnumerationInterface): Promise<EnumerationArrayPropertyInterface>;
  /* async */ createPrimitiveArrayProperty(name: string, type?: string): Promise<ArrayPropertyInterface>;
  /* async */ createStructProperty(name: string, type: string | StructClassInterface): Promise<StructPropertyInterface>;
  /* async */ createStructArrayProperty(name: string, type: string | StructClassInterface): Promise<StructArrayPropertyInterface>;
}

export interface EntityClassProps extends ECClassProps {
  mixins?: LazyLoadedMixin[];
}

export interface EntityClassInterface extends ECClassInterface, EntityClassProps {
  readonly type: SchemaChildType.EntityClass;
  /* async */ createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction?: string | RelatedInstanceDirection): Promise<NavigationPropertyInterface>;
}

export interface StructClassInterface extends ECClassInterface, ECClassProps {
  readonly type: SchemaChildType.StructClass;
}

export interface MixinProps extends EntityClassProps {
  appliesTo?: LazyLoadedEntityClass;
}
export interface MixinInterface extends ECClassInterface, MixinProps {
  readonly type: SchemaChildType.MixinClass;
}

export interface RelationshipClassProps extends ECClassProps {
  strength: StrengthType;
  strengthDirection: RelatedInstanceDirection;
  source: RelationshipConstraintInterface;
  target: RelationshipConstraintInterface;
}

export interface RelationshipClassInterface extends ECClassInterface, RelationshipClassProps {
  readonly type: SchemaChildType.RelationshipClass;
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

export interface RelationshipConstraintInterface extends RelationshipConstraintProps, JsonDeserializable {}

export interface CustomAttributeClassProps extends ECClassProps {
  containerType: CustomAttributeContainerType;
}
export interface CustomAttributeClassInterface extends ECClassInterface, CustomAttributeClassProps {
  readonly type: SchemaChildType.CustomAttributeClass;
}

export interface EnumerationProps extends SchemaChildProps {
  isStrict: boolean;
  primitiveType: PrimitiveType.Integer | PrimitiveType.String;
}
export interface EnumerationInterface extends SchemaChildInterface, EnumerationProps {
  readonly type: SchemaChildType.Enumeration;
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
  readonly type: SchemaChildType.KindOfQuantity;
}

export interface PropertyCategoryProps extends SchemaChildProps {
  priority: number;
}
export interface PropertyCategoryInterface extends SchemaChildInterface, PropertyCategoryProps {
  readonly type: SchemaChildType.PropertyCategory;
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

export interface ArrayPropertyProps {
  minOccurs?: number;
  maxOccurs?: number;
}

export interface NavigationPropertyProps {
  relationshipClass: LazyLoadedRelationshipClass;
  direction: RelatedInstanceDirection;
}

export interface PrimitiveBackedPropertyProps {
  extendedTypeName?: string;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

export interface PrimitivePropertyProps extends PrimitiveBackedPropertyProps {
  primitiveType: PrimitiveType;
}

export interface EnumerationPropertyProps extends PrimitiveBackedPropertyProps {
  enumeration: LazyLoadedEnumeration;
}

export interface StructPropertyProps {
  structClass: LazyLoadedStructClass;
}

export type PropertyInterface = ECPropertyProps & JsonDeserializable;
export type ArrayPropertyInterface = PropertyInterface & ArrayPropertyProps;

// tslint:disable:no-empty-interface
export interface PrimitivePropertyInterface extends PropertyInterface, PrimitivePropertyProps {}
export interface EnumerationPropertyInterface extends PropertyInterface, EnumerationPropertyProps {}
export interface StructPropertyInterface extends PropertyInterface, StructPropertyProps {}
export interface NavigationPropertyInterface extends PropertyInterface, NavigationPropertyProps {}
export interface PrimitiveArrayPropertyInterface extends ArrayPropertyInterface, PrimitivePropertyProps {}
export interface EnumerationArrayPropertyInterface extends ArrayPropertyInterface, EnumerationPropertyProps {}
export interface StructArrayPropertyInterface extends ArrayPropertyInterface {}
// tslint:enable:no-empty-interface
