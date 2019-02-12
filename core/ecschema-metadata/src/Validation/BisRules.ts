/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ECStringConstants } from "../Constants";
import { PrimitiveType, SchemaItemType, StrengthDirection, StrengthType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { AnyClass } from "../Interfaces";
import { ECClass, StructClass } from "../Metadata/Class";
import { CustomAttributeClass } from "../Metadata/CustomAttributeClass";
import { EntityClass } from "../Metadata/EntityClass";
import { KindOfQuantity } from "../Metadata/KindOfQuantity";
import { Mixin } from "../Metadata/Mixin";
import { AnyProperty, PrimitiveOrEnumPropertyBase, PrimitiveProperty, Property } from "../Metadata/Property";
import { RelationshipClass } from "../Metadata/RelationshipClass";
import { Schema } from "../Metadata/Schema";
import { Unit } from "../Metadata/Unit";
import { SchemaKey } from "../SchemaKey";
import * as Diagnostic from "./Diagnostic";
import { IRuleSet } from "./Rules";

const bisCoreName = "BisCore";
const bisModelName = "Model";
const classHasHandlerName = "ClassHasHandler";
const customHandledPropertyName = "CustomHandledProperty";
const definitionModelName = "DefinitionModel";
const deprecatedFullName = "CoreCustomAttributes.Deprecated";
const documentListModelName = "DocumentListModel";
const elementAspectName = "ElementAspect";
const elementMultiAspectName = "ElementMultiAspect";
const elementOwnsMultiAspectsName = "ElementOwnsMultiAspects";
const elementOwnsUniqueAspectName = "ElementOwnsUniqueAspect";
const elementUniqueAspectName = "ElementUniqueAspect";
const informationRecordModelName = "InformationRecordModel";
const iParentElementName = "IParentElement";
const iSubModeledElementName = "ISubModeledElement";
const linkModelModelName = "LinkModel";
const percentagePhenomenonName = "PERCENTAGE";
const physicalModelName = "PhysicalModel";
const siUnitSystemName = "SI";
const spatialLocationModelName = "SpatialLocationModel";
const validExtendedTypes = ["BeGuid", "GeometryStream", "Json"];

const ruleSetName = "BIS";

function getCode(code: number): string {
  return ruleSetName + ":" + code;
}

/** The unique diagnostic codes for BIS rules. */
// tslint:disable-next-line:variable-name
export const DiagnosticCodes = {
  SchemaXmlVersionMustBeTheLatest: getCode(100),
  SchemaMustNotReferenceOldStandardSchemas: getCode(101),
  SchemaWithDynamicInNameMustHaveDynamicSchemaCA: getCode(102),
  SchemaClassDisplayLabelMustBeUnique: getCode(103),
  MultiplePropertiesInClassWithSameLabel: getCode(104),
  PropertyShouldNotBeOfTypeLong: getCode(105),
  PropertyHasInvalidExtendedType: getCode(106),
  PropertyMustNotUseCustomHandledPropertyRestriction: getCode(107),
  EntityClassMustDeriveFromBisHierarchy: getCode(108),
  EntityClassMayNotInheritSameProperty: getCode(109),
  ElementMultiAspectMustHaveCorrespondingRelationship: getCode(110),
  ElementUniqueAspectMustHaveCorrespondingRelationship: getCode(111),
  EntityClassesCannotDeriveFromIParentElementAndISubModeledElement: getCode(112),
  EntityClassesCannotDeriveFromModelClasses: getCode(113),
  EntityClassesMayNotSubclassDeprecatedClasses: getCode(114),
  BisModelSubClassesCannotDefineProperties: getCode(115),
  EntityClassesMayNotSubclassDeprecatedClasse: getCode(116),
  StructsCannotHaveBaseClasses: getCode(117),
  MixinsCannotOverrideInheritedProperties: getCode(118),
  RelationshipClassMustNotUseHoldingStrength: getCode(119),
  RelationshipSourceMultiplicityUpperBoundRestriction: getCode(120),
  RelationshipTargetMultiplicityUpperBoundRestriction: getCode(121),
  RelationshipElementAspectContraintRestriction: getCode(122),
  EmbeddingRelationshipsMustNotHaveHasInName: getCode(123),
  CustomAttributeClassCannotHaveBaseClasses: getCode(124),
  KOQMustNotUseUnitlessRatios: getCode(125),
  KOQMustUseSIUnitForPersistenceUnit: getCode(126),
};

/**
 * The list of [[IDiagnostic]] implementation classes used by the BIS rule implementations.
 */
// tslint:disable-next-line:variable-name
export const Diagnostics = {
  /** Required message parameters: latest ECXML version. */
  SchemaXmlVersionMustBeTheLatest: Diagnostic.createSchemaDiagnosticClass<[string]>(DiagnosticCodes.SchemaXmlVersionMustBeTheLatest,
    "Schema ECXML Version is not the latest ECVersion, {0}."),

  /** Required message parameters: Schema full name, standard schema name. */
  SchemaMustNotReferenceOldStandardSchemas: Diagnostic.createSchemaDiagnosticClass<[string, string]>(DiagnosticCodes.SchemaMustNotReferenceOldStandardSchemas,
    "Schema '{0}' references the old standard schema '{1}'. Only new standard schemas should be used."),

  /** Required message parameters: Schema full name. */
  SchemaWithDynamicInNameMustHaveDynamicSchemaCA: Diagnostic.createSchemaDiagnosticClass<[string]>(DiagnosticCodes.SchemaWithDynamicInNameMustHaveDynamicSchemaCA,
    "Schema '{0}' contains 'dynamic' in the name, therefore requiring the 'CoreCA:DynamicSchema' CustomAttribute to be applied."),

  /** Required message parameters: 1st class full name, 2nd class full name, and display label */
  SchemaClassDisplayLabelMustBeUnique: Diagnostic.createSchemaDiagnosticClass<[string, string, string]>(DiagnosticCodes.SchemaClassDisplayLabelMustBeUnique,
    "Classes {0} and {1} have the same display label, '{2}'. Labels must be unique within the same schema."),

  /** Required message parameters: mixin class fullName, class fullName, applies to constraint class fullName */
  MixinsCannotOverrideInheritedProperties: Diagnostic.createSchemaItemDiagnosticClass<Mixin, [string, string]>(DiagnosticCodes.MixinsCannotOverrideInheritedProperties,
    "Mixin '{0}' overrides inherited property '{1}'."),

  /** Required message parameters: EntityClass fullName */
  EntityClassMustDeriveFromBisHierarchy: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(DiagnosticCodes.EntityClassMustDeriveFromBisHierarchy,
    "Entity class '{0}' must derive from the BIS hierarchy."),

  /** Required message parameters: EntityClass fullName, property name, first class fullName, and second class fullName */
  EntityClassMayNotInheritSameProperty: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string, string, string, string]>(DiagnosticCodes.EntityClassMayNotInheritSameProperty,
    "Entity class '{0}' inherits the property '{1}' from more than one source: '{2}', '{3}'. Entity classes may not inherit the same property from more than one class (base class or mixins)."),

  /** Required message parameters: EntityClass fullName */
  ElementMultiAspectMustHaveCorrespondingRelationship: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(DiagnosticCodes.ElementMultiAspectMustHaveCorrespondingRelationship,
    "The ElementMultiAspect Entity class '{0}' requires an ElementOwnsMultiAspects relationship with this class supported as a target constraint."),

  /** Required message parameters: EntityClass fullName */
  ElementUniqueAspectMustHaveCorrespondingRelationship: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(DiagnosticCodes.ElementUniqueAspectMustHaveCorrespondingRelationship,
    "The ElementUniqueAspect Entity class '{0}' requires an ElementOwnsUniqueAspect relationship with this class supported as a target constraint."),

  /** Required message parameters: EntityClass fullName */
  EntityClassesCannotDeriveFromIParentElementAndISubModeledElement: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(DiagnosticCodes.EntityClassesCannotDeriveFromIParentElementAndISubModeledElement,
    "Entity class '{0}' implements both IParentElement and ISubModeledElement which is not allowed."),

  /** Required message parameters: EntityClass fullName, model class fullName */
  EntityClassesCannotDeriveFromModelClasses: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string, string]>(DiagnosticCodes.EntityClassesCannotDeriveFromModelClasses,
    "Entity class '{0}' may not subclass '{1}'."),

  /** Required message parameters: EntityClass fullName */
  BisModelSubClassesCannotDefineProperties: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(DiagnosticCodes.BisModelSubClassesCannotDefineProperties,
    "Entity class '{0}' may not define properties because it derives from 'BisCore.Model'. Model subclasses should not add new properties."),

  /** Required message parameters: EntityClass fullName, base class fullName */
  EntityClassesMayNotSubclassDeprecatedClasses: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string, string]>(DiagnosticCodes.EntityClassesMayNotSubclassDeprecatedClasses,
    "Entity class '{0}' derives from '{1}' which has been deprecated."),

  /** Required message parameters: RelationshipClass fullName */
  RelationshipClassMustNotUseHoldingStrength: Diagnostic.createSchemaItemDiagnosticClass<RelationshipClass, [string]>(DiagnosticCodes.RelationshipClassMustNotUseHoldingStrength,
    "Relationship class '{0}' has a strength value of 'holding' which is not allowed."),

  /** Required message parameters: RelationshipClass fullName */
  RelationshipSourceMultiplicityUpperBoundRestriction: Diagnostic.createSchemaItemDiagnosticClass<RelationshipClass, [string]>(DiagnosticCodes.RelationshipSourceMultiplicityUpperBoundRestriction,
    "Relationship class '{0}' has an 'embedding' strength with a forward direction so the source constraint may not have a multiplicity upper bound greater than 1."),

  /** Required message parameters: RelationshipClass fullName */
  RelationshipTargetMultiplicityUpperBoundRestriction: Diagnostic.createSchemaItemDiagnosticClass<RelationshipClass, [string]>(DiagnosticCodes.RelationshipTargetMultiplicityUpperBoundRestriction,
    "Relationship class '{0}' has an 'embedding' strength with a backward direction so the target constraint may not have a multiplicity upper bound greater than 1."),

  /** Required message parameters: RelationshipClass fullName, relationship end (source/target) */
  RelationshipElementAspectContraintRestriction: Diagnostic.createSchemaItemDiagnosticClass<RelationshipClass, [string, string]>(DiagnosticCodes.RelationshipElementAspectContraintRestriction,
    "Relationship class '{0}' may not have an ElementAspect {1} constraint, unless subclassed from ElementOwnsUniqueAspect or ElementOwnsMultiAspect."),

  /** Required message parameters: RelationshipClass fullName */
  EmbeddingRelationshipsMustNotHaveHasInName: Diagnostic.createSchemaItemDiagnosticClass<RelationshipClass, [string]>(DiagnosticCodes.EmbeddingRelationshipsMustNotHaveHasInName,
    "Relationship class '{0}' has an 'embedding' strength and contains 'Has' in its name. Consider renaming this class."),

  /** Required message parameters: StructClass fullName */
  StructsCannotHaveBaseClasses: Diagnostic.createSchemaItemDiagnosticClass<StructClass, [string]>(DiagnosticCodes.StructsCannotHaveBaseClasses,
    "Struct class '{0}' has a base class, but structs should not have base classes."),

  /** Required message parameters: CustomAttributeClass fullName */
  CustomAttributeClassCannotHaveBaseClasses: Diagnostic.createSchemaItemDiagnosticClass<CustomAttributeClass, [string]>(DiagnosticCodes.CustomAttributeClassCannotHaveBaseClasses,
    "CustomAttribute class '{0}' has a base class, but CustomAttribute classes should not have base classes."),

  /** Required message parameters: KindOfQuantity fullName */
  KOQMustNotUseUnitlessRatios: Diagnostic.createSchemaItemDiagnosticClass<KindOfQuantity, [string]>(DiagnosticCodes.KOQMustNotUseUnitlessRatios,
    "KindOfQuantity '{0}' has persistence unit of Phenomenon 'PERCENTAGE'. Unitless ratios are not allowed. Use a ratio phenomenon which includes units like VOLUME_RATIO"),

  /** Required message parameters: KindOfQuantity fullName, UnitSystem fullName */
  KOQMustUseSIUnitForPersistenceUnit: Diagnostic.createSchemaItemDiagnosticClass<KindOfQuantity, [string, string]>(DiagnosticCodes.KOQMustUseSIUnitForPersistenceUnit,
    "KindOfQuantity '{0}' has persistence unit of unit system '{1}' but must have an SI unit system"),

  /** Required message parameters: ECClass FullName, property name */
  PropertyShouldNotBeOfTypeLong: Diagnostic.createPropertyDiagnosticClass<[string, string]>(DiagnosticCodes.PropertyShouldNotBeOfTypeLong,
    "Property '{0}:{1}' is of type 'long' and long properties are not allowed. Use int, double or if this represents a FK use a navigation property."),

  /** Required message parameters: ECClass FullName, property name, extendedType name */
  PropertyHasInvalidExtendedType: Diagnostic.createPropertyDiagnosticClass<[string, string, string]>(DiagnosticCodes.PropertyHasInvalidExtendedType,
    "Property '{0}:{1}' has extended type '{2}', which is not on the list of valid extended types (currently 'BeGuid', 'GeometryStream', and 'Json')."),

  /** Required message parameters: ECClass FullName, property name, extendedType name */
  PropertyMustNotUseCustomHandledPropertyRestriction: Diagnostic.createPropertyDiagnosticClass<[string, string]>(DiagnosticCodes.PropertyMustNotUseCustomHandledPropertyRestriction,
    "Property '{0}:{1}' has CustomAttribute 'bis:CustomHandledProperty, which requires the parent class to have the CustomAttribute 'bis:ClassHasHandler'."),

  /** Required message parameters: ECClass FullName, first property name, second property name, display label */
  MultiplePropertiesInClassWithSameLabel: Diagnostic.createClassDiagnosticClass<[string, string, string, string]>(DiagnosticCodes.MultiplePropertiesInClassWithSameLabel,
    "Class '{0}' has properties '{1}' and '{2}' with the same display label '{3}'."),
};

