/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { SchemaChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";
import { SchemaDifferenceConflict } from "./SchemaConflicts";
import { SchemaDiagnosticVisitor } from "./SchemaDiagnosticVisitor";
import type {
  AnyEnumerator, AnyPropertyProps, Constant, CustomAttribute, CustomAttributeClass, EntityClass, Enumeration, KindOfQuantity,
  Mixin, Phenomenon, PropertyCategory, RelationshipClass, RelationshipConstraintProps, Schema,
  SchemaItem, SchemaItemProps, SchemaItemType, SchemaReferenceProps, StructClass, UnitSystem,
} from "@itwin/ecschema-metadata";

/**
 * Defines the type of the difference operation.
 * @internal
 */
export type DifferenceType = "add" | "modify";

/**
 * Defines a set of SchemaItem names.
 * @internal
 */
export enum SchemaItemTypeName {
  EntityClass = "EntityClass",
  Mixin = "Mixin",
  StructClass = "StructClass",
  CustomAttributeClass = "CustomAttributeClass",
  RelationshipClass = "RelationshipClass",
  Enumeration = "Enumeration",
  KindOfQuantity = "KindOfQuantity",
  PropertyCategory = "PropertyCategory",
  // Unit = "Unit",
  // InvertedUnit = "InvertedUnit",
  Constant = "Constant",
  Phenomenon = "Phenomenon",
  UnitSystem = "UnitSystem",
  // Format = "Format",
}

/**
 * Defines the possible values SchemaTypes that can occur in SchemaDifferences or Conflicts.
 * @internal
 */
export type SchemaType = AnySchemaDifference extends { schemaType: infer R extends string } ? R : never;

/**
 * @internal
 */
export namespace SchemaDifference {
  /**
   * Creates a [[SchemaDifference]] for two given schemas.
   * @param targetSchema  The schema the differences gets merged into.
   * @param sourceSchema  The schema to get merged in the target.
   * @returns             An [[SchemaDifference]] object.
   * @internal
   */
  export async function fromSchemas(targetSchema: Schema, sourceSchema: Schema): Promise<SchemaDifferences> {
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
   * @internal
   */
  export async function fromSchemaChanges(targetSchema: Schema, schemaChanges: SchemaChanges): Promise<SchemaDifferences> {
    const changes: AnySchemaDifference[] = [];
    const conflicts: SchemaDifferenceConflict[] = [];

    const visitor = new SchemaDiagnosticVisitor(changes, conflicts);
    for(const diagnostic of schemaChanges.allDiagnostics) {
      visitor.visit(diagnostic);
    }

    return {
      sourceSchemaName: schemaChanges.schema.schemaKey.toString(),
      targetSchemaName: targetSchema.schemaKey.toString(),
      changes: changes.length > 0 ? changes : undefined,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }
}

type Editable<T> = {
  -readonly [P in keyof T]: T[P];
};

type ExtractTypeName<T extends SchemaItemType> =
  { [K in keyof typeof SchemaItemType as typeof SchemaItemType[K]]: K }[T];

type SchemaItemProperties<T extends SchemaItemProps> = {
  [P in keyof Editable<Omit<T, keyof Omit<SchemaItemProps, "label" | "description" | "customAttributes">>>]: T[P]
};

type GroupByDifferenceType<T extends  { changeType: DifferenceType, difference: unknown }> =
  T extends { changeType: infer R extends DifferenceType }
    ? R extends "modify"
      ? Omit<T, "difference"> & { difference: Partial<T["difference"]> }
      : T
    : never;

/**
 * @internal
 */
export interface SchemaDifferences {

  readonly sourceSchemaName: string;
  readonly targetSchemaName: string;

  readonly changes?: AnySchemaDifference[];
  readonly conflicts?: SchemaDifferenceConflict[];
}

/**
 * @internal
 */
export type AnySchemaDifference =
GroupByDifferenceType<
SchemaDifference |
SchemaReferenceDifference |
AnySchemaItemDifference |
ClassPropertyDifference |
CustomAttributeDifference>;

/**
 * @internal
 */
export interface SchemaDifference {
  readonly changeType: "modify";
  readonly schemaType: "Schema";
  readonly difference: {
    label?: string;
    description?: string;
  };
}

/**
 * @internal
 */
export interface SchemaReferenceDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: "Schema";
  readonly path:       "$references";
  readonly difference: SchemaReferenceProps;
}

/**
 * @internal
 */
export type AnySchemaItemDifference =
  ClassItemDifference |
  ConstantsDifference |
  EnumerationDifference |
  EnumeratorDifference |
  EntityClassMixinDifference |
  KindOfQuantityDifference |
  PhenomenonDifference |
  PropertyCategoryDifference |
  RelationshipConstraintDifference |
  RelationshipConstraintClassDifference |
  UnitSystemDifference;

/**
 * @internal
 */
export type ClassItemDifference =
  CustomAttributeClassDifference |
  EntityClassDifference |
  MixinClassDifference |
  RelationshipClassDifference |
  StructClassDifference;

/**
 * @internal
 */
interface SchemaItemDifference<T extends SchemaItem> {
  readonly itemName: string;
  readonly difference: SchemaItemProperties<ReturnType<T["toJSON"]>>;
  readonly schemaType: ExtractTypeName<T["schemaItemType"]>;
}

/**
 * @internal
 */
export interface ClassPropertyDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: "Property";
  readonly itemName: string;
  readonly path: string;
  readonly difference: Editable<AnyPropertyProps>;
}

/**
 * @internal
 */
export interface ConstantsDifference extends SchemaItemDifference<Constant> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export interface CustomAttributeClassDifference extends SchemaItemDifference<CustomAttributeClass> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export type CustomAttributeDifference =
  CustomAttributeSchemaDifference |
  CustomAttributeSchemaItemDifference |
  CustomAttributePropertyDifference |
  CustomAttributeRelationshipConstraintDifference;

/**
 * @internal
 */
export interface CustomAttributeSchemaDifference {
  readonly changeType: "add";
  readonly schemaType: "CustomAttribute";
  readonly appliesTo: "Schema";
  readonly difference: Editable<CustomAttribute>;
}

/**
 * @internal
 */
export interface CustomAttributeSchemaItemDifference {
  readonly changeType: "add";
  readonly schemaType: "CustomAttribute";
  readonly appliesTo: "SchemaItem";
  readonly itemName: string;
  readonly difference: Editable<CustomAttribute>;
}

/**
 * @internal
 */
export interface CustomAttributePropertyDifference {
  readonly changeType: "add";
  readonly schemaType: "CustomAttribute";
  readonly appliesTo: "Property";
  readonly itemName: string;
  readonly path: string;
  readonly difference: Editable<CustomAttribute>;
}

/**
 * @internal
 */
export interface CustomAttributeRelationshipConstraintDifference {
  readonly changeType: "add";
  readonly schemaType: "CustomAttribute";
  readonly appliesTo: "RelationshipConstraint";
  readonly itemName: string;
  readonly path: "$source" | "$target";
  readonly difference: Editable<CustomAttribute>;
}

/**
 * @internal
 */
export interface EntityClassDifference extends SchemaItemDifference<EntityClass> {
  readonly changeType: "add" | "modify";
  readonly schemaType: "EntityClass";
}

/**
 * @internal
 */
export interface EntityClassMixinDifference {
  readonly changeType: "modify";
  readonly schemaType: SchemaItemTypeName.EntityClass;
  readonly itemName: string;
  readonly path: "$mixins";
  readonly difference: string[];
}

/**
 * @internal
 */
export interface EnumerationDifference extends SchemaItemDifference<Enumeration> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export interface EnumeratorDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: "Enumeration";
  readonly itemName: string;
  readonly path: string;
  readonly difference: Editable<AnyEnumerator>;
}

