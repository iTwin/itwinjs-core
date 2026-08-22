/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ECClassModifier, parsePrimitiveType, PropertyKind, SchemaItemType, StrengthDirection } from "../../ECObjects";
import {
  AnyProperty, CustomAttributeClass, ECClass, EntityClass, Mixin, NavigationProperty, parseMultiplicity, RelationshipConstraint, StructClass,
} from "../SchemaDocument";
import { namesEqual } from "./ReferenceRules";
import { ValidationContext } from "./SchemaValidator";

/** The property names ECSQL reserves. A class carrying one of them cannot be imported into an
 * ECDb, because the name would collide with the system property of the same name. */
const systemPropertyNames: ReadonlyArray<string> = ["ECInstanceId", "Id", "ECClassId"];
const relationshipSystemPropertyNames: ReadonlyArray<string> = [
  "SourceECInstanceId", "SourceId", "SourceECClassId", "TargetECInstanceId", "TargetId", "TargetECClassId",
];

/** Base-class rules every class kind shares: the base must be of the same kind, must not be sealed,
 * and must not lead back to the class itself.
 * @internal
 */
export function checkClassInheritance(ecClass: ECClass, context: ValidationContext): void {
  const baseClass = ecClass.getBaseClass();
  if (baseClass === undefined)
    return;

  if (baseClass.schemaItemType !== ecClass.schemaItemType) {
    context.error("class-base-kind-mismatch",
      `"${ecClass.name}" is a ${ecClass.schemaItemType} but its base class "${baseClass.fullName}" is a ${baseClass.schemaItemType}.`, "ECObjects-101");
    return;
  }

  if (baseClass.modifier === ECClassModifier.Sealed)
    context.error("class-base-sealed", `The base class "${baseClass.fullName}" is sealed and cannot be derived from.`, "ECObjects-100");

  if (findInheritanceCycle(ecClass) !== undefined) {
    context.error("class-base-cycle",
      `The base class chain of "${ecClass.name}" leads back to itself, so its inherited properties cannot be resolved.`);
  }
}

/** Entity rules: a property may not arrive from two independent sources, and every applied mixin
 * must accept this class.
 * @internal
 */
export function checkEntityInheritance(entity: EntityClass, context: ValidationContext): void {
  checkMixinsApply(entity, context);
  checkSingleInheritedSource(entity, context);
}

function checkMixinsApply(entity: EntityClass, context: ValidationContext): void {
  for (const mixin of entity.getMixins()) {
    if (mixin === undefined)
      continue; // unresolved: already reported by the reference check
    const appliesTo = mixin.getAppliesTo();
    if (appliesTo !== undefined && !derivesFrom(entity, appliesTo)) {
      context.error("entity-mixin-not-applicable",
        `The mixin "${mixin.fullName}" applies to "${appliesTo.fullName}", which "${entity.name}" does not derive from.`, "ECObjects-1100");
    }
  }
}

/** A name reachable through the base class and through a mixin - or through two mixins - has two
 * independent declarations and no override relationship between them, so which one wins is
 * arbitrary. Property expansion keeps the first branch; ECDb rejects the schema outright. */
function checkSingleInheritedSource(entity: EntityClass, context: ValidationContext): void {
  const branches: Array<{ source: ECClass, names: Set<string> }> = [];
  for (const branch of [entity.getBaseClass(), ...entity.getMixins()]) {
    if (branch === undefined)
      continue;
    branches.push({ source: branch, names: new Set(context.getExpandedProperties(branch).map((property) => property.name.toLowerCase())) });
  }

  for (let index = 1; index < branches.length; ++index) {
    for (const earlier of branches.slice(0, index)) {
      for (const name of branches[index].names) {
        if (earlier.names.has(name)) {
          context.error("entity-property-inherited-twice",
            `"${entity.name}" inherits a property named "${name}" from both "${earlier.source.fullName}" and "${branches[index].source.fullName}"; a property may only come from one of them.`,
            "BIS-602");
        }
      }
    }
  }
}

/** Mixin rules: a mixin declares properties, it does not override them.
 * @internal
 */
