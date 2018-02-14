/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKey, SchemaChildKey } from "./ECObjects";
import { DelayedPromise } from "./DelayedPromise";
import Schema from "./Metadata/Schema";
import SchemaChild from "./Metadata/SchemaChild";
import { ECProperty } from "./Metadata/Property";
import ECClass, { StructClass } from "./Metadata/Class";
import EntityClass from "./Metadata/EntityClass";
import MixinClass from "./Metadata/MixinClass";
import RelationshipClass from "./Metadata/RelationshipClass";
import CustomAttributeClass from "./Metadata/CustomAttributeClass";
import Enumeration from "./Metadata/Enumeration";
import KindOfQuantity from "./Metadata/KindOfQuantity";
import PropertyCategory from "./Metadata/PropertyCategory";

export type LazyLoadedSchema = Readonly<SchemaKey> & DelayedPromise<Schema>;
export type LazyLoadedProperty = Readonly<{ name: string }> & DelayedPromise<ECProperty>;

export type LazyLoadedSchemaChild<T extends SchemaChild> = Readonly<T["key"]> & DelayedPromise<T>;
export type LazyLoadedECClass = LazyLoadedSchemaChild<ECClass>;
export type LazyLoadedEntityClass = LazyLoadedSchemaChild<EntityClass>;
export type LazyLoadedMixin = LazyLoadedSchemaChild<MixinClass>;
export type LazyLoadedStructClass = LazyLoadedSchemaChild<StructClass>;
export type LazyLoadedCustomAttributeClass = LazyLoadedSchemaChild<CustomAttributeClass>;
export type LazyLoadedRelationshipClass = LazyLoadedSchemaChild<RelationshipClass>;
export type LazyLoadedEnumeration = LazyLoadedSchemaChild<Enumeration>;
export type LazyLoadedKindOfQuantity = LazyLoadedSchemaChild<KindOfQuantity>;
export type LazyLoadedPropertyCategory = LazyLoadedSchemaChild<PropertyCategory>;
export type LazyLoadedRelationshipConstraintClass = Readonly<SchemaChildKey> & DelayedPromise<EntityClass | MixinClass | RelationshipClass>;

export type AnyClassType = EntityClass | MixinClass | StructClass | CustomAttributeClass | RelationshipClass;
export type AnySchemaChildType = AnyClassType | Enumeration | KindOfQuantity | PropertyCategory;

export interface SchemaDeserializationVisitor {
  /**
   * Called after a schema and all its references are deserialized,
   * but _before_ any of its children or custom attributes have been deserialized.
   * @param schema a partially-loaded Schema
   */
  visitEmptySchema?: (schema: Schema) => void;

  /**
   * Called after an Enumeration and all its Enumerators have been deserialized.
   * @param enumeration a fully-loaded Enumeration
   */
  visitEnumeration?: (enumeration: Enumeration) => void;

  /**
   * Called after a KindOfQuantity has been deserialized.
   * @param koq a fully-loaded KindOfQuantity
   */
  visitKindOfQuantity?: (koq: KindOfQuantity) => void;

  /**
   * Called after a PropertyCategory has been deserialized.
   * @param category a fully-loaded PropertyCategory
   */
  visitPropertyCategory?: (category: PropertyCategory) => void;

  /**
   * Called after an ECClass and its baseClass, properties, and custom attributes have been deserialized.
   * @param ecClass a fully-loaded ECClass
   */
  visitClass?: (ecClass: AnyClassType) => void;

  /**
   * Called after a schema and all its references, children, and custom attributes have been deserialized,
   * @param schema a fully-loaded Schema
   */
  visitFullSchema?: (schema: Schema) => void;
}
