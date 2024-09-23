/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { SchemaDifferenceConflict } from "./SchemaConflicts";
import { SchemaDiagnosticVisitor } from "./SchemaDiagnosticVisitor";
import { SchemaChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";
import {
  AnyEnumerator, AnyPropertyProps, ConstantProps, CustomAttribute,
  CustomAttributeClassProps, EntityClassProps, EnumerationProps, InvertedUnitProps, KindOfQuantityProps,
  MixinProps, PhenomenonProps, PropertyCategoryProps, RelationshipClassProps, RelationshipConstraintProps,
  type Schema, SchemaItemFormatProps, SchemaItemProps, SchemaItemType, SchemaItemUnitProps, SchemaReferenceProps, StructClassProps, UnitSystemProps,
} from "@itwin/ecschema-metadata";
import { validateDifferences } from "./SchemaDifferenceValidator";

/** Utility-Type to remove possible readonly flags on the given type. */
type PartialEditable<T> = {
  -readonly [P in keyof T]?: T[P];
};

/**
 * Utility-Type to simplify the expected SchemaItem props by omitting the base properties
 * that are not needed for the schema differencing. Also all properties are made mutable
 * by removing the readonly flag if present.
 */
type SchemaItemProperties<T extends SchemaItemProps> = {
  [P in keyof PartialEditable<Omit<T, keyof Omit<SchemaItemProps, "label" | "description" | "customAttributes">>>]: T[P]
};

/**
 * Defines the type of the difference operation.
 * @alpha
 */
export type DifferenceType = "add" | "modify";

/**
 * Defines the SchemaTypes that are not SchemaItems.
 * @alpha
 */
export enum SchemaOtherTypes {
  Schema = "Schema",
  SchemaReference = "SchemaReference",
  Property = "Property",
  Enumerator = "Enumerator",
  CustomAttributeInstance = "CustomAttributeInstance",
  RelationshipConstraint = "RelationshipConstraint",
  RelationshipConstraintClass = "RelationshipConstraintClass",
  EntityClassMixin = "EntityClassMixin",
}

/**
 * Defines the possible values SchemaTypes that can occur in SchemaDifferences or Conflicts.
 * @alpha
 */
export type SchemaType = SchemaOtherTypes | SchemaItemType;

/**
 * Definition of the difference result between two Schemas.
 * @alpha
 */
export interface SchemaDifferenceResult {
  /** Full name of the source schema */
  readonly sourceSchemaName: string;
  /** Full name of the target schema */
  readonly targetSchemaName: string;

  /** List of differences between the compared schemas. */
  readonly differences: AnySchemaDifference[];

  /** List of conflicts found while comparing the schemas. */
  readonly conflicts?: SchemaDifferenceConflict[];
}

/**
 * Union of all supported schema differencing types.
 * @alpha
 */
export type AnySchemaDifference =
  SchemaDifference |
  SchemaReferenceDifference |
  AnySchemaItemDifference |
  AnySchemaItemPathDifference |
  CustomAttributeDifference;

/**
 * Differencing entry for changes on a Schema.
 * @alpha
 */
export interface SchemaDifference {
  readonly changeType: "modify";
  readonly schemaType: SchemaOtherTypes.Schema;
  readonly difference: {
    label?: string;
    description?: string;
  };
}

/**
 * Differencing entry for added or changed Schema References of a Schema.
 * @alpha
 */
export interface SchemaReferenceDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaOtherTypes.SchemaReference;
  readonly difference: SchemaReferenceProps;
}

/**
 * Union of all supported schema item differencing types.
 * @alpha
 */
export type AnySchemaItemDifference =
  AnyClassItemDifference |
  ConstantDifference |
  EnumerationDifference |
  EntityClassMixinDifference |
  FormatDifference |
  KindOfQuantityDifference |
  InvertedUnitDifference |
  PhenomenonDifference |
  PropertyCategoryDifference |
  UnitDifference |
  UnitSystemDifference;

/**
 * Union for supported class Schema Items.
 * @alpha
 */
export type AnyClassItemDifference =
  EntityClassDifference |
  MixinClassDifference |
  StructClassDifference |
  CustomAttributeClassDifference |
  RelationshipClassDifference;