/**
 * All schema validation rules that fall under the category of ECObjects.
 */
// tslint:disable-next-line:variable-name
export const BisRuleSet: IRuleSet = {
  name: ruleSetName,
  schemaRules: [
    schemaXmlVersionMustBeTheLatest,
    schemaMustNotReferenceOldStandardSchemas,
    schemaWithDynamicInNameMustHaveDynamicSchemaCA,
    schemaClassDisplayLabelMustBeUnique,
  ],
  entityClassRules: [
    entityClassMustDeriveFromBisHierarchy,
    entityClassMayNotInheritSameProperty,
    elementMultiAspectMustHaveCorrespondingRelationship,
    elementUniqueAspectMustHaveCorrespondingRelationship,
    entityClassesCannotDeriveFromIParentElementAndISubModeledElement,
    entityClassesCannotDeriveFromModelClasses,
    bisModelSubClassesCannotDefineProperties,
    entityClassesMayNotSubclassDeprecatedClasses,
  ],
  relationshipRules: [
    relationshipClassMustNotUseHoldingStrength,
    relationshipSourceMultiplicityUpperBoundRestriction,
    relationshipTargetMultiplicityUpperBoundRestriction,
    relationshipElementAspectContraintRestriction,
    embeddingRelationshipsMustNotHaveHasInName,
  ],
  structClassRules: [
    structsCannotHaveBaseClasses,
  ],
  customAttributeClassRules: [
    customAttributeClassCannotHaveBaseClasses,
  ],
  kindOfQuantityRules: [
    koqMustNotUseUnitlessRatios,
    koqMustUseSIUnitForPersistenceUnit,
  ],
  propertyRules: [
    propertyShouldNotBeOfTypeLong,
    propertyHasInvalidExtendedType,
    propertyMustNotUseCustomHandledPropertyRestriction,
  ],
  classRules: [
    multiplePropertiesInClassWithSameLabel,
  ],
  mixinRules: [
    mixinsCannotOverrideInheritedProperties,
  ],
};

