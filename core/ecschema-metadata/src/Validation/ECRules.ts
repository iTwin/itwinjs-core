/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ECStringConstants } from "../Constants";
import { ECClassModifier, PrimitiveType, primitiveTypeToString, SchemaItemType, schemaItemTypeToString } from "../ECObjects";
import { AnyClass } from "../Interfaces";
import { ECClass } from "../Metadata/Class";
import { CustomAttribute, CustomAttributeContainerProps } from "../Metadata/CustomAttribute";
import { EntityClass } from "../Metadata/EntityClass";
import { Enumeration } from "../Metadata/Enumeration";
import { Mixin } from "../Metadata/Mixin";
import { AnyProperty, PrimitiveProperty, Property } from "../Metadata/Property";
import { RelationshipClass, RelationshipConstraint } from "../Metadata/RelationshipClass";
import * as Diagnostic from "./Diagnostic";
import { IRuleSet } from "./Rules";

/**
 * The list of [[IDiagnostic]] implementation classes used by the EC rule implementations.
 */
// tslint:disable-next-line:variable-name
export const Diagnostics = {
  /** Required message parameters: childClass.FullName, baseClass.FullName */
  BaseClassIsSealed: Diagnostic.createClassDiagnosticClass<[string, string]>(Diagnostic.DiagnosticCode.BaseClassIsSealed,
    "Class '{0}' cannot derive from sealed base class '{1}'."),

  /** Required message parameters: childClass.FullName, baseClass.FullName, baseClass.schemaItemType */
  BaseClassIsOfDifferentType: Diagnostic.createClassDiagnosticClass<[string, string, string]>(Diagnostic.DiagnosticCode.BaseClassOfDifferentType,
    "Class '{0}' cannot derive from base class '{1}' of type '{2}'."),

  /** Required message parameters: childClass.FullName, property name, baseClass.FullName, base value type, child value type */
  IncompatibleValueTypePropertyOverride: Diagnostic.createPropertyDiagnosticClass<[string, string, string, string, string]>(Diagnostic.DiagnosticCode.IncompatibleValueTypePropertyOverride,
    "The ECProperty '{0}:{1}' has a base property '{2}:{1}' with a value type of {3} which is incompatible with the value type of {4}."),

  /** Required message parameters: childClass.FullName, property name, baseClass.FullName, base property type, child property type */
  IncompatibleTypePropertyOverride: Diagnostic.createPropertyDiagnosticClass<[string, string, string, string, string]>(Diagnostic.DiagnosticCode.IncompatibleTypePropertyOverride,
    "The ECProperty '{0}:{1}' has a base property '{2}:{1}' with a type of {3} which is incompatible with the type of {4}."),

  /** Required message parameters: childClass.Name, property name, baseClass.Name, baseClass Koq name, baseClass Koq persistence unit name, child class Koq persistence unit name, child class Koq name */
  IncompatibleUnitPropertyOverride: Diagnostic.createPropertyDiagnosticClass<[string, string, string, string, string, string, string]>(Diagnostic.DiagnosticCode.IncompatibleUnitPropertyOverride,
    "The ECProperty '{0}:{1}' has a base property '{2}:{1}' with KindOfQuantity '{3}' with persistence unit '{4}' which is not the same as the persistence unit '{5}' of the provided KindOfQuantity '{6}'."),

  /** Required message parameters: relationship end (source/target), relationship name */
  AtLeastOneConstraintClassDefined: Diagnostic.createRelationshipConstraintDiagnosticClass<[string, string]>(Diagnostic.DiagnosticCode.AtLeastOneConstraintClassDefined,
    "The {0}-Constraint of '{1}' does not contain any constraint classes."),

  /** Required message parameters: Enumeration name */
  InvalidEnumerationType: Diagnostic.createSchemaItemDiagnosticClass<Enumeration, [string]>(Diagnostic.DiagnosticCode.InvalidEnumerationType,
    "Enumeration '{0}' has invalid primitive type."),

  /** Required message parameters: mixin class fullName, class fullName, applies to constraint class fullName */
  MixinAppliedToClassMustDeriveFromConstraint: Diagnostic.createSchemaItemDiagnosticClass<EntityClass, [string, string, string]>(Diagnostic.DiagnosticCode.MixinAppliedToClassMustDeriveFromConstraint,
    "Mixin '{0}' cannot be applied to the class '{1}' because it does not satisfy the applies to constraint '{2}'."),

  /** Required message parameters: CustomAttribute container name and CustomAttributeClass name. */
  CustomAttributeNotOfConcreteClass: Diagnostic.createCustomAttributeContainerDiagnosticClass<[string, string]>(Diagnostic.DiagnosticCode.CustomAttributeNotOfConcreteClass,
    "The CustomAttribute container '{0}' has a CustomAttribute with the class '{1}' which is not a concrete class."),

  /** Required message parameters: abstract constraint class name, relationship end (source/target), relationship name, base relationship name */
  AbstractConstraintMustNarrowBaseConstraints: Diagnostic.createSchemaItemDiagnosticClass<RelationshipClass, [string, string, string, string]>(Diagnostic.DiagnosticCode.AbstractConstraintMustNarrowBaseConstraints,
    "The abstract constraint class '{0}' on the {1}-Constraint of '{2}' is not supported by the base class constraint in '{3}'."),

  /** Required message parameters: constraint class name, relationship end (source/target), relationship name, base relationship name */
  DerivedConstraintsMustNarrowBaseConstraints: Diagnostic.createSchemaItemDiagnosticClass<RelationshipClass, [string, string, string, string]>(Diagnostic.DiagnosticCode.DerivedConstraintsMustNarrowBaseConstraints,
    "The constraint class '{0}' on the {1}-Constraint of '{2}' is not supported by the base class constraint in '{3}'."),

  /** Required message parameters: constraint class name, relationship end (source/target), relationship name, abstract constraint class name */
  ConstraintClassesDeriveFromAbstractContraint: Diagnostic.createSchemaItemDiagnosticClass<RelationshipClass, [string, string, string, string]>(Diagnostic.DiagnosticCode.ConstraintClassesDeriveFromAbstractContraint,
    "The constraint class '{0}' on the {1}-Constraint of '{2}' is not derived from the abstract constraint class '{3}'."),
};

