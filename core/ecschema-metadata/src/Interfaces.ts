/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { ECClass, StructClass } from "./Metadata/Class";
import { Constant } from "./Metadata/Constant";
import { CustomAttribute, CustomAttributeContainerProps } from "./Metadata/CustomAttribute";
import { CustomAttributeClass } from "./Metadata/CustomAttributeClass";
import { EntityClass } from "./Metadata/EntityClass";
import { AnyEnumerator, Enumeration } from "./Metadata/Enumeration";
import { Format } from "./Metadata/Format";
import { InvertedUnit } from "./Metadata/InvertedUnit";
import { KindOfQuantity } from "./Metadata/KindOfQuantity";
import { Mixin } from "./Metadata/Mixin";
import { OverrideFormat } from "./Metadata/OverrideFormat";
import { Phenomenon } from "./Metadata/Phenomenon";
import { AnyProperty } from "./Metadata/Property";
import { PropertyCategory } from "./Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "./Metadata/RelationshipClass";
import { Schema } from "./Metadata/Schema";
import { SchemaItem } from "./Metadata/SchemaItem";
import { Unit } from "./Metadata/Unit";
import { UnitSystem } from "./Metadata/UnitSystem";
import { SchemaItemKey, SchemaKey } from "./SchemaKey";

/** @public @preview */
export type LazyLoadedSchema = SchemaKey & Promise<Schema>;

/** @public @preview */
export type LazyLoadedSchemaItem<T extends SchemaItem> = SchemaItemKey & Promise<T>;
/** @public @preview */
export type LazyLoadedECClass = LazyLoadedSchemaItem<ECClass>;
/** @public @preview */
export type LazyLoadedEntityClass = LazyLoadedSchemaItem<EntityClass>;
/** @public @preview */
export type LazyLoadedMixin = LazyLoadedSchemaItem<Mixin>;
/** @public @preview */
export type LazyLoadedStructClass = LazyLoadedSchemaItem<StructClass>;
/** @public @preview */
export type LazyLoadedRelationshipClass = LazyLoadedSchemaItem<RelationshipClass>;
/** @public @preview */
export type LazyLoadedEnumeration = LazyLoadedSchemaItem<Enumeration>;
/** @public @preview */
export type LazyLoadedFormat = LazyLoadedSchemaItem<Format>;
/** @public @preview */
export type LazyLoadedKindOfQuantity = LazyLoadedSchemaItem<KindOfQuantity>;
/** @public @preview */
export type LazyLoadedPropertyCategory = LazyLoadedSchemaItem<PropertyCategory>;
/** @public @preview */
export type LazyLoadedRelationshipConstraintClass = LazyLoadedSchemaItem<EntityClass | Mixin | RelationshipClass>;
/** @public @preview */
export type LazyLoadedUnit = LazyLoadedSchemaItem<Unit>;
/** @public @preview */
export type LazyLoadedInvertedUnit = LazyLoadedSchemaItem<InvertedUnit>;
/** @public @preview */
export type LazyLoadedPhenomenon = LazyLoadedSchemaItem<Phenomenon>;
/** @public @preview */
export type LazyLoadedUnitSystem = LazyLoadedSchemaItem<UnitSystem>;

/** @public @preview */
export type AnyClass =
  EntityClass |
  Mixin |
  StructClass |
  CustomAttributeClass |
  RelationshipClass;

/** @public @preview */
export type AnySchemaItem =
  AnyClass |
  Enumeration |
  KindOfQuantity |
  PropertyCategory |
  Unit |
  InvertedUnit |
  Constant |
  Phenomenon |
  UnitSystem |
  Format;

/** @public @preview */
export type AnyECType =
  Schema |
  SchemaItem |
  AnyProperty |
  RelationshipConstraint |
  CustomAttributeContainerProps |
  CustomAttribute |
  OverrideFormat |
  AnyEnumerator;

/**
 *  Holds the SchemaKeys for a schema and it's references.  Designed so that Schema fulfills this interface.
 * @public @preview
 */
export interface SchemaInfo {
  readonly alias: string;
  readonly schemaKey: SchemaKey;
  readonly references: ReadonlyArray<WithSchemaKey>;
}

/** @public @preview */
export interface WithSchemaKey {
  readonly schemaKey: SchemaKey;
}

/** This is needed to break a circular dependency between Class and EntityClass.
 * @public @preview
 */
export interface HasMixins {
  readonly mixins: ReadonlyArray<LazyLoadedMixin>;
  getMixinsSync(): Iterable<Mixin>;
}