function getPrimitiveType(property: Property): PrimitiveType | undefined {
  if (property.isPrimitive)
    return (property as PrimitiveProperty).primitiveType;

  return undefined;
}

/** SCHEMA RULES
 * ************************************************************
 */

/** The names of all pre-EC3 standard schemas */
const oldStandardSchemaNames = [
  "Bentley_Standard_CustomAttributes",
  "Bentley_Standard_Classes",
  "Bentley_ECSchemaMap",
  "EditorCustomAttributes",
  "Bentley_Common_Classes",
  "Dimension_Schema",
  "iip_mdb_customAttributes",
  "KindOfQuantity_Schema",
  "rdl_customAttributes",
  "SIUnitSystemDefaults",
  "Unit_Attributes",
  "Units_Schema",
  "USCustomaryUnitSystemDefaults",
  "ECDbMap",
];

/**
 * BIS Rule: Schema ECXML version must be the latest.
 */
export async function* schemaXmlVersionMustBeTheLatest(schema: Schema): AsyncIterable<Diagnostic.SchemaDiagnostic<any[]>> {
  // TODO:  Implement rule once EC version management is complete...
  if (schema)
    return true;
  const latestVersion = "";
  yield new Diagnostics.SchemaXmlVersionMustBeTheLatest(schema, [latestVersion]);
}

