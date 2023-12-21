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
import type {
  AnyEnumerator, Constant, CustomAttribute, CustomAttributeClass, ECClass, EntityClass, Enumeration,
  EnumerationProperty, Format, InvertedUnit, KindOfQuantity, Mixin, NavigationProperty, Phenomenon, PrimitiveProperty,
  Property, PropertyCategory, RelationshipClass, RelationshipConstraint, Schema, SchemaItem, StructClass,
  StructProperty, Unit, UnitSystem,
} from "@itwin/ecschema-metadata";

/**
 * @internal
 */
export type DifferenceType = "missing" | "changed";
interface DifferenceObject<T> {
  readonly schemaChangeType: DifferenceType;
  readonly sourceObject: T;
}

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

    return fromSchemaChanges(changesList[0]);
  }

  /**
   * Creates a [[SchemaDifference]] for a given [[SchemaChanges]] report.
   * @param schemaChanges   A changes report of two schemas.
   * @returns               An [[SchemaDifference]] object.
   */
  export async function fromSchemaChanges(schemaChanges: SchemaChanges): Promise<SchemaDifference> {
    const schemaDifference: SchemaDifference = {
      sourceSchema: schemaChanges.schema,
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

  readonly sourceSchema: Schema;

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
export interface CustomAttributeDifference extends DifferenceObject<CustomAttribute> {
  readonly className: string;
  [value: string]: unknown;
}

/**
 * @internal
 */
export interface SchemaReferenceDifference extends DifferenceObject<Schema> {
  readonly name: string;
  readonly version: string;
}

/**
 * @internal
 */
export interface SchemaItemDifference<T extends SchemaItem=SchemaItem> extends DifferenceObject<T> {
  readonly schemaItemType: string;
  readonly schemaItemName: string;
  label?: string;
  description?: string;
  customAttributes?: CustomAttributeDifference[];
}

/**
 * @internal
 */
export interface EnumerationDifference extends SchemaItemDifference<Enumeration> {
  type?: string;
  isStrict?: boolean;
  enumerators?: {
    [name: string]: EnumeratorDifference;
  };
}

/**
 * @internal
 */
export interface EnumeratorDifference extends DifferenceObject<AnyEnumerator> {
  readonly name: string;
  value?: string | number;
  label?: string;
  description?: string;
}

/**
 * @internal
 */
export interface KindOfQuantityDifference extends SchemaItemDifference<KindOfQuantity> {
  persistenceUnit?: string;
  presentationUnits?: string | string[];
  relativeError?: number;
}

/**
 * @internal
 */
export interface PropertyCategoryDifference extends SchemaItemDifference<PropertyCategory> {
  priority?: number;
}

/**
 * @internal
 */
export interface ConstantDifference extends SchemaItemDifference<Constant> {
  phenomenon?: string;
  definition?: string;
  numerator?: number;
  denominator?: number;
}

/**
 * @internal
 */
export interface FormatDifference extends SchemaItemDifference<Format> {
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
export interface InvertedUnitDifference extends SchemaItemDifference<InvertedUnit> {
  invertsUnit?: string;
  unitSystem?: string;
}

/**
 * @internal
 */
export interface PhenomenonDifference extends SchemaItemDifference<Phenomenon> {
  definition?: string;
}

/**
 * @internal
 */
export type UnitSystemDifference = SchemaItemDifference<UnitSystem>;

/**
 * @internal
 */
export interface UnitDifference extends SchemaItemDifference<Unit> {
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
export interface ClassDifference<T extends ECClass = ECClass> extends SchemaItemDifference<T> {
  modifier?: string;
  baseClass?: {
    readonly schemaChangeType: DifferenceType;
    readonly className: string;
  };
  properties?: {
    [name: string]: PropertyDifference;
  };
}

/**
 * @internal
 */
export interface EntityClassDifference extends ClassDifference<EntityClass> {
  mixins?: string[];
}

/**
 * @internal
 */
export interface MixinDifference extends ClassDifference<Mixin> {
  appliesTo?: string;
}

/**
 * @internal
 */
export type StructClassDifference = ClassDifference<StructClass>;

/**
 * @internal
 */
export interface CustomAttributeClassDifference extends ClassDifference<CustomAttributeClass> {
  appliesTo?: string;
}

/**
 * @internal
 */
export interface RelationshipClassDifference extends ClassDifference<RelationshipClass> {
  strength?: string;
  strengthDirection?: string;
  source?: RelationshipConstraintDifference;
  target?: RelationshipConstraintDifference;
}

/**
 * @internal
 */
export interface RelationshipConstraintDifference extends DifferenceObject<RelationshipConstraint> {
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
export interface PropertyDifference<T extends Property=Property> extends DifferenceObject<T> {
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
export interface PrimitivePropertyDifference<T extends Property=PrimitiveProperty> extends PropertyDifference<T> {
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
export type EnumerationPropertyDifference = PrimitivePropertyDifference<EnumerationProperty>;

/**
 * @internal
 */
export interface NavigationPropertyDifference extends PrimitivePropertyDifference<NavigationProperty> {
  relationshipName?: string;
  direction?: string;
}

/**
 * @internal
 */
export interface StructPropertyDifference extends PropertyDifference<StructProperty> {
  typeName?: string;
}

/**
 * @internal
 */
export interface ArrayPropertyDifference<T extends Property=Property> extends PrimitivePropertyDifference<T> {
  typeName?: string;
  minOccurs?: number;
  maxOccurs?: number;
}

/**
 * @internal
 */
export type PrimitiveArrayPropertyDifference = ArrayPropertyDifference<PrimitiveProperty>;

/**
 * @internal
 */
export type StructArrayPropertyDifference = ArrayPropertyDifference<StructProperty>;
