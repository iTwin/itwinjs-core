/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { DelayedPromise } from "./DelayedPromise";
import { ECClass, StructClass } from "./Metadata/Class";
import { Constant } from "./Metadata/Constant";
import { CustomAttributeClass } from "./Metadata/CustomAttributeClass";
import { EntityClass } from "./Metadata/EntityClass";
import { Enumeration } from "./Metadata/Enumeration";
import { InvertedUnit } from "./Metadata/InvertedUnit";
import { KindOfQuantity } from "./Metadata/KindOfQuantity";
import { Mixin } from "./Metadata/Mixin";
import { Phenomenon } from "./Metadata/Phenomenon";
import { PropertyCategory } from "./Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "./Metadata/RelationshipClass";
import { Schema } from "./Metadata/Schema";
import { SchemaItem } from "./Metadata/SchemaItem";
import { Unit } from "./Metadata/Unit";
import { UnitSystem } from "./Metadata/UnitSystem";
import { Format } from "./Metadata/Format";
import { SchemaKey, SchemaItemKey } from "./SchemaKey";
import { AnyProperty } from "./Metadata/Property";
import { CustomAttributeContainerProps, CustomAttribute } from "./Metadata/CustomAttribute";

export type LazyLoadedSchema = Readonly<SchemaKey> & DelayedPromise<Schema> & Promise<Schema>;

export type LazyLoadedSchemaItem<T extends SchemaItem> = Readonly<SchemaItemKey> & DelayedPromise<T> & Promise<T>;
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
export type AnyECType = Schema | SchemaItem | AnyProperty | RelationshipConstraint | CustomAttributeContainerProps | CustomAttribute;

/**
 * Interface to allow schema traversal/deserialization workflows to visit
 * each part, item, class, etc. that exists in a given schema.
 */
export interface ISchemaPartVisitor {
  /**
   * Called for a partially loaded schema. During deserialization, this would
   * be after a schema and all its references are deserialized, but _before_
   * any of its items or custom attributes have been deserialized.
   * @param schema A partially-loaded Schema.
   */
  /* async */ visitEmptySchema?: (schema: Schema) => Promise<void>;

  /**
   * Called for a fully loaded schema.
   * @param schema A fully-loaded Schema.
   */
  /* async */ visitFullSchema?: (schema: Schema) => Promise<void>;

  /**
   * Called for each [[SchemaItem]] instance.
   * @param schemaItem a SchemaItem object.
   */
  /* async */ visitSchemaItem?: (schemaItem: SchemaItem) => Promise<void>;

  /**
   * Called for each [[AnyClass]] instance.
   * @param ecClass an ECClass object.
   */
  /* async */ visitClass?: (ecClass: AnyClass) => Promise<void>;

  /**
   * Called for each [[AnyProperty]] instance of an ECClass.
   * @param property an AnyProperty object.
   */
  /* async */ visitProperty?: (property: AnyProperty) => Promise<void>;

  /**
   * Called for each [[EntityClass]] instance.
   * @param entityClass an EntityClass object.
   */
  /* async */ visitEntityClass?: (entityClass: EntityClass) => Promise<void>;

  /**
   * Called for each [[StructClass]] instance.
   * @param structClass a StructClass object.
   */
  /* async */ visitStructClass?: (structClass: StructClass) => Promise<void>;

  /**
   * Called for each [[Mixin]] instance.
   * @param mixin a Mixin object.
   */
  /* async */ visitMixin?: (mixin: Mixin) => Promise<void>;

  /**
   * Called for each [[RelationshipClass]] instance.
   * @param relationshipClass a RelationshipClass object.
   */
  /* async */ visitRelationshipClass?: (relationshipClass: RelationshipClass) => Promise<void>;

  /**
   * Called for each [[RelationshipConstraint]] of each RelationshipClass.
   * @param relationshipConstraint a RelationshipConstraint object.
   */
  /* async */ visitRelationshipConstraint?: (relationshipConstraint: RelationshipConstraint) => Promise<void>;

  /**
   * Called for each [[CustomAttributeClass]] instance.
   * @param customAttributeClass a CustomAttributeClass object.
   */
  /* async */ visitCustomAttributeClass?: (customAttributeClass: CustomAttributeClass) => Promise<void>;

  /**
   * Called for each CustomAttribute container in the schema.
   * @param customAttributeContainer a CustomAttributeContainerProps object.
   */
  /* async */ visitCustomAttributeContainer?: (customAttributeContainer: CustomAttributeContainerProps) => Promise<void>;

  /**
   * Called for each [[Enumeration]] instance.
   * @param enumeration an Enumeration object.
   */
  /* async */ visitEnumeration?: (enumeration: Enumeration) => Promise<void>;

  /**
   * Called for each [[KindOfQuantity]] instance.
   * @param koq a KindOfQuantity object.
   */
  /* async */ visitKindOfQuantity?: (koq: KindOfQuantity) => Promise<void>;

  /**
   * Called for each [[PropertyCategory]] instance.
   * @param category a PropertyCategory object.
   */
  /* async */ visitPropertyCategory?: (category: PropertyCategory) => Promise<void>;

  /**
   * Called for each [[Format]] instance.
   * @param format a Format object.
   */
  /* async */ visitFormat?: (format: Format) => Promise<void>;

  /**
   * Called for each [[Unit]] instance.
   * @param unit a Unit object.
   */
  /* async */ visitUnit?: (unit: Unit) => Promise<void>;

  /**
   * Called for each [[InvertedUnit]] instance.
   * @param invertedUnit an InvertedUnit object.
   */
  /* async */ visitInvertedUnit?: (invertedUnit: InvertedUnit) => Promise<void>;

  /**
   * Called for each [[UnitSystem]] instance.
   * @param unitSystem a UnitSystem object.
   */
  /* async */ visitUnitSystem?: (unitSystem: UnitSystem) => Promise<void>;

  /**
   * Called for each [[Phenomenon]] instance.
   * @param phenomena a Phenomenon object.
   */
  /* async */ visitPhenomenon?: (phenomena: Phenomenon) => Promise<void>;

  /**
   * Called for each [[Constant]] instance.
   * @param constant a Constant object.
   */
  /* async */ visitConstant?: (constant: Constant) => Promise<void>;
}

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

  visitFormatSync?: (format: Format) => void;
  visitUnitSystemSync?: (unitSystem: UnitSystem) => void;
  visitPhenomenonSync?: (phenomenon: Phenomenon) => void;
  visitConstantSync?: (constant: Constant) => void;
  visitInvertedUnitSync?: (invertedUnit: InvertedUnit) => void;
  visitEnumerationSync?: (enumeration: Enumeration) => void;
  visitUnitSync?: (unit: Unit) => void;
  visitKindOfQuantitySync?: (koq: KindOfQuantity) => void;
  visitPropertyCategorySync?: (category: PropertyCategory) => void;
  visitClassSync?: (ecClass: AnyClass) => void;
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

  visitEmptySchemaSync?: (schema: Schema) => void;
  visitFullSchemaSync?: (schema: Schema) => void;
}