/**
 * BIS Rule: Schema must not reference old standard schemas.
 */
export async function* schemaMustNotReferenceOldStandardSchemas(schema: Schema): AsyncIterable<Diagnostic.SchemaDiagnostic<any[]>> {
  for (const ref of schema.references) {
    // can reference ECDbMap as long as its 2.0 or above.
    if (ref.name === "ECDbMap" && ref.readVersion > 1)
      continue;

    if (oldStandardSchemaNames.findIndex((x) => ref.name === x) !== -1)
      yield new Diagnostics.SchemaMustNotReferenceOldStandardSchemas(schema, [schema.schemaKey.toString(), ref.name]);
  }
}

/**
 * BIS Rule: Schema with 'dynamic' in the name (case-insensitive) requires the "CoreCA:Dynamic" custom attribute.
 */
export async function* schemaWithDynamicInNameMustHaveDynamicSchemaCA(schema: Schema): AsyncIterable<Diagnostic.SchemaDiagnostic<any[]>> {
  if (!schema.name.toLowerCase().includes("dynamic"))
    return;

  if (!schema.customAttributes || !schema.customAttributes.has("CoreCustomAttributes.DynamicSchema")) {
    yield new Diagnostics.SchemaWithDynamicInNameMustHaveDynamicSchemaCA(schema, [schema.schemaKey.toString()]);
  }
}

