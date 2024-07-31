/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { SchemaItemType } from "@itwin/ecschema-metadata";
import {
  type AnySchemaDifference,
  type AnySchemaItemDifference,
  type ClassItemDifference,
  type ClassPropertyDifference,
  type ConstantDifference,
  type CustomAttributeClassDifference,
  type CustomAttributeDifference,
  type EntityClassDifference,
  type EntityClassMixinDifference,
  type EnumerationDifference,
  type EnumeratorDifference,
  type KindOfQuantityDifference,
  type MixinClassDifference,
  type PhenomenonDifference,
  type PropertyCategoryDifference,
  type RelationshipClassDifference,
  type RelationshipConstraintClassDifference,
  type RelationshipConstraintDifference,
  type SchemaDifference,
  SchemaOtherTypes,
  type SchemaReferenceDifference,
  type StructClassDifference,
  type UnitSystemDifference,
} from "./SchemaDifference";

/**
 * Indicates whether the given difference is type of ConstantDifference.
 * @alpha
 */
export function isConstantDifference(difference: AnySchemaDifference): difference is ConstantDifference {
  return difference.schemaType === SchemaItemType.Constant;
}

/**
 * Indicates whether the given difference is type of ClassPropertyDifference.
 * @alpha
 */
export function isClassPropertyDifference(difference: AnySchemaDifference): difference is ClassPropertyDifference {
  return difference.schemaType === SchemaOtherTypes.Property;
}

/**
 * Indicates whether the given difference is type of CustomAttributeClassDifference.
 * @alpha
 */
export function isCustomAttributeClassDifference(difference: AnySchemaDifference): difference is CustomAttributeClassDifference {
  return difference.schemaType === SchemaItemType.CustomAttributeClass;
}

/**
 * Indicates whether the given difference is type of CustomAttributeDifference.
 * @alpha
 */
export function isCustomAttributeDifference(difference: AnySchemaDifference): difference is CustomAttributeDifference {
  return difference.schemaType === SchemaOtherTypes.CustomAttributeInstance;
}

/**
 * Indicates whether the given difference is type of EntityClassDifference.
 * @alpha
 */
export function isEntityClassDifference(difference: AnySchemaDifference): difference is EntityClassDifference {
  return difference.schemaType === SchemaItemType.EntityClass;
}

/**
 * Indicates whether the given difference is type of EntityClassMixinDifference.
 * @alpha
 */
export function isEntityClassMixinDifference(difference: AnySchemaDifference): difference is EntityClassMixinDifference {
  return difference.schemaType === SchemaOtherTypes.EntityClassMixin;
}

/**
 * Indicates whether the given difference is type of EnumerationDifference.
 * @alpha
 */
export function isEnumerationDifference(difference: AnySchemaDifference): difference is EnumerationDifference {
  return difference.schemaType === SchemaItemType.Enumeration;
}

/**
 * Indicates whether the given difference is type of EnumeratorDifference.
 * @alpha
 */
export function isEnumeratorDifference(difference: AnySchemaDifference): difference is EnumeratorDifference {
  return difference.schemaType === SchemaOtherTypes.Enumerator;
}

/**
 * Indicates whether the given difference is type of KindOfQuantityDifference.
 * @alpha
 */
export function isKindOfQuantityDifference(difference: AnySchemaDifference): difference is KindOfQuantityDifference {
  return difference.schemaType === SchemaItemType.KindOfQuantity;
}

/**
 * Indicates whether the given difference is type of MixinClassDifference.
 * @alpha
 */
export function isMixinClassDifference(difference: AnySchemaDifference): difference is MixinClassDifference {
  return difference.schemaType === SchemaItemType.Mixin;
}

/**
 * Indicates whether the given difference is type of PhenomenonDifference.
 * @alpha
 */
export function isPhenomenonDifference(difference: AnySchemaDifference): difference is PhenomenonDifference {
  return difference.schemaType === SchemaItemType.Phenomenon;
}

/**
 * Indicates whether the given difference is type of PropertyCategoryDifference.
 * @alpha
 */
export function isPropertyCategoryDifference(difference: AnySchemaDifference): difference is PropertyCategoryDifference {
  return difference.schemaType === SchemaItemType.PropertyCategory;
}

/**
 * Indicates whether the given difference is type of SchemaDifference.
 * @alpha
 */
export function isSchemaDifference(difference: AnySchemaDifference): difference is SchemaDifference {
  return difference.schemaType === SchemaOtherTypes.Schema;
}

/**
 * Indicates whether the given difference is type of SchemaReferenceDifference.
 * @alpha
 */
export function isSchemaReferenceDifference(difference: AnySchemaDifference): difference is SchemaReferenceDifference {
  return difference.schemaType === SchemaOtherTypes.SchemaReference;
}

/**
 * Indicates whether the given difference is type of CustomAttributeDifference.
 * @alpha
 */
export function isStructClassDifference(difference: AnySchemaDifference): difference is StructClassDifference {
  return difference.schemaType === SchemaItemType.StructClass;
}

/**
 * Indicates whether the given difference is type of UnitSystemDifference.
 * @alpha
 */
export function isUnitSystemDifference(difference: AnySchemaDifference): difference is UnitSystemDifference {
  return difference.schemaType === SchemaItemType.UnitSystem;
}

/**
 * Indicates whether the given difference is type of RelationshipClassDifference.
 * @alpha
 */
export function isRelationshipClassDifference(difference: AnySchemaDifference): difference is RelationshipClassDifference {
  return difference.schemaType === SchemaItemType.RelationshipClass;
}

/**
 * Indicates whether the given difference is type of RelationshipConstraintDifference.
 * @alpha
 */
export function isRelationshipConstraintDifference(difference: AnySchemaDifference): difference is RelationshipConstraintDifference {
  return difference.schemaType === SchemaOtherTypes.RelationshipConstraint;
}

/**
 * Indicates whether the given difference is type of RelationshipConstraintClassDifference.
 * @alpha
 */
export function isRelationshipConstraintClassDifference(difference: AnySchemaDifference): difference is RelationshipConstraintClassDifference {
  return difference.schemaType === SchemaOtherTypes.RelationshipConstraintClass;
}

/**
 * Indicates whether the given difference is type of AnySchemaItemDifference.
 * @alpha
 */
export function isSchemaItemDifference(difference: AnySchemaDifference): difference is AnySchemaItemDifference {
  return difference.schemaType in SchemaItemType;
}

/**
 * Indicates whether the given difference is type of ClassItemDifference.
 * @alpha
 */
export function isClassDifference(difference: AnySchemaDifference): difference is ClassItemDifference {
  return isStructClassDifference(difference)
    || isCustomAttributeClassDifference(difference)
    || isEntityClassDifference(difference)
    || isMixinClassDifference(difference)
    || isRelationshipClassDifference(difference);
}
