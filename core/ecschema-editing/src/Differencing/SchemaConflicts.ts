/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import type { SchemaItemType } from "@itwin/ecschema-metadata";
import type { AnySchemaDifference, SchemaOtherTypes, SchemaType } from "./SchemaDifference";

/**
 * The unique conflicts codes for Schema differencing.
 *
 * To provide meaning to code values, with anticipation
 * of future rules for all current EC Types, the following
 * value ranges should be used:
 *
 * - Schema:                    000-099
 * - Class:                     100-199
 * - Constant:                  200-299
 * - CustomAttribute            300-399
 * - CustomAttributeClass:      400-499
 * - CustomAttributeContainer:  500-599
 * - EntityClass:               600-699
 * - Enumeration:               700-799
 * - Format:                    800-899
 * - InvertedUnit:              900-999
 * - KindOfQuantity:            1000-1099
 * - Mixin:                     1100-1199
 * - Phenomenon:                1200-1299
 * - Property:                  1300-1399
 * - PropertyCategory:          1400-1499
 * - RelationshipClass:         1500-1599
 * - RelationshipConstraint:    1600-1699
 * - StructClass:               1700-1799
 * - Unit:                      1800-1899
 * - UnitSystem:                1900-1999
 *
 * @alpha
 */
export enum ConflictCode {

  ConflictingItemName = "C-001",
  ConflictingReferenceAlias = "C-002",
  ConflictingReferenceVersion = "C-003",

  ConflictingBaseClass = "C-100",
  RemovingBaseClass = "C-101",
  SealedBaseClass = "C-102",
  ConflictingClassModifier = "C-103",

  ConflictingEnumerationType = "C-700",
  ConflictingEnumeratorValue = "C-701",

  ConflictingPersistenceUnit = "C-1010",
  MixinAppliedMustDeriveFromConstraint = "C-1100",

  ConflictingPropertyName = "C-1300",
  ConflictingPropertyKindOfQuantity = "C-1301",
  ConflictingPropertyKindOfQuantityUnit = "C-1302",

  AbstractConstraintMustNarrowBaseConstraints = "C-1500",
  DerivedConstraintsMustNarrowBaseConstraints = "C-1501",
  ConstraintClassesDeriveFromAbstractConstraint = "C-1502",
}

/**
 * Defines the interface for a conflict during Schema Differencing. Conflicts were discovered
 * while comparing the changed elements. Conflicts in the whole schema context are not found
 * on that level.
 */
interface SchemaDifferenceConflict<TCode extends ConflictCode, TType extends SchemaType, TDifference = Extract<AnySchemaDifference, { schemaType: TType }>> {
  /** The associated schema difference instance */
  readonly difference: TDifference;

  /** The unique conflicting code. */
  readonly code: TCode;

  /** A description of the conflict. */
  readonly description: string;

  /** The value in the source schema. */
  readonly source: unknown;

  /** The value in the target schema. */
  readonly target: unknown;
}

/** Union type of class types */
type EcClassTypes = SchemaItemType.CustomAttributeClass |  SchemaItemType.EntityClass | SchemaItemType.StructClass | SchemaItemType.Mixin | SchemaItemType.RelationshipClass;

/**
 * Union of all supported schema differencing conflict types.
 * @alpha
 */
export type AnySchemaDifferenceConflict =
  SchemaDifferenceConflict<ConflictCode.ConflictingItemName, SchemaItemType> |
  SchemaDifferenceConflict<ConflictCode.ConflictingReferenceAlias, SchemaOtherTypes.SchemaReference> |
  SchemaDifferenceConflict<ConflictCode.ConflictingReferenceVersion, SchemaOtherTypes.SchemaReference> |
  SchemaDifferenceConflict<ConflictCode.ConflictingBaseClass, EcClassTypes> |
  SchemaDifferenceConflict<ConflictCode.RemovingBaseClass, EcClassTypes> |
  SchemaDifferenceConflict<ConflictCode.SealedBaseClass, EcClassTypes> |
  SchemaDifferenceConflict<ConflictCode.ConflictingClassModifier, EcClassTypes> |
  SchemaDifferenceConflict<ConflictCode.ConflictingEnumerationType, SchemaItemType.Enumeration> |
  SchemaDifferenceConflict<ConflictCode.ConflictingEnumeratorValue, SchemaOtherTypes.Enumerator> |
  SchemaDifferenceConflict<ConflictCode.ConflictingPersistenceUnit, SchemaItemType.KindOfQuantity> |
  SchemaDifferenceConflict<ConflictCode.MixinAppliedMustDeriveFromConstraint, SchemaOtherTypes.EntityClassMixin> |
  SchemaDifferenceConflict<ConflictCode.ConflictingPropertyName, SchemaOtherTypes.Property> |
  SchemaDifferenceConflict<ConflictCode.ConflictingPropertyKindOfQuantity, SchemaOtherTypes.Property> |
  SchemaDifferenceConflict<ConflictCode.ConflictingPropertyKindOfQuantityUnit, SchemaOtherTypes.Property> |
  SchemaDifferenceConflict<ConflictCode.AbstractConstraintMustNarrowBaseConstraints, SchemaOtherTypes.RelationshipConstraint> |
  SchemaDifferenceConflict<ConflictCode.DerivedConstraintsMustNarrowBaseConstraints, SchemaOtherTypes.RelationshipConstraint> |
  SchemaDifferenceConflict<ConflictCode.ConstraintClassesDeriveFromAbstractConstraint, SchemaOtherTypes.RelationshipConstraint>
;