/**
 * BIS Rule: Classes within the same schema cannot have the same display label.
 */
export async function* schemaClassDisplayLabelMustBeUnique(schema: Schema): AsyncIterable<Diagnostic.SchemaDiagnostic<any[]>> {
  const existingLabels = new Map<string, ECClass>();
  for (const ecClass of schema.getClasses()) {
    if (!ecClass.label)
      continue;

    const entry = existingLabels.get(ecClass.label);
    if (entry) {
      yield new Diagnostics.SchemaClassDisplayLabelMustBeUnique(schema, [ecClass.fullName, entry.fullName, ecClass.label]);
      continue;
    }

    existingLabels.set(ecClass.label, ecClass);
  }
}

/** Mixin RULES
 * ************************************************************
 */

/**
 * BIS Rule: A Mixin class cannot override inherited properties.
 */
export async function* mixinsCannotOverrideInheritedProperties(mixin: Mixin): AsyncIterable<Diagnostic.SchemaItemDiagnostic<Mixin, any[]>> {
  if (!mixin.properties || !mixin.baseClass)
    return;

  const baseClass = await mixin.baseClass;
  const allBaseProperties = await baseClass.getProperties();
  if (!allBaseProperties || allBaseProperties.length === 0)
    return;

  for (const property of mixin.properties) {
    if (allBaseProperties.some((x) => x.name === property.name))
      yield new Diagnostics.MixinsCannotOverrideInheritedProperties(mixin, [mixin.fullName, property.name]);
  }
}

/** EntityClass RULES
 * ************************************************************
 */

/**
 * BIS Rule: Entity classes must derive from the BIS hierarchy.
 */