/** All schema validation rules that fall under the category of ECObjects. */
// tslint:disable-next-line:variable-name
export const ECRuleSet: IRuleSet = {
  name: "ECObjects Rules",
  classRules: [
    baseClassIsSealed,
    baseClassIsOfDifferentType,
  ],
  propertyRules: [
    incompatibleValueTypePropertyOverride,
    incompatibleTypePropertyOverride,
    incompatibleUnitPropertyOverride,
  ],
  relationshipRules: [
    abstractConstraintMustNarrowBaseConstraints,
    constraintClassesDeriveFromAbstractContraint,
    derivedConstraintsMustNarrowBaseConstraints,
  ],
  relationshipConstraintRules: [
    atLeastOneConstraintClassDefined,
    abstractConstraintMustExistWithMultipleConstraints,
  ],
  enumerationRules: [
    enumerationTypeUnsupported,
  ],
  entityClassRules: [
    mixinAppliedToClassMustDeriveFromConstraint,
  ],
  customAttributeInstanceRules: [
    customAttributeNotOfConcreteClass,
  ],
};

/** EC Rule: Sealed classes cannot be a base class. */
export async function* baseClassIsSealed(ecClass: AnyClass): AsyncIterable<Diagnostic.ClassDiagnostic<any []>> {
  if (!ecClass.baseClass)
    return;

  const baseClass = await ecClass.baseClass;
  // return if rule passed
  if (baseClass.modifier !== ECClassModifier.Sealed)
    return;

  yield new Diagnostics.BaseClassIsSealed(ecClass, [ecClass.fullName, baseClass!.fullName]);
}

/** EC Rule: Base and child class must be of the same type (i.e. Entity, Mixin, Relationship, etc.)  */
export async function* baseClassIsOfDifferentType(ecClass: AnyClass): AsyncIterable<Diagnostic.ClassDiagnostic<any []>>  {
  if (!ecClass.baseClass)
    return;

  const baseClass = await ecClass.baseClass;
  // return if rule passed
  if (baseClass.schemaItemType === ecClass.schemaItemType)
    return;

  const itemType = schemaItemTypeToString(baseClass.schemaItemType);
  yield new Diagnostics.BaseClassIsOfDifferentType(ecClass, [ecClass.fullName, baseClass!.fullName, itemType]);
}