export function checkMixin(mixin: Mixin, context: ValidationContext): void {
  const baseClass = mixin.getBaseClass();
  if (baseClass === undefined)
    return;
  for (const property of mixin.properties) {
    if (baseClass.getExpandedProperty(property.name) !== undefined) {
      context.issues.addError("mixin-property-overrides-base",
        `The mixin property "${property.name}" overrides one of "${baseClass.fullName}"; a mixin may not override an inherited property.`,
        property.fullName, "BIS-1100");
    }
  }
}

/** A struct class may not have a base class.
 * @internal
 */
export function checkStructClass(structClass: StructClass, context: ValidationContext): void {
  if (structClass.baseClass !== undefined)
    context.error("struct-base-not-allowed", `Struct class "${structClass.name}" has a base class; struct classes do not inherit.`, "BIS-1700");
}

/** A custom attribute class may not have a base class.
 * @internal
 */
export function checkCustomAttributeClass(customAttributeClass: CustomAttributeClass, context: ValidationContext): void {
  if (customAttributeClass.baseClass !== undefined) {
    context.error("custom-attribute-class-base-not-allowed",
      `Custom attribute class "${customAttributeClass.name}" has a base class; custom attribute classes do not inherit.`, "BIS-400");
  }
  if (Number(customAttributeClass.appliesTo) === 0)
    context.error("custom-attribute-class-applies-to-nothing", `Custom attribute class "${customAttributeClass.name}" declares no container kind it applies to.`);
}

/** A property that overrides an inherited one may change its label, description, category and
 * priority, and nothing about its type.
 * @internal
 */
export function checkPropertyOverride(property: AnyProperty, context: ValidationContext): void {
  const baseProperty = property.getBaseProperty();
  if (baseProperty === undefined)
    return;

  if (baseProperty.kind !== property.kind) {
    context.error("property-override-kind-mismatch",
      `"${property.name}" overrides a ${PropertyKind[baseProperty.kind]} property of "${baseProperty.declaringClass.fullName}" as a ${PropertyKind[property.kind]} property.`,
      "ECObjects-1301");
    return;
  }

  const overriddenType = describeValueType(baseProperty);
  const ownType = describeValueType(property);
  if (overriddenType !== ownType) {
    context.error("property-override-type-mismatch",
      `"${property.name}" is a ${ownType} but overrides a ${overriddenType} property of "${baseProperty.declaringClass.fullName}".`, "ECObjects-1300");
  }

  const ownUnit = property.getKindOfQuantity()?.persistenceUnit;
  const baseUnit = baseProperty.getKindOfQuantity()?.persistenceUnit;
  if (ownUnit !== undefined && baseUnit !== undefined && !namesEqual(foldReference(ownUnit), foldReference(baseUnit))) {
    context.error("property-override-persistence-unit-mismatch",
      `"${property.name}" persists in "${ownUnit}" but overrides a property of "${baseProperty.declaringClass.fullName}" that persists in "${baseUnit}".`,
      "ECObjects-1302");
  }
}

/** The value type as a comparable string. A resolved reference is compared by identity through its
 * full name, so an alias-qualified and a schema-qualified spelling of the same item agree. */
function describeValueType(property: AnyProperty): string {
  switch (property.kind) {
    case PropertyKind.Primitive:
    case PropertyKind.PrimitiveArray: {
      const primitiveType = parsePrimitiveType(property.typeName);
      if (primitiveType !== undefined)
        return property.typeName.toLowerCase();
      return property.getEnumeration()?.fullName.toLowerCase() ?? foldReference(property.typeName);
    }
    case PropertyKind.Struct:
    case PropertyKind.StructArray:
      return property.getStructClass()?.fullName.toLowerCase() ?? foldReference(property.typeName);
    case PropertyKind.Navigation:
      return property.getRelationshipClass()?.fullName.toLowerCase() ?? foldReference(property.relationshipName);
  }
}

function foldReference(reference: string): string {
  return reference.replaceAll(".", ":").toLowerCase();
}

/** Navigation property rules: the relationship must be a root relationship, the class must be at
 * the end the direction says, and the other end must hold at most one instance.
 * @internal
 */
