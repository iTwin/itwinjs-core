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

/** Utility-Type to remove possible readonly flags on the given type. */
type Editable<T> = {
  -readonly [P in keyof T]?: T[P];
};

/**
 * Utility-Type to simplify the expected SchemaItem props by omitting the base properties
 * that are not needed for the schema differencing. Also all properties are made mutable
 * by removing the readonly flag if present.
 */
type SchemaItemProperties<T extends SchemaItemProps> = {
  [P in keyof Editable<Omit<T, keyof Omit<SchemaItemProps, "label" | "description" | "customAttributes">>>]: T[P]
};

/**
 * Make the difference of a SchemaDifference partial. Because of circular references, the
 * SchemaDifferences can't be used directly as constraint type.
 */
type PartialDifference<T extends { difference: unknown }> = Omit<T, "difference"> & {
  difference: Partial<T["difference"]>;
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
  Property = "Property",
  Enumerator = "Enumerator",
  CustomAttributeInstance = "CustomAttributeInstance",
  RelationshipConstraint = "RelationshipConstraint",
  RelationshipConstraintClass = "RelationshipConstraintClass",
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
      ...visitor.schemaPathChanges,
      ...visitor.schemaItemChanges,
      ...visitor.schemaItemPathChanges,
      ...visitor.customAttributeChanges,
    ];

    return {
      sourceSchemaName: schemaChanges.schema.schemaKey.toString(),
      targetSchemaName: targetSchema.schemaKey.toString(),
      changes: changes.length > 0 ? changes : undefined,
      conflicts: visitor.conflicts.length > 0 ? visitor.conflicts : undefined,
    };
  }

  interface SchemaDifferenceLike {
    readonly schemaType: SchemaType;
    readonly changeType: DifferenceType;
    readonly itemName?: string;
    readonly path?: string;
  }

  /**
   * Indicates whether the given difference is type of ConstantsDifference.
   * @alpha
   */
  export function isConstantDifference(difference: SchemaDifferenceLike): difference is ConstantsDifference {
    return difference.schemaType === "Constant";
  }

  /**
   * Indicates whether the given difference is type of ClassPropertyDifference.
   * @alpha
   */
  export function isClassPropertyDifference(difference: SchemaDifferenceLike): difference is ClassPropertyDifference {
    return difference.schemaType === "Property";
  }

  /**
   * Indicates whether the given difference is type of CustomAttributeClassDifference.
   * @alpha
   */
  export function isCustomAttributeClassDifference(difference: SchemaDifferenceLike): difference is CustomAttributeClassDifference {
    return difference.schemaType === "CustomAttributeClass";
  }

  /**
   * Indicates whether the given difference is type of CustomAttributeDifference.
   * @alpha
   */
  export function isCustomAttributeDifference(difference: SchemaDifferenceLike): difference is CustomAttributeDifference {
    return difference.schemaType === SchemaOtherTypes.CustomAttributeInstance;
  }

  /**
   * Indicates whether the given difference is type of EntityClassDifference.
   * @alpha
   */
  export function isEntityClassDifference(difference: SchemaDifferenceLike): difference is EntityClassDifference {
    return difference.schemaType === "EntityClass" && difference.path === undefined;
  }

  /**
   * Indicates whether the given difference is type of EntityClassMixinDifference.
   * @alpha
   */
  export function isEntityClassMixinDifference(difference: SchemaDifferenceLike): difference is EntityClassMixinDifference {
    return difference.schemaType === "EntityClass" && difference.path === "$mixins";
  }

  /**
   * Indicates whether the given difference is type of EnumerationDifference.
   * @alpha
   */
  export function isEnumerationDifference(difference: SchemaDifferenceLike): difference is EnumerationDifference {
    return difference.schemaType === "Enumeration" && !isEnumeratorDifference(difference);
  }

  /**
   * Indicates whether the given difference is type of EnumeratorDifference.
   * @alpha
   */
  export function isEnumeratorDifference(difference: SchemaDifferenceLike): difference is EnumeratorDifference {
    return difference.schemaType === "Enumeration" && difference.path?.startsWith("$enumerators") || false;
  }

  /**
   * Indicates whether the given difference is type of KindOfQuantityDifference.
   * @alpha
   */
  export function isKindOfQuantityDifference(difference: SchemaDifferenceLike): difference is KindOfQuantityDifference {
    return difference.schemaType === "KindOfQuantity";
  }

  /**
   * Indicates whether the given difference is type of MixinClassDifference.
   * @alpha
   */
  export function isMixinClassDifference(difference: SchemaDifferenceLike): difference is MixinClassDifference {
    return difference.schemaType === "Mixin";
  }

  /**
   * Indicates whether the given difference is type of PhenomenonDifference.
   * @alpha
   */
  export function isPhenomenonDifference(difference: SchemaDifferenceLike): difference is PhenomenonDifference {
    return difference.schemaType === "Phenomenon";
  }

  /**
   * Indicates whether the given difference is type of PropertyCategoryDifference.
   * @alpha
   */
  export function isPropertyCategoryDifference(difference: SchemaDifferenceLike): difference is PropertyCategoryDifference {
    return difference.schemaType === "PropertyCategory";
  }

  /**
   * Indicates whether the given difference is type of SchemaDifference.
   * @alpha
   */
  export function isSchemaDifference(difference: SchemaDifferenceLike): difference is SchemaDifference {
    return difference.schemaType === "Schema" && difference.path === undefined;
  }

  /**
   * Indicates whether the given difference is type of SchemaReferenceDifference.
   * @alpha
   */
  export function isSchemaReferenceDifference(difference: SchemaDifferenceLike): difference is SchemaReferenceDifference {
    return difference.schemaType === "Schema" && "path" in difference && difference.path === "$references";
  }

  /**
   * Indicates whether the given difference is type of CustomAttributeDifference.
   * @alpha
   */
  export function isStructClassDifference(difference: SchemaDifferenceLike): difference is StructClassDifference {
    return difference.schemaType === "StructClass";
  }

  /**
   * Indicates whether the given difference is type of UnitSystemDifference.
   * @alpha
   */
  export function isUnitSystemDifference(difference: SchemaDifferenceLike): difference is UnitSystemDifference {
    return difference.schemaType === "UnitSystem";
  }

  /**
   * Indicates whether the given difference is type of RelationshipClassDifference.
   * @alpha
   */
  export function isRelationshipClassDifference(difference: SchemaDifferenceLike): difference is RelationshipClassDifference {
    return difference.schemaType === "RelationshipClass" && difference.path === undefined;
  }

  /**
   * Indicates whether the given difference is type of RelationshipConstraintDifference.
   * @alpha
   */
  export function isRelationshipConstraintDifference(difference: SchemaDifferenceLike): difference is RelationshipConstraintDifference {
    return difference.schemaType === "RelationshipClass" && (difference.path === "$source" || difference.path === "$target");
  }

  /**
   * Indicates whether the given difference is type of RelationshipConstraintClassDifference.
   * @alpha
   */
  export function isRelationshipConstraintClassDifference(difference: SchemaDifferenceLike): difference is RelationshipConstraintClassDifference {
    return difference.schemaType === "RelationshipClass" && (difference.path === "$source.constraintClasses" || difference.path === "$target.constraintClasses");
  }

  /**
   * Indicates whether the given difference is has a path.
   * @alpha
   */
  export function isPathDifference(difference: SchemaDifferenceLike): boolean {
    return difference.path !== undefined;
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
  readonly changes?: AnySchemaDifference[];
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
  ClassPropertyDifference |
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
  readonly schemaType: SchemaOtherTypes.Schema;
  readonly path: "$references";
  readonly difference: SchemaReferenceProps;
}