export async function* entityClassMustDeriveFromBisHierarchy(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any[]>> {
  for await (const baseClass of entity.getAllBaseClasses()) {
    if (baseClass.schema.name === bisCoreName)
      return;
  }

  yield new Diagnostics.EntityClassMustDeriveFromBisHierarchy(entity, [entity.fullName]);
}

/**
 * BIS Rule: Entity classes may not inherit a property from more than one base class or mixin.
 */
export async function* entityClassMayNotInheritSameProperty(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any[]>> {
  const baseClass = await entity.baseClass;
  if (entity.mixins.length === 0 || entity.mixins.length === 1 && !baseClass)
    return;

  // The properties of each base class must be retrieved separately in order to discover duplicates.
  // entity.getProperties() would merge them in a map, removing duplicates...
  const allProperties: Property[] = [];
  if (baseClass) {
    allProperties.push(...await baseClass.getProperties());
  }
  for (const promise of entity.mixins) {
    const mixin = await promise;
    allProperties.push(...await mixin.getProperties());
  }

  // Now find duplicates in the array
  const seenProps = new Map<string, Property>();
  for (const prop of allProperties) {
    if (prop.class.name === entity.name)
      continue;

    if (seenProps.has(prop.name)) {
      const prevProp = seenProps.get(prop.name);
      yield new Diagnostics.EntityClassMayNotInheritSameProperty(entity, [entity.fullName, prop.name, prevProp!.class.fullName, prop.class.fullName]);
      continue;
    }

    seenProps.set(prop.name, prop);
  }
}

/**
 * BIS Rule: If an ElementMultiAspect exists, there must be a relationship that derives from the ElementOwnsMultiAspects
 * relationship with this class supported as a target constraint.
 */
export async function* elementMultiAspectMustHaveCorrespondingRelationship(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any[]>> {
  const context = entity.schema.context;
  if (!context)
    throw new ECObjectsError(ECObjectsStatus.SchemaContextUndefined, `Schema context is undefined for schema ${entity.schema.fullName}.`);

  if (!await entity.is(elementMultiAspectName, bisCoreName))
    return;

  const relationships = entity.schema.getClasses().filter((c) => c.schemaItemType === SchemaItemType.RelationshipClass);
  if (relationships.length === 0) {
    yield new Diagnostics.ElementMultiAspectMustHaveCorrespondingRelationship(entity, [entity.fullName]);
    return;
  }

  for (const relationship of relationships) {
    if (!await relationship.is(elementOwnsMultiAspectsName, bisCoreName))
      continue;

    if ((relationship as RelationshipClass).target.supportsClass(entity))
      return;
  }

  yield new Diagnostics.ElementMultiAspectMustHaveCorrespondingRelationship(entity, [entity.fullName]);
}

/**
 * BIS Rule: If an ElementUniqueAspect exists, there must be a relationship that derives from the ElementOwnsUniqueAspect
 * relationship with this class supported as a target constraint.
 */
export async function* elementUniqueAspectMustHaveCorrespondingRelationship(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any[]>> {
  const context = entity.schema.context;
  if (!context)
    throw new ECObjectsError(ECObjectsStatus.SchemaContextUndefined, `Schema context is undefined for schema ${entity.schema.fullName}.`);

  if (!await entity.is(elementUniqueAspectName, bisCoreName))
    return;

  const relationships = entity.schema.getClasses().filter((c) => c.schemaItemType === SchemaItemType.RelationshipClass);
  if (relationships.length === 0) {
    yield new Diagnostics.ElementUniqueAspectMustHaveCorrespondingRelationship(entity, [entity.fullName]);
    return;
  }

  for (const relationship of relationships) {
    if (!await relationship.is(elementOwnsUniqueAspectName, bisCoreName))
      continue;

    if ((relationship as RelationshipClass).target.supportsClass(entity))
      return;
  }

  yield new Diagnostics.ElementUniqueAspectMustHaveCorrespondingRelationship(entity, [entity.fullName]);
}

/**
 * BIS Rule: Entity classes cannot implement both bis:IParentElement and bis:ISubModeledElement.
 */
export async function* entityClassesCannotDeriveFromIParentElementAndISubModeledElement(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any[]>> {
  const context = entity.schema.context;
  if (!context)
    throw new ECObjectsError(ECObjectsStatus.SchemaContextUndefined, `Schema context is undefined for schema ${entity.schema.fullName}.`);

  if (await entity.is(iParentElementName, bisCoreName) && await entity.is(iSubModeledElementName, bisCoreName))
    yield new Diagnostics.EntityClassesCannotDeriveFromIParentElementAndISubModeledElement(entity, [entity.fullName]);
}

/**
 * BIS Rule: Entity classes cannot drive from bis:PhysicalModel, bis:SpatialLocationModel, bis:GroupInformationModel, bis:InformationRecordModel,
 * bis:DefinitionModel, bis:DocumentListModel, or bis:LinkModel.
 */
export async function* entityClassesCannotDeriveFromModelClasses(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any[]>> {
  const context = entity.schema.context;
  if (!context)
    throw new ECObjectsError(ECObjectsStatus.SchemaContextUndefined, `Schema context is undefined for schema ${entity.schema.fullName}.`);

  const bisCore = await context.getSchema(new SchemaKey(bisCoreName));
  if (!bisCore || !entity.baseClass || entity.baseClass.schemaName !== bisCoreName)
    return;

  const modelNames = [physicalModelName, spatialLocationModelName, informationRecordModelName,
    definitionModelName, documentListModelName, linkModelModelName];

  for (const modelName of modelNames) {
    const modelClass = await bisCore.getItem(modelName);
    if (!modelClass)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${modelName} could not be found.`);

    const isModel = await entity.is(modelClass as ECClass);
    if (isModel)
      yield new Diagnostics.EntityClassesCannotDeriveFromModelClasses(entity, [entity.fullName, modelClass.fullName]);
  }
}

/**
 * BIS Rule: Subclasses of bis:Model cannot have additional properties defined outside of BisCore.
 */
export async function* bisModelSubClassesCannotDefineProperties(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any[]>> {
  const context = entity.schema.context;
  if (!context)
    throw new ECObjectsError(ECObjectsStatus.SchemaContextUndefined, `Schema context is undefined for schema ${entity.schema.fullName}.`);

  const bisCore = await context.getSchema(new SchemaKey(bisCoreName));
  if (!bisCore || !entity.baseClass || entity.baseClass.schemaName !== bisCoreName)
    return;

  const modelClass = await bisCore.getItem(bisModelName);
  if (!modelClass)
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${bisModelName} could not be found.`);

  const isModel = await entity.is(modelClass as ECClass);
  if (!isModel)
    return;

  if (entity.properties)
    yield new Diagnostics.BisModelSubClassesCannotDefineProperties(entity, [entity.fullName]);
}

/**
 * BIS Rule: Entity classes may not subclass deprecated classes.
 */
export async function* entityClassesMayNotSubclassDeprecatedClasses(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any[]>> {
  if (!entity.baseClass)
    return;

  const baseClass = await entity.baseClass;
  if (baseClass.customAttributes && baseClass.customAttributes.has(deprecatedFullName))
    yield new Diagnostics.EntityClassesMayNotSubclassDeprecatedClasses(entity, [entity.fullName, baseClass.fullName]);
}

/** RelationshipClass RULES
 * ************************************************************
 */

/** BIS Rule: Relationship classes must not use the holding strength. */
export async function* relationshipClassMustNotUseHoldingStrength(relationshipClass: RelationshipClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any[]>> {
  if (relationshipClass.strength === StrengthType.Holding)
    yield new Diagnostics.RelationshipClassMustNotUseHoldingStrength(relationshipClass, [relationshipClass.fullName]);
}

/** BIS Rule: Relationship classes must not have a source constraint multiplicity upper bound greater than 1 if the strength is embedding and the direction is forward. */
export async function* relationshipSourceMultiplicityUpperBoundRestriction(relationshipClass: RelationshipClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any[]>> {
  if (relationshipClass.strength !== StrengthType.Embedding || relationshipClass.strengthDirection !== StrengthDirection.Forward)
    return;

  const multiplicity = relationshipClass.source.multiplicity;
  if (multiplicity && multiplicity.upperLimit > 1)
    yield new Diagnostics.RelationshipSourceMultiplicityUpperBoundRestriction(relationshipClass, [relationshipClass.fullName]);
}

/** BIS Rule: Relationship classes must not have a target constraint multiplicity upper bound greater than 1 if the strength is embedding and the direction is backward. */
export async function* relationshipTargetMultiplicityUpperBoundRestriction(relationshipClass: RelationshipClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any[]>> {
  if (relationshipClass.strength !== StrengthType.Embedding || relationshipClass.strengthDirection !== StrengthDirection.Backward)
    return;

  const multiplicity = relationshipClass.target.multiplicity;
  if (multiplicity && multiplicity.upperLimit > 1)
    yield new Diagnostics.RelationshipTargetMultiplicityUpperBoundRestriction(relationshipClass, [relationshipClass.fullName]);
}

/** BIS Rule: Relationship classes must not have an ElementAspect target constraint (or source constraint if direction is backwards), unless they derive from ElementOwnsUniqueAspect or ElementOwnsMultiAspect */
export async function* relationshipElementAspectContraintRestriction(relationshipClass: RelationshipClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any[]>> {
  const context = relationshipClass.schema.context;
  if (!context)
    throw new ECObjectsError(ECObjectsStatus.SchemaContextUndefined, `Schema context is undefined for schema ${relationshipClass.schema.fullName}.`);

  if (await relationshipClass.is(elementOwnsUniqueAspectName, bisCoreName) || await relationshipClass.is(elementOwnsMultiAspectsName, bisCoreName))
    return;

  const constraint = relationshipClass.strengthDirection === StrengthDirection.Forward ? relationshipClass.target : relationshipClass.source;
  if (!constraint.constraintClasses)
    return;

  for (const promise of constraint.constraintClasses) {
    const constraintClass = await promise;
    if (await constraintClass.is(elementAspectName, bisCoreName)) {
      const constraintType = constraint.isSource ? ECStringConstants.RELATIONSHIP_END_SOURCE : ECStringConstants.RELATIONSHIP_END_TARGET;
      yield new Diagnostics.RelationshipElementAspectContraintRestriction(relationshipClass, [relationshipClass.fullName, constraintType]);
    }
  }
}

/** BIS Rule: Embedding relationships should not have 'Has' in the class name. */
export async function* embeddingRelationshipsMustNotHaveHasInName(relationshipClass: RelationshipClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any[]>> {
  if (relationshipClass.strength !== StrengthType.Embedding)
    return;

  if (relationshipClass.name.includes("Has"))
    yield new Diagnostics.EmbeddingRelationshipsMustNotHaveHasInName(relationshipClass, [relationshipClass.fullName]);
}

/** StructClass RULES
 * ************************************************************
 */

/** BIS Rule: Struct classes must not have base classes. */
export async function* structsCannotHaveBaseClasses(structClass: StructClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<StructClass, any[]>> {
  if (structClass.baseClass)
    yield new Diagnostics.StructsCannotHaveBaseClasses(structClass, [structClass.fullName]);
}

/** CustomAttributesClass RULES
 * ************************************************************
 */

/** BIS Rule: CustomAttributes classes must not have base classes. */
export async function* customAttributeClassCannotHaveBaseClasses(customAttribute: CustomAttributeClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<CustomAttributeClass, any[]>> {
  if (customAttribute.baseClass)
    yield new Diagnostics.CustomAttributeClassCannotHaveBaseClasses(customAttribute, [customAttribute.fullName]);
}

/** KindOfQuantity RULES
 * ************************************************************
 */

/** BIS Rule: Kind Of Quantities must not use 'PERCENTAGE' or other unitless ratios. */
export async function* koqMustNotUseUnitlessRatios(koq: KindOfQuantity): AsyncIterable<Diagnostic.SchemaItemDiagnostic<KindOfQuantity, any[]>> {
  const unit = await koq.persistenceUnit;
  if (!unit || !(unit instanceof Unit))
    return;

  const phenomenon = await unit.phenomenon;
  if (!phenomenon)
    return;

  if (phenomenon.name === percentagePhenomenonName)
    yield new Diagnostics.KOQMustNotUseUnitlessRatios(koq, [koq.fullName]);
}

/** BIS Rule: Kind Of Quantities must use an SI Unit for their persistence unit. */
export async function* koqMustUseSIUnitForPersistenceUnit(koq: KindOfQuantity): AsyncIterable<Diagnostic.SchemaItemDiagnostic<KindOfQuantity, any[]>> {
  const unit = await koq.persistenceUnit;
  if (!unit || !(unit instanceof Unit))
    return;

  const unitSystem = await unit.unitSystem;
  if (!unitSystem)
    return;

  if (unitSystem.name !== siUnitSystemName)
    yield new Diagnostics.KOQMustUseSIUnitForPersistenceUnit(koq, [koq.fullName, unitSystem.fullName]);
}

/** Property RULES
 * ************************************************************
 */

/** BIS Rule: Properties should not be of type long. These properties should be navigation properties if they represent a FK or be of type int or double if they represent a number. */
export async function* propertyShouldNotBeOfTypeLong(property: AnyProperty): AsyncIterable<Diagnostic.PropertyDiagnostic<any[]>> {
  const primitiveType = getPrimitiveType(property);
  if (!primitiveType)
    return;

  if (primitiveType === PrimitiveType.Long) {
    yield new Diagnostics.PropertyShouldNotBeOfTypeLong(property, [property.class.fullName, property.name]);
  }
}

/** BIS Rule: Properties must use the following supported ExtendedTypes: BeGuid, GeometrySystem, and Json */
export async function* propertyHasInvalidExtendedType(property: AnyProperty): AsyncIterable<Diagnostic.PropertyDiagnostic<any[]>> {
  if (!(property instanceof PrimitiveOrEnumPropertyBase))
    return;

  if (!property.extendedTypeName)
    return;

  if (!validExtendedTypes.includes(property.extendedTypeName))
    yield new Diagnostics.PropertyHasInvalidExtendedType(property, [property.class.fullName, property.name, property.extendedTypeName]);
}

/** BIS Rule: Properties must not use CustomAttribute bis:CustomHandledProperty unless CustomAttribute bis:ClassHasHandler is defined on their parent class (not derived from a base class). */
export async function* propertyMustNotUseCustomHandledPropertyRestriction(property: AnyProperty): AsyncIterable<Diagnostic.PropertyDiagnostic<any[]>> {
  if (!property.customAttributes)
    return;

  if (!property.customAttributes.has(customHandledPropertyName))
    return;

  const parentAttributes = property.class.customAttributes;
  if (!parentAttributes || !parentAttributes.has(classHasHandlerName))
    yield new Diagnostics.PropertyMustNotUseCustomHandledPropertyRestriction(property, [property.class.fullName, property.name]);
}

/** ECClass RULES */

/** BIS Rule: Properties within the same class and category cannot have the same display label. */
export async function* multiplePropertiesInClassWithSameLabel(ecClass: AnyClass): AsyncIterable<Diagnostic.ClassDiagnostic<any[]>> {
  if (!ecClass.properties)
    return;

  const visitedProperties: Property[] = [];
  for (const property of ecClass.properties) {
    const label = property.label;
    if (!label)
      continue;

    const category = await property.category;

    for (const seenProperty of visitedProperties) {
      if (seenProperty.label === label) {
        const seenCategory = await seenProperty.category;
        if (!seenCategory && !category)
          yield new Diagnostics.MultiplePropertiesInClassWithSameLabel(ecClass, [ecClass.fullName, seenProperty.name, property.name, label]);

        if (!seenCategory || !category)
          continue;

        if (seenCategory.fullName === category.fullName)
          yield new Diagnostics.MultiplePropertiesInClassWithSameLabel(ecClass, [ecClass.fullName, seenProperty.name, property.name, label]);
      }
    }

    visitedProperties.push(property);
  }
}