export function checkNavigationProperty(property: NavigationProperty, context: ValidationContext): void {
  const relationship = property.getRelationshipClass();
  if (relationship === undefined)
    return; // unresolved: already reported by the reference check

  if (relationship.baseClass !== undefined) {
    context.error("property-navigation-relationship-not-root",
      `"${property.name}" traverses "${relationship.fullName}", which derives from another relationship; a navigation property names the root relationship.`,
      "ECObjects-1303");
  }

  const forward = property.direction === StrengthDirection.Forward;
  const nearEnd = forward ? relationship.source : relationship.target;
  const farEnd = forward ? relationship.target : relationship.source;

  if (!constraintSupports(nearEnd, property.declaringClass)) {
    context.error("property-navigation-class-not-constrained",
      `"${property.declaringClass.fullName}" declares a navigation property traversing "${relationship.fullName}" ${forward ? "forward" : "backward"}, but it is not a ${forward ? "source" : "target"} constraint class of that relationship.`,
      "ECObjects-1306");
  }

  const farAbstract = farEnd.getAbstractConstraint();
  if (farAbstract !== undefined && farAbstract.schemaItemType === SchemaItemType.RelationshipClass) {
    context.error("property-navigation-target-is-relationship",
      `"${property.name}" navigates to a constraint whose abstract constraint is the relationship class "${farAbstract.fullName}"; it must be an entity class or a mixin.`,
      "ECObjects-1305");
  }

  const farBounds = parseMultiplicity(farEnd.multiplicity);
  if (farBounds !== undefined && farBounds.upperLimit !== 1) {
    context.error("property-navigation-target-not-singular",
      `"${property.name}" navigates to an end with multiplicity "${farEnd.multiplicity}"; a navigation property holds one instance, so that end may hold at most one.`,
      "ECObjects-1304");
  }
}

/** ECSQL reserves a handful of property names on every non-struct class.
 * @internal
 */
export function checkSystemPropertyName(property: AnyProperty, context: ValidationContext): void {
  const declaringClass = property.declaringClass;
  if (declaringClass.schemaItemType === SchemaItemType.StructClass)
    return;

  const reserved = declaringClass.schemaItemType === SchemaItemType.RelationshipClass
    ? [...systemPropertyNames, ...relationshipSystemPropertyNames]
    : systemPropertyNames;
  if (reserved.some((name) => namesEqual(name, property.name))) {
    context.error("property-name-reserved",
      `"${property.name}" is the name of an ECSQL system property, so this schema cannot be imported into an iModel.`, "ECDb_0298");
  }
}

/** A struct that contains itself, at any depth, cannot be stored.
 * @internal
 */
export function checkStructPropertyRecursion(property: AnyProperty, context: ValidationContext): void {
  if (!property.isStruct() || property.declaringClass.schemaItemType !== SchemaItemType.StructClass)
    return;
  const structClass = property.getStructClass();
  if (structClass !== undefined && containsStruct(structClass, property.declaringClass as StructClass, new Set())) {
    context.error("property-struct-recursive",
      `"${property.name}" is of struct type "${structClass.fullName}", which contains "${property.declaringClass.fullName}" again.`, "ECDb_0299");
  }
}

function containsStruct(candidate: StructClass, target: StructClass, visited: Set<StructClass>): boolean {
  if (candidate === target)
    return true;
  if (visited.has(candidate))
    return false;
  visited.add(candidate);
  for (const property of candidate.properties) {
    if (!property.isStruct())
      continue;
    const structClass = property.getStructClass();
    if (structClass !== undefined && containsStruct(structClass, target, visited))
      return true;
  }
  return false;
}

/** Relationship constraint rules: it must name classes, name an abstract constraint exactly when it
 * needs one, name each class once, and stay within what the base relationship's constraint allows.
 * @internal
 */
export function checkRelationshipConstraintStructure(constraint: RelationshipConstraint, context: ValidationContext): void {
  if (constraint.constraintClasses.length === 0) {
    context.error("relationship-constraint-no-class", `The constraint names no constraint class; at least one is required.`, "ECObjects-1600");
    return;
  }

  checkConstraintClasses(constraint, context);
  checkAbstractConstraint(constraint, context);
  checkConstraintNarrowsBase(constraint, context);
}