/**
 * @internal
 */
export interface KindOfQuantityDifference extends SchemaItemDifference<KindOfQuantity> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export interface MixinClassDifference extends SchemaItemDifference<Mixin> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export interface PhenomenonDifference extends SchemaItemDifference<Phenomenon> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export interface PropertyCategoryDifference extends SchemaItemDifference<PropertyCategory> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export interface RelationshipClassDifference extends SchemaItemDifference<RelationshipClass> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export interface RelationshipConstraintDifference {
  readonly changeType: "modify";
  readonly schemaType: "RelationshipClass";
  readonly itemName: string;
  readonly path: "$source" | "$target";
  readonly difference: Editable<Omit<RelationshipConstraintProps, "constraintClasses">>;
}

/**
 * @internal
 */
export interface RelationshipConstraintClassDifference {
  readonly changeType: "add";
  readonly schemaType: "RelationshipClass";
  readonly itemName: string;
  readonly path: "$source.constraintClasses" | "$target.constraintClasses";
  readonly difference: string[];
}

/**
 * @internal
 */
export interface StructClassDifference extends SchemaItemDifference<StructClass> {
  readonly changeType: "add" | "modify";
}

/**
 * @internal
 */
export interface UnitSystemDifference extends SchemaItemDifference<UnitSystem> {
  readonly changeType: "add" | "modify";
}