/** EC Rule: When overriding a class primitive property, the child and base property must be of the same type (string, number, etc...). */
export async function* incompatibleValueTypePropertyOverride(property: AnyProperty): AsyncIterable<Diagnostic.PropertyDiagnostic<any []>> {
  if (!property.class.baseClass)
      return;

  const primitiveType = getPrimitiveType(property);
  if (!primitiveType)
    return;

  async function callback(baseClass: ECClass): Promise<Diagnostic.PropertyDiagnostic<any[]> | undefined> {
    const baseProperty = await baseClass.getProperty(property.name);
    if (!baseProperty)
      return;

    // Other rules will catch this if false, but we need to make sure
    // types match for this rule to be valid.
    if (!propertyTypesMatch(property, baseProperty))
      return;

    const baseType = getPrimitiveType(baseProperty);

    // Return if rule passed
    if (!baseType || primitiveType === baseType)
      return;

    return new Diagnostics.IncompatibleValueTypePropertyOverride(property, [property.class.fullName, property.name, baseClass.fullName, primitiveTypeToString(baseType), primitiveTypeToString(primitiveType!)]);
  }

  for await (const baseClass of property.class.getAllBaseClasses()) {
    const result = await callback(baseClass);
    if (result)
      yield result;
  }
}

/** EC Rule: When overriding a class property, the child and base property must be of the same property type (primitive, struct, enumeration, etc...). */
export async function* incompatibleTypePropertyOverride(property: AnyProperty): AsyncIterable<Diagnostic.PropertyDiagnostic<any []>> {
  if (!property.class.baseClass)
    return;

  async function callback(baseClass: ECClass): Promise<Diagnostic.PropertyDiagnostic<any[]> | undefined> {
    const baseProperty = await baseClass.getProperty(property.name);
    if (!baseProperty)
      return;

    // Return if rule passed
    if (propertyTypesMatch(property, baseProperty))
      return;

    return new Diagnostics.IncompatibleTypePropertyOverride(property, [property.class.fullName, property.name, baseClass.fullName, baseProperty.constructor.name, property.constructor.name]);
  }

  for await (const baseClass of property.class.getAllBaseClasses()) {
    const result = await callback(baseClass);
    if (result)
      yield result;
  }
}

/** EC Rule: When overriding a kindOfQuantity property, the child and base property units must be the same. */
export async function* incompatibleUnitPropertyOverride(property: AnyProperty): AsyncIterable<Diagnostic.PropertyDiagnostic<any []>> {
  if (!property.kindOfQuantity || !property.class.baseClass)
    return;

  async function callback(baseClass: ECClass): Promise<Diagnostic.PropertyDiagnostic<any[]> | undefined> {
    const baseProperty = await baseClass.getProperty(property.name);
    if (!baseProperty || !baseProperty.kindOfQuantity)
      return;

    // Other rules will catch this if false, but we need to make sure
    // types match for this rule to be valid.
    if (!propertyTypesMatch(property, baseProperty))
      return;

    const koq = await property.kindOfQuantity;
    const baseKoq = await baseProperty.kindOfQuantity;
    if (!koq || !baseKoq)
      return;

    const unit = await koq.persistenceUnit;
    const baseUnit = await baseKoq.persistenceUnit;

    if (!unit || !baseUnit)
      return;

    // return if rule passed
    if (unit.key.matches(baseUnit.key))
      return;

    return new Diagnostics.IncompatibleUnitPropertyOverride(property, [property.class.fullName, property.name, baseClass.fullName,
      baseKoq.fullName, baseUnit.fullName, unit.fullName, koq.fullName]);
  }

  for await (const baseClass of property.class.getAllBaseClasses()) {
    const result = await callback(baseClass);
    if (result)
      yield result;
  }
}

