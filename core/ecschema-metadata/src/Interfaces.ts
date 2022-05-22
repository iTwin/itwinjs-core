/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromise } from "./DelayedPromise";
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
