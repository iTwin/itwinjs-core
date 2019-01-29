/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { SchemaItemType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { ECClass } from "../Metadata/Class";
import { EntityClass } from "../Metadata/EntityClass";
import { Mixin } from "../Metadata/Mixin";
import { Property } from "../Metadata/Property";
import { RelationshipClass } from "../Metadata/RelationshipClass";
import { Schema } from "../Metadata/Schema";
import * as Diagnostic from "./Diagnostic";
import { IRuleSet } from "./Rules";

const bisCoreName = "BisCore";
const elementMultiAspectName = "ElementMultiAspect";
const elementOwnsMultiAspectsName = "ElementOwnsMultiAspects";
const elementUniqueAspectName = "ElementUniqueAspect";
const elementOwnsUniqueAspectName = "ElementOwnsUniqueAspect";
const iParentElementName = "IParentElement";
const iSubModeledElementName = "ISubModeledElement";

/**
 * The list of [[IDiagnostic]] implementation classes used by the BIS rule implementations.
 */
// tslint:disable-next-line:variable-name
export const Diagnostics = {
  /** Required message parameters: latest ECXML version. */
  SchemaXmlVersionMustBeTheLatest: Diagnostic.createSchemaDiagnosticClass<[string]>(Diagnostic.DiagnosticCode.SchemaXmlVersionMustBeTheLatest,
    "Schema ECXML Version is not the latest ECVersion, {0}."),

  /** Required message parameters: Schema full name, standard schema name. */
  SchemaReferencesOldStandardSchema: Diagnostic.createSchemaDiagnosticClass<[string, string]>(Diagnostic.DiagnosticCode.SchemaReferencesOldStandardSchema,
    "Schema '{0}' references the old standard schema '{1}'. Only new standard schemas should be used."),

  /** Required message parameters: Schema full name. */
  SchemaWithDynamicInNameMustHaveDynamicSchemaCA: Diagnostic.createSchemaDiagnosticClass<[string]>(Diagnostic.DiagnosticCode.SchemaWithDynamicInNameMustHaveDynamicSchemaCA,
    "Schema '{0}' contains 'dynamic' in the name, therefore requiring the 'CoreCA:DynamicSchema' CustomAttribute to be applied."),

  /** Required message parameters: 1st class full name, 2nd class full name, and display label */
  SchemaClassDisplayLabelMustBeUnique: Diagnostic.createSchemaDiagnosticClass<[string, string, string]>(Diagnostic.DiagnosticCode.SchemaClassDisplayLabelMustBeUnique,
    "Schema classes {0} and {1} have the same display label, '{2}'. Labels must be unique within the same schema."),

  /** Required message parameters: mixin class fullName, class fullName, applies to constraint class fullName */
  MixinsCannotOverrideInheritedProperties: Diagnostic.createSchemaItemDiagnosticClass<Mixin, [string, string]>(Diagnostic.DiagnosticCode.MixinsCannotOverrideInheritedProperties,
    "Mixin '{0}' overrides inherited property '{1}'."),

  /** Required message parameters: EntityClass fullName */
  EntityClassMustDeriveFromBisHierarchy: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(Diagnostic.DiagnosticCode.EntityClassMustDeriveFromBisHierarchy,
    "EntityClass '{0}' must derive from the BIS hierarchy."),

  /** Required message parameters: EntityClass fullName, property name, first class fullName, and second class fullName */
  EntityClassMayNotInheritSameProperty: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string, string, string, string]>(Diagnostic.DiagnosticCode.EntityClassMayNotInheritSameProperty,
    "EntityClass '{0}' inherits the property '{1}' from more than one source: '{2}', '{3}'. Entity classes may not inherit the same property from more than one class (base class or mixins)."),

  /** Required message parameters: EntityClass fullName */
  ElementMultiAspectMustHaveCorrespondingRelationship: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(Diagnostic.DiagnosticCode.ElementMultiAspectMustHaveCorrespondingRelationship,
    "The ElementMultiAspect EntityClass '{0}' requires an ElementOwnsMultiAspects relationship with this class supported as a target constraint."),

  /** Required message parameters: EntityClass fullName */
  ElementUniqueAspectMustHaveCorrespondingRelationship: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(Diagnostic.DiagnosticCode.ElementUniqueAspectMustHaveCorrespondingRelationship,
    "The ElementUniqueAspect EntityClass '{0}' requires an ElementOwnsUniqueAspect relationship with this class supported as a target constraint."),

  /** Required message parameters: EntityClass fullName */
  EntityClassesCannotDeriveFromIParentElementAndISubModeledElement: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string]>(Diagnostic.DiagnosticCode.EntityClassesCannotDeriveFromIParentElementAndISubModeledElement,
    "The EntityClass '{0}' implements both IParentElement and ISubModeledElement which is not allowed."),
};

/**
 * All schema validation rules that fall under the category of ECObjects.
 */
// tslint:disable-next-line:variable-name
export const BisRuleSet: IRuleSet = {
  name: "ECObjects Rules",
  schemaRules: [
    schemaXmlVersionMustBeTheLatest,
    schemaMustNotReferenceOldStandardSchemas,
    schemaWithDynamicInNameMustHaveDynamicSchemaCA,
    schemaClassDisplayLabelMustBeUnique,
  ],
  entityClassRules: [
    entityClassMustDeriveFromBisHierarchy,
    entityClassMayNotInheritSameProperty,
  ],
  mixinRules: [
    mixinsCannotOverrideInheritedProperties,
  ],
};

/** SCHEMA RULES
 * ************************************************************
 */

