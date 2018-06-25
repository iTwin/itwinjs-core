/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKey, SchemaItemKey } from "./ECObjects";
import { DelayedPromise } from "./DelayedPromise";
import Schema from "./Metadata/Schema";
import SchemaItem from "./Metadata/SchemaItem";
import ECClass, { StructClass } from "./Metadata/Class";
import EntityClass from "./Metadata/EntityClass";
import Mixin from "./Metadata/Mixin";
import RelationshipClass from "./Metadata/RelationshipClass";
import CustomAttributeClass from "./Metadata/CustomAttributeClass";
import Enumeration from "./Metadata/Enumeration";
import KindOfQuantity from "./Metadata/KindOfQuantity";
import PropertyCategory from "./Metadata/PropertyCategory";
import Unit from "./Metadata/Unit";
import InvertedUnit from "./Metadata/InvertedUnit";
import Constant from "./Metadata/Constant";
import Phenomenon from "./Metadata/Phenomenon";
import UnitSystem from "./Metadata/UnitSystem";
import Format from "./Metadata/Format";

export type LazyLoadedSchema = Readonly<SchemaKey> & DelayedPromise<Schema>;

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
export type LazyLoadedUnit = LazyLoadedSchemaItem<Unit>;
export type LazyLoadedInvertedUnit = LazyLoadedSchemaItem<InvertedUnit>;
export type LazyLoadedConstant = LazyLoadedSchemaItem<Constant>;
export type LazyLoadedPhenomenon = LazyLoadedSchemaItem<Phenomenon>;
export type LazyLoadedUnitSystem = LazyLoadedSchemaItem<UnitSystem>;
export type LazyLoadedFormat = LazyLoadedSchemaItem<Format>;

export type AnyClass = EntityClass | Mixin | StructClass | CustomAttributeClass | RelationshipClass;
export type AnySchemaItem = AnyClass | Enumeration | KindOfQuantity | PropertyCategory | Unit | InvertedUnit | Constant | Phenomenon | UnitSystem | Format;

export interface SchemaItemVisitor {
  /* async */ visitFormat?: (format: Format) => Promise<void>;
  /* async */ visitUnitSystem?: (unitSystem: UnitSystem) => Promise<void>;
  /* async */ visitPhenomenon?: (phenomenon: Phenomenon) => Promise<void>;
  /* async */ visitConstant?: (constant: Constant) => Promise<void>;
  /* async */ visitInvertedUnit?: (invertedUnit: InvertedUnit) => Promise<void>;
  /* async */ visitEnumeration?: (enumeration: Enumeration) => Promise<void>;
  /* async */ visitUnit?: (unit: Unit) => Promise<void>;
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

  /**
   * Called after a Unit has been deserialized.
   * @param unit a fully-loaded Unit
   */
  /* async */ visitUnit?: (unit: Unit) => Promise<void>;

  /**
   * Called after an Inverted Unit has been deserialized.
   * @param invertedUnit a fully-loaded InvertedUnit
   */
  /* async */ visitInvertedUnit?: (invertedUnit: InvertedUnit) => Promise<void>;

  /**
   * Called after a Constant has been deserialized.
   * @param constant a fully-loaded Constant
   */
  /* async */ visitConstant?: (constant: Constant) => Promise<void>;

  /**
   * Called after a Phenomenon has been deserialized.
   * @param phenomena fully-loaded Phenomenon
   */
  /* async */ visitPhenomenon?: (phenomena: Phenomenon) => Promise<void>;

  /**
   * Called after a UnitSystem has been deserialized.
   * @param unitSystem fully-loaded UnitSystem
   */
  /* async */ visitUnitSystem?: (unitSystem: UnitSystem) => Promise<void>;

  /**
   * Called after a Format has been deserialized.
   * @param format fully-loaded Format
   */
  /* async */ visitFormat?: (format: Format) => Promise<void>;

}