/**
 * Union of all supported schema item differencing types.
 * @alpha
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
 * Union for supported class Schema Items.
 * @internal
 */
export type ClassItemDifference =
  CustomAttributeClassDifference |
  EntityClassDifference |
  MixinClassDifference |
  RelationshipClassDifference |
  StructClassDifference;

/**
 * Internal base class for all Schema Item differencing entries.
 * @alpha
 */
interface SchemaItemDifference<T extends SchemaItem> {
  readonly changeType: "add" | "modify";
  readonly itemName: string;
  readonly difference: SchemaItemProperties<ReturnType<T["toJSON"]>>;
  readonly schemaType: SchemaItemType;
}

/**
 * Differencing entry for Constant Schema Items.
 * @alpha
 */
export interface ConstantsDifference extends SchemaItemDifference<Constant> { }

/**
 * Differencing entry for Custom Attribute Class Schema Items.
 * @alpha
 */
export interface CustomAttributeClassDifference extends SchemaItemDifference<CustomAttributeClass> { }

/**
 * Differencing entry for Entity Class Schema Items.
 * @alpha
 */
export interface EntityClassDifference extends SchemaItemDifference<EntityClass> { }

/**
 * Differencing entry for Enumerator Schema Items.
 * @alpha
 */
export interface EnumerationDifference extends SchemaItemDifference<Enumeration> { }