function checkConstraintClasses(constraint: RelationshipConstraint, context: ValidationContext): void {
  const seen = new Set<string>();
  const abstractConstraint = constraint.getAbstractConstraint();

  for (const [index, reference] of constraint.constraintClasses.entries()) {
    const key = foldReference(reference);
    if (seen.has(key))
      context.error("relationship-constraint-class-duplicate", `The constraint names "${reference}" more than once.`, "ECDb_0296");
    seen.add(key);

    if (namesEqual(key.split(":").pop() ?? "", "AnyClass"))
      context.error("relationship-constraint-any-class", `"${reference}" cannot be used as a constraint class; name the classes the relationship actually relates.`, "ECDb_0295");

    const constraintClass = constraint.getConstraintClasses()[index];
    if (constraintClass === undefined)
      continue; // unresolved: already reported by the reference check

    if (constraint.polymorphic === false && constraintClass.modifier === ECClassModifier.Abstract) {
      context.error("relationship-constraint-class-abstract",
        `The constraint is not polymorphic, so its constraint class "${constraintClass.fullName}" may not be abstract.`, "ECObjects-1602");
    }

    if (abstractConstraint !== undefined && !satisfiesConstraintClass(constraintClass, abstractConstraint)) {
      context.error("relationship-constraint-class-outside-abstract",
        `The constraint class "${constraintClass.fullName}" does not derive from the abstract constraint "${abstractConstraint.fullName}".`, "ECObjects-1502");
    }
  }
}

function checkAbstractConstraint(constraint: RelationshipConstraint, context: ValidationContext): void {
  const hasOwn = constraint.abstractConstraint !== undefined;
  if (constraint.constraintClasses.length > 1) {
    if (!hasOwn && inheritedAbstractConstraint(constraint) === undefined) {
      context.error("relationship-constraint-abstract-required",
        `The constraint names ${constraint.constraintClasses.length} classes, so it must declare the abstract constraint they share.`, "ECObjects-1601");
    }
    return;
  }
  if (hasOwn) {
    context.warning("relationship-constraint-abstract-redundant",
      `The constraint declares an abstract constraint next to its single constraint class, where it carries no information.`, "BIS-1503");
  }
}

/** A derived relationship may restrict its base's constraints; it may not widen them. */
function checkConstraintNarrowsBase(constraint: RelationshipConstraint, context: ValidationContext): void {
  const baseRelationship = constraint.relationshipClass.getBaseClass();
  if (baseRelationship === undefined || baseRelationship.schemaItemType !== SchemaItemType.RelationshipClass)
    return;
  const baseConstraint = baseRelationship.source.relationshipEnd === constraint.relationshipEnd ? baseRelationship.source : baseRelationship.target;
  if (baseConstraint.constraintClasses.length === 0)
    return;

  for (const constraintClass of constraint.getConstraintClasses()) {
    if (constraintClass !== undefined && !constraintSupports(baseConstraint, constraintClass)) {
      context.error("relationship-constraint-class-widens-base",
        `The constraint class "${constraintClass.fullName}" is not supported by the corresponding constraint of the base relationship "${baseRelationship.fullName}".`,
        "ECObjects-1501");
    }
  }

  const abstractConstraint = constraint.getAbstractConstraint();
  if (abstractConstraint !== undefined && !constraintSupports(baseConstraint, abstractConstraint)) {
    context.error("relationship-constraint-abstract-widens-base",
      `The abstract constraint "${abstractConstraint.fullName}" is not supported by the corresponding constraint of the base relationship "${baseRelationship.fullName}".`,
      "ECObjects-1500");
  }

  if (constraint.polymorphic !== false && baseConstraint.polymorphic === false) {
    context.error("relationship-constraint-polymorphic-widens-base",
      `The constraint is polymorphic, but the corresponding constraint of the base relationship "${baseRelationship.fullName}" is not.`);
  }

  const bounds = parseMultiplicity(constraint.multiplicity);
  const baseBounds = parseMultiplicity(baseConstraint.multiplicity);
  if (bounds === undefined || baseBounds === undefined)
    return;
  const widensLower = bounds.lowerLimit < baseBounds.lowerLimit;
  const widensUpper = baseBounds.upperLimit !== undefined && (bounds.upperLimit === undefined || bounds.upperLimit > baseBounds.upperLimit);
  if (widensLower || widensUpper) {
    context.error("relationship-constraint-multiplicity-widens-base",
      `The multiplicity "${constraint.multiplicity}" is wider than the "${baseConstraint.multiplicity}" of the base relationship "${baseRelationship.fullName}".`);
  }
}