/**
 * Union of all differences that have a path pointing inside a schema item.
 * @alpha
 */
export type AnySchemaItemPathDifference =
  RelationshipConstraintDifference |
  RelationshipConstraintClassDifference |
  CustomAttributePropertyDifference |
  EnumeratorDifference |
  ClassPropertyDifference;

/**
 * Internal base class for all Schema Item differencing entries.
 * @alpha
 */
interface SchemaItemDifference<T extends SchemaItemProps> {
  readonly changeType: "add" | "modify";
  readonly itemName: string;
  readonly difference: SchemaItemProperties<T>;
}

/**
 * Differencing entry for Constant Schema Items.
 * @alpha
 */
export interface ConstantDifference extends SchemaItemDifference<ConstantProps> {
  readonly schemaType: SchemaItemType.Constant;
}

/**
 * Differencing entry for Custom Attribute Class Schema Items.
 * @alpha
 */
export interface CustomAttributeClassDifference extends SchemaItemDifference<CustomAttributeClassProps> {
  readonly schemaType: SchemaItemType.CustomAttributeClass;
}

/**
 * Differencing entry for Entity Class Schema Items.
 * @alpha
 */
export interface EntityClassDifference extends SchemaItemDifference<EntityClassProps> {
  readonly schemaType: SchemaItemType.EntityClass;
}

/**
 * Differencing entry for Enumerator Schema Items.
 * @alpha
 */
export interface EnumerationDifference extends SchemaItemDifference<EnumerationProps> {
  readonly schemaType: SchemaItemType.Enumeration;
}

/**
 * Differencing entry for Kind-Of-Quantities Schema Items.
 * @alpha
 */
export interface KindOfQuantityDifference extends SchemaItemDifference<KindOfQuantityProps> {
  readonly schemaType: SchemaItemType.KindOfQuantity;
}

/**
 * Differencing entry for Mixin Class Schema Items.
 * @alpha
 */
export interface MixinClassDifference extends SchemaItemDifference<MixinProps> {
  readonly schemaType: SchemaItemType.Mixin;
}

/**
 * Differencing entry for Phenomenon Schema Items.
 * @alpha
 */
export interface PhenomenonDifference extends SchemaItemDifference<PhenomenonProps> {
  readonly schemaType: SchemaItemType.Phenomenon;
}

/**
 * Differencing entry for Property Category Schema Items.
 * @alpha
 */
export interface PropertyCategoryDifference extends SchemaItemDifference<PropertyCategoryProps> {
  readonly schemaType: SchemaItemType.PropertyCategory;
}

/**
 * Differencing entry for Relationship Class Schema Items.
 * @alpha
 */
export interface RelationshipClassDifference extends SchemaItemDifference<RelationshipClassProps> {
  readonly schemaType: SchemaItemType.RelationshipClass;
}

/**
 * Differencing entry for Struct Class Schema Items.
 * @alpha
 */
export interface StructClassDifference extends SchemaItemDifference<StructClassProps> {
  readonly schemaType: SchemaItemType.StructClass;
}

/**
 * Differencing entry for Unit System Schema Items.
 * @alpha
 */
export interface UnitSystemDifference extends SchemaItemDifference<UnitSystemProps> {
  readonly schemaType: SchemaItemType.UnitSystem;
}

/**
 * Differencing entry for Unit Schema Items.
 * @alpha
 */
export interface UnitDifference extends SchemaItemDifference<SchemaItemUnitProps> {
  readonly schemaType: SchemaItemType.Unit;
}

/**
 * Differencing entry for Inverted Unit Schema Items.
 * @alpha
 */
export interface InvertedUnitDifference extends SchemaItemDifference<InvertedUnitProps> {
  readonly schemaType: SchemaItemType.InvertedUnit;
}
/**
 * Differencing entry for Format Schema Items.
 * @alpha
 */
export interface FormatDifference extends SchemaItemDifference<SchemaItemFormatProps> {
  readonly schemaType: SchemaItemType.Format;
}

/**
 * Differencing entry for added or changed Properties.
 * @alpha
 */
export interface ClassPropertyDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaOtherTypes.Property;
  readonly itemName: string;
  readonly path: string;
  readonly difference: PartialEditable<AnyPropertyProps>;
}