/**
 * Differencing entry for Kind-Of-Quantities Schema Items.
 * @alpha
 */
export interface KindOfQuantityDifference extends SchemaItemDifference<KindOfQuantity> { }

/**
 * Differencing entry for Mixin Class Schema Items.
 * @alpha
 */
export interface MixinClassDifference extends SchemaItemDifference<Mixin> { }

/**
 * Differencing entry for Phenomenon Schema Items.
 * @alpha
 */
export interface PhenomenonDifference extends SchemaItemDifference<Phenomenon> { }

/**
 * Differencing entry for Property Category Schema Items.
 * @alpha
 */
export interface PropertyCategoryDifference extends SchemaItemDifference<PropertyCategory> { }

/**
 * Differencing entry for Relationship Class Schema Items.
 * @alpha
 */
export interface RelationshipClassDifference extends SchemaItemDifference<RelationshipClass> { }

/**
 * Differencing entry for Struct Class Schema Items.
 * @alpha
 */
export interface StructClassDifference extends SchemaItemDifference<StructClass> { }

/**
 * Differencing entry for Unit System Schema Items.
 * @alpha
 */
export interface UnitSystemDifference extends SchemaItemDifference<UnitSystem> { }

/**
 * Differencing entry for added or changed Properties.
 * @alpha
 */
export interface ClassPropertyDifference {
  readonly changeType: "add" | "modify";
  readonly schemaType: SchemaOtherTypes.Property;
  readonly itemName: string;
  readonly path: string;
  readonly difference: Editable<AnyPropertyProps>;
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
  readonly difference: Editable<CustomAttribute>;
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
  readonly difference: Editable<CustomAttribute>;
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
  readonly difference: Editable<CustomAttribute>;
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
  readonly difference: Editable<CustomAttribute>;
}

/**
 * Differencing entry for changed mixins on EntityClasses.
 * @alpha
 */
export interface EntityClassMixinDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaItemType.EntityClass;
  readonly itemName: string;
  readonly path: "$mixins";
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
  readonly difference: Editable<AnyEnumerator>;
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
  readonly difference: Editable<Omit<RelationshipConstraintProps, "constraintClasses">>;
}

/**
 * Differencing entry for constraint classes added to Relationship Constrains.
 * @alpha
 */
export interface RelationshipConstraintClassDifference {
  readonly changeType: "add";
  readonly schemaType: SchemaOtherTypes.RelationshipConstraintClass;
  readonly itemName: string;
  readonly path: "$source.constraintClasses" | "$target.constraintClasses";
  readonly difference: string[];
}
