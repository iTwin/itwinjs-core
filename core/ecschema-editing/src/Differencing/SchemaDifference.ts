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
  AnyEnumerator, AnyPropertyProps, AnySchemaItemProps, Constant, CustomAttribute, CustomAttributeClass, EntityClass, Enumeration, KindOfQuantity, Mixin, Phenomenon, PropertyCategory, RelationshipClass, RelationshipConstraintProps, Schema,
  SchemaItem,
  SchemaItemProps,
  SchemaReferenceProps,
  StructClass,
  UnitSystem,
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
  Unit = "Unit",
  InvertedUnit = "InvertedUnit",
  Constant = "Constant",
  Phenomenon = "Phenomenon",
  UnitSystem = "UnitSystem",
  Format = "Format",
}

/**
 * Defines the possible values SchemaTypes that can occur in SchemaDifferences or Conflicts.
 * @internal
 */
export type SchemaType = "Schema" | SchemaItemTypeName | "Property" | "RelationshipConstraint";

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

type MutualPartial<T> = {
  -readonly [P in keyof T]?: T[P];
};
type Editable<T> = {
  -readonly [P in keyof T]: T[P];
};

type SchemaItemProperties<T extends SchemaItemProps> =
  Editable<Omit<T, keyof Omit<SchemaItemProps, "label" | "description">>>;

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
  SchemaDifference |
  SchemaItemDifference |
  SchemaPropertyDifference |
  SchemaReferenceDifference |
  SchemaEnumeratorDifference |
  SchemaClassMixinDifference |
  SchemaRelationshipConstraintDifference |
  SchemaRelationshipConstraintClassDifference |
  SchemaCustomAttributeDifference;

/**
 * @internal
 */
export interface SchemaDifference {
  readonly changeType: "modify";
  readonly schemaType: "Schema";
  readonly itemName?: never;
  readonly path?: string;
  readonly json: {
    label?: string;
    description?: string;
  };
}

/**
 * @internal
 */
export interface SchemaItemDifference<T extends AnySchemaItemProps = AnySchemaItemProps> {
  readonly changeType: "add" | "modify" | "remove";
  readonly schemaType: SchemaItemTypeName;
  readonly itemName: string;
  readonly path?: string;
  readonly json: MutualPartial<T>;
}

export type AnySchemaItemDifference =
  ClassItemDifference |
  ClassPropertyDifference |
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

export type ClassItemDifference =
  CustomAttributeClassDifference |
  EntityClassDifference |
  MixinClassDifference |
  RelationshipClassDifference |
  StructClassDifference;

export interface SchemaItemBase<T extends SchemaItem> {
  readonly itemName: string;
  readonly json: SchemaItemProperties<ReturnType<T["toJSON"]>>;
}

export interface ClassPropertyDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: "Property";
  readonly itemName: string;
  readonly path: string;
  readonly json: Editable<AnyPropertyProps>;
}

export interface ConstantsDifference extends SchemaItemBase<Constant> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.Constant;
}

export interface CustomAttributeClassDifference extends SchemaItemBase<CustomAttributeClass> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.CustomAttributeClass;
}

export interface EntityClassDifference extends SchemaItemBase<EntityClass> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.EntityClass;
}

export interface EntityClassMixinDifference {
  readonly changeType: "modify";
  readonly schemaType: SchemaItemTypeName.EntityClass;
  readonly itemName: string;
  readonly path: "$mixins";
  readonly json: string[];
}

export interface EnumerationDifference extends SchemaItemBase<Enumeration> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.Enumeration;
}

export interface EnumeratorDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.Enumeration;
  readonly itemName: string;
  readonly path: "$enumerators";
  readonly json: Editable<AnyEnumerator>;
}

export interface KindOfQuantityDifference extends SchemaItemBase<KindOfQuantity> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.KindOfQuantity;
}

export interface MixinClassDifference extends SchemaItemBase<Mixin> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.Mixin;
}

export interface PhenomenonDifference extends SchemaItemBase<Phenomenon> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.Phenomenon;
}

export interface PropertyCategoryDifference extends SchemaItemBase<PropertyCategory> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.PropertyCategory;
}

export interface RelationshipClassDifference extends SchemaItemBase<RelationshipClass> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.RelationshipClass;
}

export interface RelationshipConstraintDifference {
  readonly changeType: "modify";
  readonly schemaType: SchemaItemTypeName.RelationshipClass;
  readonly itemName: string;
  readonly path: "$source" | "$target";
  readonly json: Editable<Omit<RelationshipConstraintProps, "constraintClasses">>;
}

export interface RelationshipConstraintClassDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaItemTypeName.RelationshipClass;
  readonly itemName: string;
  readonly path: "$source.constraintClasses" | "$target.constraintClasses";
  readonly json: string[];
}

export interface StructClassDifference extends SchemaItemBase<StructClass> {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaItemTypeName.StructClass;
}

export interface UnitSystemDifference extends SchemaItemBase<UnitSystem> {
  readonly changeType: "add";
  readonly schemaType: SchemaItemTypeName.UnitSystem;
}

/**
 * @internal
 */
export interface SchemaPropertyDifference<T extends AnyPropertyProps = AnyPropertyProps> {
  readonly changeType: "add" | "modify" | "remove";
  readonly schemaType: "Property";
  readonly itemName: string;
  readonly path: string;
  readonly json: MutualPartial<T>;
}

/**
 * @internal
 */
export interface SchemaReferenceDifference {
  readonly changeType: "add" | "modify" | "remove";
  readonly schemaType: "Schema";
  readonly itemName?: undefined;
  readonly path: "$references";
  readonly json: MutualPartial<SchemaReferenceProps>;
}

/**
 * @internal
 */
export interface SchemaEnumeratorDifference {
  readonly changeType: "add" | "modify" | "remove";
  readonly schemaType: "Enumeration";
  readonly itemName: string;
  readonly path: string;
  readonly json: MutualPartial<AnyEnumerator>;
}

/**
 * @internal
 */
export interface SchemaClassMixinDifference {
  readonly changeType: "modify";
  readonly schemaType: "EntityClass";
  readonly itemName: string;
  readonly path: "$mixins";
  readonly json: string[];
}

/**
 * @internal
 */
export interface SchemaRelationshipConstraintDifference {
  readonly changeType: "modify";
  readonly schemaType: "RelationshipClass";
  readonly itemName: string;
  readonly path: "$source" | "$target";
  readonly json: MutualPartial<RelationshipConstraintProps>;
}

/**
 * @internal
 */
export interface SchemaRelationshipConstraintClassDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: "RelationshipClass";
  readonly itemName: string;
  readonly path: "$source.constraintClasses" | "$target.constraintClasses";
  readonly json: string[];
}

/**
 * @internal
 */
export interface SchemaCustomAttributeDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: "Schema" | "EntityClass" | "Properties" | "RelationshipConstraint";
  readonly itemName?: string;
  readonly path?: string;
  readonly json: CustomAttribute;
}
