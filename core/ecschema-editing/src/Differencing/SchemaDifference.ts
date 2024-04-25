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
import {
  AnyEnumerator, AnyPropertyProps, ConstantProps, CustomAttribute,
  CustomAttributeClassProps, EntityClassProps, EnumerationProps, InvertedUnitProps, KindOfQuantityProps,
  MixinProps, PhenomenonProps, PropertyCategoryProps, RelationshipClassProps, RelationshipConstraintProps,
  type Schema, SchemaItemFormatProps, SchemaItemProps, SchemaItemType, SchemaItemUnitProps, SchemaReferenceProps, StructClassProps, UnitSystemProps,
} from "@itwin/ecschema-metadata";

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
 * @alpha
 */
export namespace SchemaDifference {
  /**
   * Creates a [[SchemaDifference]] for two given schemas.
   * @param targetSchema  The schema the differences gets merged into.
   * @param sourceSchema  The schema to get merged in the target.
   * @returns             An [[SchemaDifference]] object.
   * @alpha
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
    const visitor = new SchemaDiagnosticVisitor();
    for (const diagnostic of schemaChanges.allDiagnostics) {
      visitor.visit(diagnostic);
    }

    const changes: AnySchemaDifference[] = [
      ...visitor.schemaChanges,
      ...visitor.schemaItemChanges,
      ...visitor.schemaItemPathChanges,
      ...visitor.customAttributeChanges,
    ];

    return {
      sourceSchemaName: schemaChanges.schema.schemaKey.toString(),
      targetSchemaName: targetSchema.schemaKey.toString(),
      conflicts: visitor.conflicts.length > 0 ? visitor.conflicts : undefined,
      changes,
    };
  }

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
}

/**
 * Definition of the differences between two Schemas.
 * @alpha
 */
export interface SchemaDifferences {
  /** Full name of the source schema */
  readonly sourceSchemaName: string;
  /** Full name of the target schema */
  readonly targetSchemaName: string;

  /** List of differences between the compared schemas. */
  readonly changes: AnySchemaDifference[];

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
  ClassItemDifference |
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
 * @internal
 */
export type ClassItemDifference =
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
