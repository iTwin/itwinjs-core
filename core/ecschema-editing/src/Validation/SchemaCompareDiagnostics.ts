/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Comparison
 */

import { AnyClass, AnyEnumerator, Constant, CustomAttribute, CustomAttributeClass, EntityClass,
  Enumeration, Format, InvertedUnit, KindOfQuantity, Mixin, OverrideFormat, PropertyCategory,
  RelationshipClass, Schema, SchemaItem, Unit,
} from "@itwin/ecschema-metadata";
import {
  createClassDiagnosticClass, createCustomAttributeContainerDiagnosticClass, createPropertyDiagnosticClass,
  createRelationshipConstraintDiagnosticClass, createSchemaDiagnosticClass, createSchemaItemDiagnosticClass,
} from "./Diagnostic";

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * The unique diagnostic codes for Schema comparison.
 * @beta
 */
export const SchemaCompareCodes = {
  SchemaDelta: "SC-100",
  SchemaReferenceMissing: "SC-101",
  SchemaItemDelta: "SC-102",
  SchemaItemMissing: "SC-103",
  ClassDelta: "SC-104",
  BaseClassDelta: "SC-105",
  PropertyDelta: "SC-106",
  PropertyMissing: "SC-107",
  EntityMixinMissing: "SC-108",
  MixinDelta: "SC-109",
  RelationshipDelta: "SC-110",
  RelationshipConstraintDelta: "SC-111",
  RelationshipConstraintClassMissing: "SC-112",
  CustomAttributeClassDelta: "SC-113",
  CustomAttributeInstanceClassMissing: "SC-114",
  EnumerationDelta: "SC-115",
  EnumeratorMissing: "SC-116",
  EnumeratorDelta: "SC-117",
  KoqDelta: "SC-118",
  PresentationUnitMissing: "SC-119",
  PropertyCategoryDelta: "SC-120",
  FormatDelta: "SC-121",
  FormatUnitMissing: "SC-122",
  UnitLabelOverrideDelta: "SC-123",
  UnitDelta: "SC-124",
  InvertedUnitDelta: "SC-125",
  PhenomenonDelta: "SC-126",
  ConstantDelta: "SC-127",
  SchemaReferenceDelta: "SC-128",
};

/**
 * The list of [[IDiagnostic]] implementation classes used by the Schema comparison framework.
 * @beta
 */
