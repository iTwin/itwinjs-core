/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import type { SchemaType } from "./SchemaDifference";

const conflictDomain = "SchemaConflict";

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

  ConflictingItemName = `${conflictDomain}-001`,
  ConflictingReferenceAlias = `${conflictDomain}-002`,

  ConflictingBaseClass = `${conflictDomain}-100`,
  RemovingBaseClass = `${conflictDomain}-101`,
  SealedBaseClass = `${conflictDomain}-102`,

  ConflictingEnumerationType = `${conflictDomain}-700`,
  ConflictingEnumeratorValue = `${conflictDomain}-701`,

  ConflictingPersistenceUnit = `${conflictDomain}-1010`,
  MixinAppliedMustDeriveFromConstraint = `${conflictDomain}-1100`,

  ConflictingPropertyName = `${conflictDomain}-1300`,

  AbstractConstraintMustNarrowBaseConstraints = `${conflictDomain}-1500`,
  DerivedConstraintsMustNarrowBaseConstraints = `${conflictDomain}-1501`,
  ConstraintClassesDeriveFromAbstractConstraint = `${conflictDomain}-1502`,
}

/**
 * Defines the interface for a conflict during Schema Differencing. Conflicts were discovered
 * while comparing the changed elements. Conflicts in the whole schema context are not found
 * on that level.
 *
 * @alpha
 */
export interface SchemaDifferenceConflict {
  /**
   * The name of the schema type which is "Schema" for a conflict on the schema, on schema items
   * or objects that are related to schema items (properties, relationship constraints) it is the
   * name of the related schema item.
   */
  readonly schemaType: SchemaType;

  /** The name of the schema item the conflict appears on. */
  readonly itemName?: string;

  /** Optional path what on the item was conflicting. */
  readonly path?: string;

  /** The unique conflicting code. */
  readonly code: ConflictCode;

  /** A description of the conflict. */
  readonly description: string;

  /** The value in the source schema. */
  readonly source: unknown;

  /** The value in the target schema. */
  readonly target: unknown;

  /** The conflicting difference */
  readonly difference?: unknown;
}
