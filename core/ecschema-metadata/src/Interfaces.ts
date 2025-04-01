/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromise } from "./DelayedPromise.js";
import { ECClass, StructClass } from "./Metadata/Class.js";
import { Constant } from "./Metadata/Constant.js";
import { CustomAttribute, CustomAttributeContainerProps } from "./Metadata/CustomAttribute.js";
import { CustomAttributeClass } from "./Metadata/CustomAttributeClass.js";
import { EntityClass } from "./Metadata/EntityClass.js";
import { AnyEnumerator, Enumeration } from "./Metadata/Enumeration.js";
import { Format } from "./Metadata/Format.js";
import { InvertedUnit } from "./Metadata/InvertedUnit.js";
import { KindOfQuantity } from "./Metadata/KindOfQuantity.js";
import { Mixin } from "./Metadata/Mixin.js";
import { OverrideFormat } from "./Metadata/OverrideFormat.js";
import { Phenomenon } from "./Metadata/Phenomenon.js";
import { AnyProperty } from "./Metadata/Property.js";
import { PropertyCategory } from "./Metadata/PropertyCategory.js";
import { RelationshipClass, RelationshipConstraint } from "./Metadata/RelationshipClass.js";
import { Schema } from "./Metadata/Schema.js";
import { SchemaItem } from "./Metadata/SchemaItem.js";
import { Unit } from "./Metadata/Unit.js";
import { UnitSystem } from "./Metadata/UnitSystem.js";
import { SchemaItemKey, SchemaKey } from "./SchemaKey.js";

/** @beta */
export type LazyLoadedSchema = SchemaKey & DelayedPromise<Schema> & Promise<Schema>;

/** @beta */
export type LazyLoadedSchemaItem<T extends SchemaItem> = Readonly<SchemaItemKey> & DelayedPromise<T> & Promise<T>;
/** @beta */
export type LazyLoadedECClass = LazyLoadedSchemaItem<ECClass>;
/** @beta */
export type LazyLoadedEntityClass = LazyLoadedSchemaItem<EntityClass>;
/** @beta */
export type LazyLoadedMixin = LazyLoadedSchemaItem<Mixin>;
/** @beta */
export type LazyLoadedStructClass = LazyLoadedSchemaItem<StructClass>;
/** @beta */
export type LazyLoadedCustomAttributeClass = LazyLoadedSchemaItem<CustomAttributeClass>;
/** @beta */
export type LazyLoadedRelationshipClass = LazyLoadedSchemaItem<RelationshipClass>;
/** @beta */
export type LazyLoadedEnumeration = LazyLoadedSchemaItem<Enumeration>;
/** @beta */
export type LazyLoadedKindOfQuantity = LazyLoadedSchemaItem<KindOfQuantity>;
/** @beta */
export type LazyLoadedPropertyCategory = LazyLoadedSchemaItem<PropertyCategory>;
/** @beta */
export type LazyLoadedRelationshipConstraintClass = LazyLoadedSchemaItem<EntityClass | Mixin | RelationshipClass>;
/** @beta */
export type LazyLoadedUnit = LazyLoadedSchemaItem<Unit>;
/** @beta */
export type LazyLoadedInvertedUnit = LazyLoadedSchemaItem<InvertedUnit>;
/** @beta */
export type LazyLoadedConstant = LazyLoadedSchemaItem<Constant>;
/** @beta */
export type LazyLoadedPhenomenon = LazyLoadedSchemaItem<Phenomenon>;
/** @beta */
export type LazyLoadedUnitSystem = LazyLoadedSchemaItem<UnitSystem>;
/** @beta */
export type LazyLoadedFormat = LazyLoadedSchemaItem<Format>;

/** @beta */
export type AnyClass = EntityClass | Mixin | StructClass | CustomAttributeClass | RelationshipClass;
/** @beta */
export type AnySchemaItem = AnyClass | Enumeration | KindOfQuantity | PropertyCategory | Unit | InvertedUnit | Constant | Phenomenon | UnitSystem | Format;
/** @beta */
export type AnyECType = Schema | SchemaItem | AnyProperty | RelationshipConstraint | CustomAttributeContainerProps | CustomAttribute | OverrideFormat | AnyEnumerator;

/**
 *  Holds the SchemaKeys for a schema and it's references.  Designed so that Schema fulfills this interface.
 * @beta
 */
export interface SchemaInfo {
  schemaKey: SchemaKey;
  references: WithSchemaKey[];
}

/** @beta */
export interface WithSchemaKey {
  schemaKey: SchemaKey;
}

/** This is needed to break a circular dependency between Class and EntityClass.
 * @beta
 */
export interface HasMixins {
  mixins: LazyLoadedMixin[];
  getMixinsSync(): Iterable<Mixin>;
}