export const SchemaCompareDiagnostics = {
  /** Required message parameters: property name, property A value, property B value */
  SchemaDelta: createSchemaDiagnosticClass<[string, any, any]>(SchemaCompareCodes.SchemaDelta, ""),

  /** Required message parameters: reference schema name */
  SchemaReferenceMissing: createSchemaDiagnosticClass<[Schema]>(SchemaCompareCodes.SchemaReferenceMissing, ""),

  /** Required message parameters: schema name, version A, version B */
  SchemaReferenceDelta: createSchemaDiagnosticClass<[Schema, string, string]>(SchemaCompareCodes.SchemaReferenceDelta, ""),

  /** Required message parameters: property name, property A value, property B value */
  SchemaItemDelta: createSchemaItemDiagnosticClass<SchemaItem, [string, any, any]>(SchemaCompareCodes.SchemaItemDelta, ""),

  /** Required message parameters: none */
  SchemaItemMissing: createSchemaItemDiagnosticClass<SchemaItem, []>(SchemaCompareCodes.SchemaItemMissing, ""),

  /** Required message parameters: property name, property A value, property B value */
  ClassDelta: createClassDiagnosticClass<[string, any, any]>(SchemaCompareCodes.ClassDelta, ""),

  /** Required message parameters: Class A base class, Class B base class */
  BaseClassDelta: createClassDiagnosticClass<[AnyClass | undefined, AnyClass | undefined]>(SchemaCompareCodes.BaseClassDelta, ""),

  /** Required message parameters: property name, property A value, property B value */
  PropertyDelta: createPropertyDiagnosticClass<[string, any, any]>(SchemaCompareCodes.PropertyDelta, ""),

  /** Required message parameters: none */
  PropertyMissing: createPropertyDiagnosticClass<[]>(SchemaCompareCodes.PropertyMissing, ""),

  /** Required message parameters: Mixin */
  EntityMixinMissing: createSchemaItemDiagnosticClass<EntityClass, [Mixin]>(SchemaCompareCodes.EntityMixinMissing, ""),

  /** Required message parameters: property name, property A value, property B value */
  MixinDelta: createSchemaItemDiagnosticClass<Mixin, [string, any, any]>(SchemaCompareCodes.MixinDelta, ""),

  /** Required message parameters: property name, property A value, property B value */
  RelationshipDelta: createSchemaItemDiagnosticClass<RelationshipClass, [string, any, any]>(SchemaCompareCodes.RelationshipDelta, ""),

  /** Required message parameters: property name, property A value, property B value */
  RelationshipConstraintDelta: createRelationshipConstraintDiagnosticClass<[string, any, any]>(SchemaCompareCodes.RelationshipConstraintDelta, ""),

  /** Required message parameters: constraint class */
  RelationshipConstraintClassMissing: createRelationshipConstraintDiagnosticClass<[AnyClass]>(SchemaCompareCodes.RelationshipConstraintClassMissing, ""),

  /** Required message parameters: property name, property A value, property B value  */
  CustomAttributeClassDelta: createSchemaItemDiagnosticClass<CustomAttributeClass, [string, any, any]>(SchemaCompareCodes.CustomAttributeClassDelta, ""),

  /** Required message parameters: CustomAttributeClass name */
  CustomAttributeInstanceClassMissing: createCustomAttributeContainerDiagnosticClass<[CustomAttribute]>(SchemaCompareCodes.CustomAttributeInstanceClassMissing, ""),

  /** Required message parameters: property name, property A value, property B value  */
  EnumerationDelta: createSchemaItemDiagnosticClass<Enumeration, [string, string, string]>(SchemaCompareCodes.EnumerationDelta, ""),

  /** Required message parameters: Enumerator */
  EnumeratorMissing: createSchemaItemDiagnosticClass<Enumeration, [AnyEnumerator]>(SchemaCompareCodes.EnumeratorMissing, ""),

  /** Required message parameters: Enumerator property name, property A value, property B value  */
  EnumeratorDelta: createSchemaItemDiagnosticClass<Enumeration, [AnyEnumerator, string, any, any]>(SchemaCompareCodes.EnumeratorDelta, ""),

  /** Required message parameters: property name, property A value, property B value  */
  KoqDelta: createSchemaItemDiagnosticClass<KindOfQuantity, [string, any, any]>(SchemaCompareCodes.KoqDelta, ""),

  /** Required message parameters: PresentationUnit (Format | OverrideFormat) */
  PresentationUnitMissing: createSchemaItemDiagnosticClass<KindOfQuantity, [Format | OverrideFormat]>(SchemaCompareCodes.PresentationUnitMissing, ""),

  /** Required message parameters: property name, property A value, property B value  */
  PropertyCategoryDelta: createSchemaItemDiagnosticClass<PropertyCategory, [string, any, any]>(SchemaCompareCodes.PropertyCategoryDelta, ""),

  /** Required message parameters: property name, property A value, property B value  */
  FormatDelta: createSchemaItemDiagnosticClass<Format, [string, any, any]>(SchemaCompareCodes.FormatDelta, ""),

  /** Required message parameters: Unit or InvertedUnit */
  FormatUnitMissing: createSchemaItemDiagnosticClass<Format, [Unit | InvertedUnit]>(SchemaCompareCodes.FormatUnitMissing, ""),

  /** Required message parameters: Unit or InvertedUnit, label A, label B */
  UnitLabelOverrideDelta: createSchemaItemDiagnosticClass<Format, [Unit | InvertedUnit, string | undefined, string | undefined]>(SchemaCompareCodes.UnitLabelOverrideDelta, ""),

  /** Required message parameters: property name, property A value, property B value  */
  UnitDelta: createSchemaItemDiagnosticClass<Format, [string, string, string]>(SchemaCompareCodes.UnitDelta, ""),

  /** Required message parameters: property name, property A value, property B value  */
  InvertedUnitDelta: createSchemaItemDiagnosticClass<InvertedUnit, [string, string, string]>(SchemaCompareCodes.InvertedUnitDelta, ""),

  /** Required message parameters: property name, property A value, property B value  */
  PhenomenonDelta: createSchemaItemDiagnosticClass<InvertedUnit, [string, string, string]>(SchemaCompareCodes.PhenomenonDelta, ""),

  /** Required message parameters: property name, property A value, property B value  */
  ConstantDelta: createSchemaItemDiagnosticClass<Constant, [string, string, string]>(SchemaCompareCodes.ConstantDelta, ""),
};