/**
 * Union of supported Custom Attribute Differences.
 * @alpha
 */
export type CustomAttributeDifference =
  CustomAttributeSchemaDifference |
  CustomAttributeSchemaItemDifference |
  CustomAttributePropertyDifference |
  CustomAttributeRelationshipConstraintDifference;

/**
 * Differencing entry for Custom Attributes on Schema.
 * @alpha
 */
export interface CustomAttributeSchemaDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaOtherTypes.CustomAttributeInstance;
  readonly appliedTo: "Schema";
  readonly difference: PartialEditable<CustomAttribute>;
}

/**
 * Differencing entry for Custom Attributes on Schema Items.
 * @alpha
 */
export interface CustomAttributeSchemaItemDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaOtherTypes.CustomAttributeInstance;
  readonly appliedTo: "SchemaItem";
  readonly itemName: string;
  readonly difference: PartialEditable<CustomAttribute>;
}

/**
 * Differencing entry for Custom Attributes on Properties.
 * @alpha
 */
export interface CustomAttributePropertyDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaOtherTypes.CustomAttributeInstance;
  readonly appliedTo: "Property";
  readonly itemName: string;
  readonly path: string;
  readonly difference: PartialEditable<CustomAttribute>;
}

/**
 * Differencing entry for Custom Attributes on Relationship Constraints.
 * @alpha
 */
export interface CustomAttributeRelationshipConstraintDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaOtherTypes.CustomAttributeInstance;
  readonly appliedTo: "RelationshipConstraint";
  readonly itemName: string;
  readonly path: "$source" | "$target";
  readonly difference: PartialEditable<CustomAttribute>;
}

/**
 * Differencing entry for changed mixins on EntityClasses.
 * @alpha
 */
export interface EntityClassMixinDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaOtherTypes.EntityClassMixin;
  readonly itemName: string;
  readonly difference: string[];
}

/**
 * Differencing entry for changed Enumerators on Enumerable Schema Items.
 * @alpha
 */
export interface EnumeratorDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaOtherTypes.Enumerator;
  readonly itemName: string;
  readonly path: string;
  readonly difference: PartialEditable<AnyEnumerator>;
}

/**
 * Differencing entry for Relationship Constraints.
 * @alpha
 */
export interface RelationshipConstraintDifference {
  readonly changeType: "modify";
  readonly schemaType: SchemaOtherTypes.RelationshipConstraint;
  readonly itemName: string;
  readonly path: "$source" | "$target";
  readonly difference: PartialEditable<Omit<RelationshipConstraintProps, "constraintClasses">>;
}

/**
 * Differencing entry for constraint classes added to Relationship Constrains.
 * @alpha
 */
export interface RelationshipConstraintClassDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaOtherTypes.RelationshipConstraintClass;
  readonly itemName: string;
  readonly path: "$source" | "$target";
  readonly difference: string[];
}

/**
 * Creates a [[SchemaDifferenceResult]] for two given schemas.
 * @param targetSchema  The schema the differences gets merged into.
 * @param sourceSchema  The schema to get merged in the target.
 * @returns             An [[SchemaDifferenceResult]] object.
 * @alpha
 */
export async function getSchemaDifferences(targetSchema: Schema, sourceSchema: Schema): Promise<SchemaDifferenceResult> {
  const changesList: SchemaChanges[] = [];
  const schemaComparer = new SchemaComparer({ report: changesList.push.bind(changesList) });
  await schemaComparer.compareSchemas(sourceSchema, targetSchema);

  const visitor = new SchemaDiagnosticVisitor();
  for (const diagnostic of changesList[0].allDiagnostics) {
    visitor.visit(diagnostic);
  }

  const differences: AnySchemaDifference[] = [
    ...visitor.schemaDifferences,
    ...visitor.schemaItemDifferences,
    ...visitor.schemaItemPathDifferences,
    ...visitor.customAttributeDifferences,
  ];

  const conflicts = await validateDifferences(differences, targetSchema, sourceSchema);

  return {
    sourceSchemaName: sourceSchema.schemaKey.toString(),
    targetSchemaName: targetSchema.schemaKey.toString(),
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    differences,
  };
}
