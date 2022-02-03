/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import type { DelayedPromise } from "./DelayedPromise";
import type { ECClass, StructClass } from "./Metadata/Class";
import type { Constant } from "./Metadata/Constant";
import type { CustomAttribute, CustomAttributeContainerProps } from "./Metadata/CustomAttribute";
import type { CustomAttributeClass } from "./Metadata/CustomAttributeClass";
import type { EntityClass } from "./Metadata/EntityClass";
import type { AnyEnumerator, Enumeration } from "./Metadata/Enumeration";
import type { Format } from "./Metadata/Format";
import type { InvertedUnit } from "./Metadata/InvertedUnit";
import type { KindOfQuantity } from "./Metadata/KindOfQuantity";
import type { Mixin } from "./Metadata/Mixin";
import type { OverrideFormat } from "./Metadata/OverrideFormat";
import type { Phenomenon } from "./Metadata/Phenomenon";
import type { AnyProperty } from "./Metadata/Property";
import type { PropertyCategory } from "./Metadata/PropertyCategory";
import type { RelationshipClass, RelationshipConstraint } from "./Metadata/RelationshipClass";
import type { Schema } from "./Metadata/Schema";
import type { SchemaItem } from "./Metadata/SchemaItem";
import type { Unit } from "./Metadata/Unit";
import type { UnitSystem } from "./Metadata/UnitSystem";
import type { SchemaItemKey, SchemaKey } from "./SchemaKey";

/** @beta */
export type LazyLoadedSchema = Readonly<SchemaKey> & DelayedPromise<Schema> & Promise<Schema>;

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