/** The abstract constraint a constraint takes from the base relationship's corresponding end. */
function inheritedAbstractConstraint(constraint: RelationshipConstraint): string | undefined {
  const visited = new Set<ECClass>();
  let current = constraint.relationshipClass.getBaseClass();
  while (current !== undefined && current.schemaItemType === SchemaItemType.RelationshipClass && !visited.has(current)) {
    visited.add(current);
    const end = current.source.relationshipEnd === constraint.relationshipEnd ? current.source : current.target;
    if (end.abstractConstraint !== undefined)
      return end.abstractConstraint;
    current = current.getBaseClass();
  }
  return undefined;
}

/** Whether a constraint accepts instances of a class: it is, or derives from, the abstract
 * constraint when there is one, or one of the constraint classes otherwise. A non-polymorphic
 * constraint accepts only the classes it names.
 * @internal
 */
export function constraintSupports(constraint: RelationshipConstraint, ecClass: ECClass): boolean {
  const abstractConstraint = constraint.getAbstractConstraint();
  if (abstractConstraint !== undefined)
    return satisfiesConstraintClass(ecClass, abstractConstraint);
  return constraint.getConstraintClasses().some((constraintClass) =>
    constraintClass !== undefined && (constraint.polymorphic === false ? constraintClass === ecClass : satisfiesConstraintClass(ecClass, constraintClass)));
}

/** Whether a class named as a constraint class satisfies another class named there.
 *
 * Beyond ordinary derivation, a **mixin** named as a constraint class stands for the entity classes
 * it is applied to, so it satisfies whatever its `appliesTo` entity class satisfies. That is what
 * lets a relationship constrained to `BisCore:Element` be narrowed by a derived relationship to a
 * mixin applying to `Element`, which released BIS schemas do.
 * @internal
 */
export function satisfiesConstraintClass(candidate: ECClass, target: ECClass): boolean {
  if (derivesFrom(candidate, target))
    return true;
  if (candidate.schemaItemType !== SchemaItemType.Mixin)
    return false;
  const appliesTo = (candidate as Mixin).getAppliesTo();
  return appliesTo !== undefined && derivesFrom(appliesTo, target);
}

/** Whether `candidate` is `target` or reaches it through its base classes or applied mixins.
 * Terminates on a cycle, which is reported separately.
 * @internal
 */
export function derivesFrom(candidate: ECClass, target: ECClass, visited: Set<ECClass> = new Set()): boolean {
  if (candidate === target)
    return true;
  if (visited.has(candidate))
    return false;
  visited.add(candidate);

  const baseClass = candidate.getBaseClass();
  if (baseClass !== undefined && derivesFrom(baseClass, target, visited))
    return true;
  if (candidate.isEntity()) {
    for (const mixin of candidate.getMixins()) {
      if (mixin !== undefined && derivesFrom(mixin, target, visited))
        return true;
    }
  }
  return false;
}

/** The class a base-class chain revisits, or `undefined` when it terminates. Only the base chain
 * takes part: a mixin is a separate branch and cannot make a class its own ancestor. */
function findInheritanceCycle(ecClass: ECClass): ECClass | undefined {
  const visited = new Set<ECClass>([ecClass]);
  let current = ecClass.getBaseClass();
  while (current !== undefined) {
    if (visited.has(current))
      return current;
    visited.add(current);
    current = current.getBaseClass();
  }
  return undefined;
}