export const oldStandardSchemaNames = [
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
export async function* schemaXmlVersionMustBeTheLatest(schema: Schema): AsyncIterable<Diagnostic.SchemaDiagnostic<any []>> {
  // TODO:  Implement rule once EC version management is complete...
  if (schema)
    return true;
  const latestVersion = "";
  yield new Diagnostics.SchemaXmlVersionMustBeTheLatest(schema, [latestVersion]);
}

/**
 * BIS Rule: Schema must not reference old standard schemas.
 */
export async function* schemaMustNotReferenceOldStandardSchemas(schema: Schema): AsyncIterable<Diagnostic.SchemaDiagnostic<any []>> {
  for (const ref of schema.references) {
    if (oldStandardSchemaNames.findIndex((x) => ref.name === x) !== -1)
      yield new Diagnostics.SchemaReferencesOldStandardSchema(schema, [schema.schemaKey.toString(), ref.name]);
  }
}

/**
 * BIS Rule: Schema with 'dynamic' in the name (case-insensitive) requires the "CoreCA:Dynamic" custom attribute.
 */
export async function* schemaWithDynamicInNameMustHaveDynamicSchemaCA(schema: Schema): AsyncIterable<Diagnostic.SchemaDiagnostic<any []>> {
  if (!schema.name.toLowerCase().includes("dynamic"))
    return;

  if (!schema.customAttributes || !schema.customAttributes.has("CoreCustomAttributes.DynamicSchema")) {
    yield new Diagnostics.SchemaWithDynamicInNameMustHaveDynamicSchemaCA(schema, [schema.schemaKey.toString()]);
  }
}

/**
 * BIS Rule: Classes within the same schema cannot have the same display label.
 */
export async function* schemaClassDisplayLabelMustBeUnique(schema: Schema): AsyncIterable<Diagnostic.SchemaDiagnostic<any []>> {
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
export async function* mixinsCannotOverrideInheritedProperties(mixin: Mixin): AsyncIterable<Diagnostic.SchemaItemDiagnostic<Mixin, any []>> {
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
export async function* entityClassMustDeriveFromBisHierarchy(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any []>> {
  for await (const baseClass of entity.getAllBaseClasses()) {
    if (baseClass.schema.name === bisCoreName)
      return;
  }

  yield new Diagnostics.EntityClassMustDeriveFromBisHierarchy(entity, [entity.fullName]);
}

/**
 * BIS Rule: Entity classes may not inherit a property from more than one base class or mixin.
 */
export async function* entityClassMayNotInheritSameProperty(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any []>> {
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
export async function* elementMultiAspectMustHaveCorrespondingRelationship(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any []>> {
  const bisCore = await entity.schema.getReference(bisCoreName);
  if (!bisCore)
    return;

  const multiAspect = await bisCore.getItem(elementMultiAspectName);
  if (!multiAspect)
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${elementMultiAspectName} could not be found.`);

  if (!await entity.is(multiAspect as ECClass))
    return;

  const relationships = entity.schema.getClasses().filter((c) => c.schemaItemType === SchemaItemType.RelationshipClass);
  if (relationships.length === 0) {
    yield new Diagnostics.ElementMultiAspectMustHaveCorrespondingRelationship(entity, [entity.fullName]);
    return;
  }

  const baseRelationship = await bisCore.getItem<ECClass>(elementOwnsMultiAspectsName);
  if (!baseRelationship)
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${elementOwnsMultiAspectsName} could not be found.`);

  for (const relationship of relationships) {
    if (!await relationship.is(baseRelationship))
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
export async function* elementUniqueAspectMustHaveCorrespondingRelationship(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any []>> {
  const bisCore = await entity.schema.getReference(bisCoreName);
  if (!bisCore)
    return;

  const multiAspect = await bisCore.getItem(elementUniqueAspectName);
  if (!multiAspect)
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${elementUniqueAspectName} could not be found.`);

  if (!await entity.is(multiAspect as ECClass))
    return;

  const relationships = entity.schema.getClasses().filter((c) => c.schemaItemType === SchemaItemType.RelationshipClass);
  if (relationships.length === 0) {
    yield new Diagnostics.ElementUniqueAspectMustHaveCorrespondingRelationship(entity, [entity.fullName]);
    return;
  }

  const baseRelationship = await bisCore.getItem(elementOwnsUniqueAspectName);
  if (!baseRelationship)
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${elementOwnsUniqueAspectName} could not be found.`);

  for (const relationship of relationships) {
    if (!await relationship.is(baseRelationship as ECClass))
      continue;

    if ((relationship as RelationshipClass).target.supportsClass(entity))
      return;
  }

  yield new Diagnostics.ElementUniqueAspectMustHaveCorrespondingRelationship(entity, [entity.fullName]);
}

/**
 * BIS Rule: Entity classes cannot implement both bis:IParentElement and bis:ISubModeledElement.
 */
export async function* entityClassesCannotDeriveFromIParentElementAndISubModeledElement(entity: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any []>> {
  const bisCore = await entity.schema.getReference(bisCoreName);
  if (!bisCore)
    return;

  const iParent = await bisCore.getItem(iParentElementName);
  if (!iParent)
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${iParentElementName} could not be found.`);

  const iSubModeled = await bisCore.getItem(iSubModeledElementName);
  if (!iSubModeled)
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${iSubModeledElementName} could not be found.`);

  if (await entity.is(iParent as ECClass) && await entity.is(iSubModeled as ECClass))
    yield new Diagnostics.EntityClassesCannotDeriveFromIParentElementAndISubModeledElement(entity, [entity.fullName]);
}
