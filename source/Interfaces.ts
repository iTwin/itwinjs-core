/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKey, SchemaItemKey } from "./ECObjects";
import { DelayedPromise } from "./DelayedPromise";
import Schema from "./Metadata/Schema";
import SchemaItem from "./Metadata/SchemaItem";
import { Property } from "./Metadata/Property";
import ECClass, { StructClass } from "./Metadata/Class";
import EntityClass from "./Metadata/EntityClass";
import Mixin from "./Metadata/Mixin";
import RelationshipClass from "./Metadata/RelationshipClass";
import CustomAttributeClass from "./Metadata/CustomAttributeClass";
import Enumeration from "./Metadata/Enumeration";
import KindOfQuantity from "./Metadata/KindOfQuantity";
import PropertyCategory from "./Metadata/PropertyCategory";

export type LazyLoadedSchema = Readonly<SchemaKey> & DelayedPromise<Schema>;
export type LazyLoadedProperty = Readonly<{ name: string }> & DelayedPromise<Property>;

export type LazyLoadedSchemaItem<T extends SchemaItem> = Readonly<SchemaItemKey> & DelayedPromise<T>;
export type LazyLoadedECClass = LazyLoadedSchemaItem<ECClass>;
export type LazyLoadedEntityClass = LazyLoadedSchemaItem<EntityClass>;
export type LazyLoadedMixin = LazyLoadedSchemaItem<Mixin>;
export type LazyLoadedStructClass = LazyLoadedSchemaItem<StructClass>;
export type LazyLoadedCustomAttributeClass = LazyLoadedSchemaItem<CustomAttributeClass>;
export type LazyLoadedRelationshipClass = LazyLoadedSchemaItem<RelationshipClass>;
export type LazyLoadedEnumeration = LazyLoadedSchemaItem<Enumeration>;
export type LazyLoadedKindOfQuantity = LazyLoadedSchemaItem<KindOfQuantity>;
export type LazyLoadedPropertyCategory = LazyLoadedSchemaItem<PropertyCategory>;
export type LazyLoadedRelationshipConstraintClass = LazyLoadedSchemaItem<EntityClass | Mixin | RelationshipClass>;

export type AnyClass = EntityClass | Mixin | StructClass | CustomAttributeClass | RelationshipClass;
export type AnySchemaItem = AnyClass | Enumeration | KindOfQuantity | PropertyCategory;

export interface SchemaItemVisitor {
  /* async */ visitEnumeration?: (enumeration: Enumeration) => Promise<void>;
  /* async */ visitKindOfQuantity?: (koq: KindOfQuantity) => Promise<void>;
  /* async */ visitPropertyCategory?: (category: PropertyCategory) => Promise<void>;
  /* async */ visitClass?: (ecClass: AnyClass) => Promise<void>;
}

export interface SchemaDeserializationVisitor extends SchemaItemVisitor {
  /**
   * Called after a schema and all its references are deserialized,
   * but _before_ any of its items or custom attributes have been deserialized.
   * @param schema a partially-loaded Schema
   */
  /* async */ visitEmptySchema?: (schema: Schema) => Promise<void>;

  /**
   * Called after an Enumeration and all its Enumerators have been deserialized.
   * @param enumeration a fully-loaded Enumeration
   */
  /* async */ visitEnumeration?: (enumeration: Enumeration) => Promise<void>;

  /**
   * Called after a KindOfQuantity has been deserialized.
   * @param koq a fully-loaded KindOfQuantity
   */
  /* async */ visitKindOfQuantity?: (koq: KindOfQuantity) => Promise<void>;

  /**
   * Called after a PropertyCategory has been deserialized.
   * @param category a fully-loaded PropertyCategory
   */
  /* async */ visitPropertyCategory?: (category: PropertyCategory) => Promise<void>;

  /**
   * Called after an ECClass and its baseClass, properties, and custom attributes have been deserialized.
   * @param ecClass a fully-loaded ECClass
   */
  /* async */ visitClass?: (ecClass: AnyClass) => Promise<void>;

  /**
   * Called after a schema and all its references, items, and custom attributes have been deserialized,
   * @param schema a fully-loaded Schema
   */
  /* async */ visitFullSchema?: (schema: Schema) => Promise<void>;
}