/** EC Rule: When overriding a RelationshipClass, the derived abstract constraint must narrow the base constraint classes. */
export async function* abstractConstraintMustNarrowBaseConstraints(ecClass: RelationshipClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any []>> {
  if (!ecClass.baseClass)
    return;

  const baseRelationship = await ecClass.baseClass as RelationshipClass;

  const sourceResult = await applyAbstractConstraintMustNarrowBaseConstraints(ecClass, ecClass.source, baseRelationship);
  if (sourceResult)
    yield sourceResult;
  const targetResult = await applyAbstractConstraintMustNarrowBaseConstraints(ecClass, ecClass.target, baseRelationship);
  if (targetResult)
    yield targetResult;
}

/** EC Rule: When overriding a RelationshipClass, derived constraint classes must narrow base constraint classes. */
export async function* derivedConstraintsMustNarrowBaseConstraints(ecClass: RelationshipClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any []>> {
  if (!ecClass.baseClass)
    return;

  const baseRelationship = await ecClass.baseClass as RelationshipClass;

  const sourceResult = await applyDerivedConstraintsMustNarrowBaseConstraints(ecClass, ecClass.source, baseRelationship);
  if (sourceResult)
    yield sourceResult;
  const targetResult = await applyDerivedConstraintsMustNarrowBaseConstraints(ecClass, ecClass.target, baseRelationship);
  if (targetResult)
    yield targetResult;
}

/** EC Rule: All constraint classes must have a common base class specified in the abstract constraint. */
export async function* constraintClassesDeriveFromAbstractContraint(ecClass: RelationshipClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any []>> {
  const sourceResult = await applyConstraintClassesDeriveFromAbstractContraint(ecClass, ecClass.source);
  if (sourceResult)
    yield sourceResult;
  const targetResult = await applyConstraintClassesDeriveFromAbstractContraint(ecClass, ecClass.target);
  if (targetResult)
    yield targetResult;
}

/** EC Rule: At least on concrete constraint class must be defined in the list of constraint classes. */
export async function* atLeastOneConstraintClassDefined(constraint: RelationshipConstraint): AsyncIterable<Diagnostic.RelationshipConstraintDiagnostic<any []>> {
  if (!constraint.constraintClasses || constraint.constraintClasses.length === 0) {
    const constraintType = constraint.isSource ? ECStringConstants.RELATIONSHIP_END_SOURCE : ECStringConstants.RELATIONSHIP_END_TARGET;
    yield new Diagnostics.AtLeastOneConstraintClassDefined(constraint, [constraintType, constraint.relationshipClass.fullName]);
  }
}

/** EC Rule: If multiple constraints exist, an abstract constraint must be defined. */
export async function* abstractConstraintMustExistWithMultipleConstraints(constraint: RelationshipConstraint): AsyncIterable<Diagnostic.RelationshipConstraintDiagnostic<any []>> {
  if (!constraint.constraintClasses || constraint.constraintClasses.length <= 1) {
    return;
  }

  const abstractConstraint = getAbstractConstraint(constraint);
  if (abstractConstraint)
    return;

  const constraintType = constraint.isSource ? ECStringConstants.RELATIONSHIP_END_SOURCE : ECStringConstants.RELATIONSHIP_END_TARGET;
  yield new Diagnostics.AtLeastOneConstraintClassDefined(constraint, [constraintType, constraint.relationshipClass.fullName]);
}

function propertyTypesMatch(propertyA: Property, propertyB: Property) {
  return propertyA.constructor.name === propertyB.constructor.name;
}

function getPrimitiveType(property: Property): PrimitiveType | undefined {
  if (property.isPrimitive)
    return (property as PrimitiveProperty).primitiveType;

  return undefined;
}

/** EC Rule: Enumeration type must be a string or integer */
export async function* enumerationTypeUnsupported(enumeration: Enumeration): AsyncIterable<Diagnostic.SchemaItemDiagnostic<Enumeration, any []>> {
  const type = enumeration.type;
  if (type === PrimitiveType.Integer || type === PrimitiveType.String)
    return;

  yield new Diagnostics.InvalidEnumerationType(enumeration, [enumeration.fullName]);
}

/** EC Rule: Mixin applied to class must derived from the Mixin appliesTo constraint. */
export async function* mixinAppliedToClassMustDeriveFromConstraint(entityClass: EntityClass): AsyncIterable<Diagnostic.SchemaItemDiagnostic<EntityClass, any []>>  {
  for (const lazyMixin of entityClass.mixins) {
    const mixin = await lazyMixin;
    if (!mixin.appliesTo)
      continue;

    if (!await entityClass.is(await mixin.appliesTo))
      yield new Diagnostics.MixinAppliedToClassMustDeriveFromConstraint(entityClass, [mixin.fullName, entityClass.fullName, mixin.appliesTo.fullName]);
  }

  return;
}

/** EC Rule: CustomAttribute instance must be of a concrete CustomAttributeClass. */
export async function* customAttributeNotOfConcreteClass(container: CustomAttributeContainerProps, customAttribute: CustomAttribute): AsyncIterable<Diagnostic.SchemaItemDiagnostic<CustomAttributeContainerProps, any []>> {
  const schema = container.schema;
  const caClass = await schema.lookupItem(customAttribute.className) as ECClass;
  if (!caClass)
    return;

  if (caClass.modifier !== ECClassModifier.Abstract)
    return;

  yield new Diagnostics.CustomAttributeNotOfConcreteClass(container, [container.fullName, caClass.fullName]);
}

async function applyAbstractConstraintMustNarrowBaseConstraints(ecClass: RelationshipClass, constraint: RelationshipConstraint, baseRelationship: RelationshipClass): Promise<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any []> | undefined> {
  const baseConstraint = constraint.isSource ? baseRelationship.source : baseRelationship.target;
  const abstractConstraint = await constraint.abstractConstraint;
  if (!abstractConstraint)
    return;

  if (await baseConstraint.supportsClass(abstractConstraint))
    return;

  const constraintType = constraint.isSource ? ECStringConstants.RELATIONSHIP_END_SOURCE : ECStringConstants.RELATIONSHIP_END_TARGET;
  return new Diagnostics.AbstractConstraintMustNarrowBaseConstraints(ecClass, [abstractConstraint.fullName, constraintType, constraint.relationshipClass.fullName, baseRelationship.fullName]);
}

async function applyDerivedConstraintsMustNarrowBaseConstraints(ecClass: RelationshipClass, constraint: RelationshipConstraint, baseRelationship: RelationshipClass): Promise<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any []> | undefined> {
  const baseConstraint = constraint.isSource ? baseRelationship.source : baseRelationship.target;

  if (!constraint.constraintClasses)
    return;

  for (const classPromise of constraint.constraintClasses) {
    const constraintClass = await classPromise;

    if (await baseConstraint.supportsClass(constraintClass))
      continue;

    const constraintType = constraint.isSource ? ECStringConstants.RELATIONSHIP_END_SOURCE : ECStringConstants.RELATIONSHIP_END_TARGET;
    return new Diagnostics.DerivedConstraintsMustNarrowBaseConstraints(ecClass, [constraintClass.fullName, constraintType, constraint.relationshipClass.fullName, baseRelationship.fullName]);
  }

  return;
}

async function applyConstraintClassesDeriveFromAbstractContraint(ecClass: RelationshipClass, constraint: RelationshipConstraint): Promise<Diagnostic.SchemaItemDiagnostic<RelationshipClass, any []> | undefined> {
  const abstractConstraint = await getAbstractConstraint(constraint);
  if (!abstractConstraint)
      return;

  if (!constraint.constraintClasses)
    return;

  for (const classPromise of constraint.constraintClasses) {
    const constraintClass = await classPromise;

    if (constraintClass.schemaItemType === SchemaItemType.Mixin) {
      if (abstractConstraint.schemaItemType !== SchemaItemType.EntityClass || !await(constraintClass as Mixin).applicableTo(abstractConstraint as EntityClass)) {
        const constraintType = constraint.isSource ? ECStringConstants.RELATIONSHIP_END_SOURCE : ECStringConstants.RELATIONSHIP_END_TARGET;
        return new Diagnostics.ConstraintClassesDeriveFromAbstractContraint(ecClass, [constraintClass.fullName, constraintType, constraint.relationshipClass.fullName, abstractConstraint.fullName]);
      }
      continue;
    }

    if (!await constraintClass.is(abstractConstraint)) {
      const constraintType = constraint.isSource ? ECStringConstants.RELATIONSHIP_END_SOURCE : ECStringConstants.RELATIONSHIP_END_TARGET;
      return new Diagnostics.ConstraintClassesDeriveFromAbstractContraint(ecClass, [constraintClass.fullName, constraintType, constraint.relationshipClass.fullName, abstractConstraint.fullName]);
    }
  }

  return;
}

async function getAbstractConstraint(constraint: RelationshipConstraint): Promise<ECClass | undefined> {
  const abstractConstraint = await constraint.abstractConstraint;
  if (abstractConstraint)
    return abstractConstraint;

  const baseRelationship = await constraint.relationshipClass.baseClass as RelationshipClass;
  if (!baseRelationship)
    return;

  const baseConstraint = constraint.isSource ? baseRelationship.source : baseRelationship.target;

  return getAbstractConstraint(baseConstraint);
}
