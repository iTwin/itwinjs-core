/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { SchemaChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";
import { SchemaDiagnosticVisitor } from "./SchemaDiagnosticVisitor";
import type { Schema } from "@itwin/ecschema-metadata";

/**
 * @internal
 */
export type DifferenceType = "add" | "modify";

/**
 * @internal
 */
export namespace SchemaDifference {
  /**
   * Creates a [[SchemaDifference]] for two given schemas.
   * @param targetSchema  The schema the differences gets merged into.
   * @param sourceSchema  The schema to get merged in the target.
   * @returns             An [[SchemaDifference]] object.
   */
  export async function fromSchemas(targetSchema: Schema, sourceSchema: Schema): Promise<SchemaDifference> {
    const changesList: SchemaChanges[] = [];
    const schemaComparer = new SchemaComparer({ report: changesList.push.bind(changesList) });
    await schemaComparer.compareSchemas(sourceSchema, targetSchema);

    return fromSchemaChanges(targetSchema, changesList[0]);
  }

  /**
   * Creates a [[SchemaDifference]] for a given [[SchemaChanges]] report.
   * @param targetSchema
   * @param schemaChanges   A changes report of two schemas.
   * @returns               An [[SchemaDifference]] object.
   */
  export async function fromSchemaChanges(targetSchema: Schema, schemaChanges: SchemaChanges): Promise<SchemaDifference> {
    const schemaDifference: SchemaDifference = {
      sourceSchemaName: schemaChanges.schema.schemaKey.toString(),
      targetSchemaName: targetSchema.schemaKey.toString(),
    };

    const visitor = new SchemaDiagnosticVisitor(schemaDifference);
    for(const diagnostic of schemaChanges.allDiagnostics) {
      visitor.visit(diagnostic);
    }

    return schemaDifference;
  }
}

/**
 * @internal
 */
export interface SchemaDifference {

  readonly sourceSchemaName: string;
  readonly targetSchemaName: string;

  label?: string;
  description?: string;

  references?: SchemaReferenceDifference[];
  customAttributes?: CustomAttributeDifference[];

  items?: {
    [name: string]: SchemaItemDifference;
  };
}

/**
 * @internal
 */
export interface CustomAttributeDifference {
  readonly $changeType: DifferenceType;
  readonly className: string;
  [value: string]: unknown;
}

/**
 * @internal
 */
export interface SchemaReferenceDifference {
  readonly $changeType: DifferenceType;
  readonly name: string;
  readonly version: string;
}

/**
 * @internal
 */
export interface SchemaItemDifference {
  readonly $changeType: DifferenceType;
  label?: string;
  description?: string;
  customAttributes?: CustomAttributeDifference[];
}

/**
 * @internal
 */
export interface EnumerationDifference extends SchemaItemDifference {
  type?: string;
  isStrict?: boolean;
  enumerators?: EnumeratorDifference[];
}

/**
 * @internal
 */
export interface EnumeratorDifference {
  readonly $changeType: DifferenceType;
  readonly name: string;
  value?: string | number;
  label?: string;
  description?: string;
}

/**
 * @internal
 */
export interface KindOfQuantityDifference extends SchemaItemDifference {
  persistenceUnit?: string;
  presentationUnits?: string | string[];
  relativeError?: number;
}

/**
 * @internal
 */
export interface PropertyCategoryDifference extends SchemaItemDifference {
  priority?: number;
}

/**
 * @internal
 */
export interface ConstantDifference extends SchemaItemDifference {
  phenomenon?: string;
  definition?: string;
  numerator?: number;
  denominator?: number;
}

/**
 * @internal
 */
export interface FormatDifference extends SchemaItemDifference {
  type?: string;
  precision?: number;
  roundFactor?: number;
  minWidth?: number;
  showSignOption?: string;
  formatTraits?: string | string[];
  decimalSeparator?: string;
  thousandSeparator?: string;
  uomSeparator?: string;
  scientificType?: string;
  stationOffsetSize?: number;
  stationSeparator?: string;
  composite?: {
    spacer?: string;
    includeZero?: boolean;
    units: Array<{
      name: string;
      label?: string;
    }>;
  };
}

/**
 * @internal
 */
export interface InvertedUnitDifference extends SchemaItemDifference {
  invertsUnit?: string;
  unitSystem?: string;
}

/**
 * @internal
 */
export interface PhenomenonDifference extends SchemaItemDifference {
  definition?: string;
}

/**
 * @internal
 */
export type UnitSystemDifference = SchemaItemDifference;

/**
 * @internal
 */
export interface UnitDifference extends SchemaItemDifference {
  phenomenon?: string;
  unitSystem?: string;
  definition?: string;
  numerator?: number;
  denominator?: number;
  offset?: number;
}

/**
 * @internal
 */
export interface ClassDifference extends SchemaItemDifference {
  modifier?: string;
  baseClass?: {
    readonly $changeType: DifferenceType;
    readonly className: string;
  };
  properties?: PropertyDifference[];
}

/**
 * @internal
 */
export interface EntityClassDifference extends ClassDifference {
  mixins?: string[];
}

/**
 * @internal
 */
export interface MixinDifference extends ClassDifference {
  appliesTo?: string;
}

/**
 * @internal
 */
export type StructClassDifference = ClassDifference;

/**
 * @internal
 */
export interface CustomAttributeClassDifference extends ClassDifference {
  appliesTo?: string;
}

/**
 * @internal
 */
export interface RelationshipClassDifference extends ClassDifference {
  strength?: string;
  strengthDirection?: string;
  source?: RelationshipConstraintDifference;
  target?: RelationshipConstraintDifference;
}

/**
 * @internal
 */
export interface RelationshipConstraintDifference {
  readonly $changeType: DifferenceType;
  multiplicity?: string;
  roleLabel?: string;
  polymorphic?: boolean;
  abstractConstraint?: string;
  constraintClasses?: string[];
  customAttributes?: CustomAttributeDifference[];
}

/**
 * @internal
 */
export interface PropertyDifference {
  readonly $changeType: DifferenceType;
  readonly name: string;
  type?: string;
  description?: string;
  label?: string;
  isReadOnly?: boolean;
  category?: string;
  priority?: number;
  inherited?: boolean;
  kindOfQuantity?: string;
  customAttributes?: CustomAttributeDifference[];
}

/**
 * @internal
 */
export interface PrimitivePropertyDifference extends PropertyDifference {
  typeName?: string;
  extendedTypeName?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
}

/**
 * @internal
 */
export type EnumerationPropertyDifference = PrimitivePropertyDifference;

/**
 * @internal
 */
export interface NavigationPropertyDifference extends PrimitivePropertyDifference {
  relationshipName?: string;
  direction?: string;
}

/**
 * @internal
 */
export interface StructPropertyDifference extends PropertyDifference {
  typeName?: string;
}

/**
 * @internal
 */
export interface ArrayPropertyDifference extends PrimitivePropertyDifference {
  typeName?: string;
  minOccurs?: number;
  maxOccurs?: number;
}

/**
 * @internal
 */
export type PrimitiveArrayPropertyDifference = ArrayPropertyDifference;

/**
 * @internal
 */
export type StructArrayPropertyDifference = ArrayPropertyDifference;
