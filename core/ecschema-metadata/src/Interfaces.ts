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
