/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKey, SchemaChildKey } from "./ECObjects";
import { DelayedPromise } from "./DelayedPromise";
import Schema from "./Metadata/Schema";
import SchemaChild from "./Metadata/SchemaChild";
import { Property } from "./Metadata/Property";
import ECClass, { StructClass } from "./Metadata/Class";
import EntityClass from "./Metadata/EntityClass";
import MixinClass from "./Metadata/MixinClass";
import RelationshipClass from "./Metadata/RelationshipClass";
import CustomAttributeClass from "./Metadata/CustomAttributeClass";
import Enumeration from "./Metadata/Enumeration";
import KindOfQuantity from "./Metadata/KindOfQuantity";
import PropertyCategory from "./Metadata/PropertyCategory";

export type LazyLoadedSchema = Readonly<SchemaKey> & DelayedPromise<Schema>;
export type LazyLoadedProperty = Readonly<{ name: string }> & DelayedPromise<Property>;

export type LazyLoadedSchemaChild<T extends SchemaChild> = Readonly<SchemaChildKey> & DelayedPromise<T>;
export type LazyLoadedECClass = LazyLoadedSchemaChild<ECClass>;
export type LazyLoadedEntityClass = LazyLoadedSchemaChild<EntityClass>;
export type LazyLoadedMixin = LazyLoadedSchemaChild<MixinClass>;
export type LazyLoadedStructClass = LazyLoadedSchemaChild<StructClass>;
export type LazyLoadedCustomAttributeClass = LazyLoadedSchemaChild<CustomAttributeClass>;
export type LazyLoadedRelationshipClass = LazyLoadedSchemaChild<RelationshipClass>;
export type LazyLoadedEnumeration = LazyLoadedSchemaChild<Enumeration>;
export type LazyLoadedKindOfQuantity = LazyLoadedSchemaChild<KindOfQuantity>;
export type LazyLoadedPropertyCategory = LazyLoadedSchemaChild<PropertyCategory>;
export type LazyLoadedRelationshipConstraintClass = LazyLoadedSchemaChild<EntityClass | MixinClass | RelationshipClass>;

export type AnyClass = EntityClass | MixinClass | StructClass | CustomAttributeClass | RelationshipClass;
export type AnySchemaChildType = AnyClass | Enumeration | KindOfQuantity | PropertyCategory;

export interface SchemaChildVisitor {
  /* async */ visitEnumeration?: (enumeration: Enumeration) => Promise<void>;
  /* async */ visitKindOfQuantity?: (koq: KindOfQuantity) => Promise<void>;
  /* async */ visitPropertyCategory?: (category: PropertyCategory) => Promise<void>;
  /* async */ visitClass?: (ecClass: AnyClass) => Promise<void>;
}

export interface SchemaDeserializationVisitor extends SchemaChildVisitor {
  /**
   * Called after a schema and all its references are deserialized,
   * but _before_ any of its children or custom attributes have been deserialized.
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
   * Called after a schema and all its references, children, and custom attributes have been deserialized,
   * @param schema a fully-loaded Schema
   */
  /* async */ visitFullSchema?: (schema: Schema) => Promise<void>;
}
