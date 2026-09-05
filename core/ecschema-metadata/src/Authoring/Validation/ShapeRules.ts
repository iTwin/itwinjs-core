/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { FormatType, ScientificType } from "@itwin/core-quantity";
import { ECClassModifier, parsePrimitiveType, PrimitiveType, PropertyKind, SchemaItemType } from "../../ECObjects";
import { ECName } from "../../ECName";
import {
  AnyPrimitiveProperty, AnyProperty, AnySchemaItem, ECClass, Enumeration, Format, KindOfQuantity, parseMultiplicity, RelationshipConstraint,
  SchemaDocument, SchemaItem, Unit,
} from "../SchemaDocument";
import { namesEqual } from "./ReferenceRules";
import { ValidationContext } from "./SchemaValidator";

/** The version component ceilings `ECVersion` can represent. A document holds plain numbers, so it
 * can be given a version no schema key could ever be built from. */
const maxReadOrWriteVersion = 999;
const maxMinorVersion = 9999999;

/** The primitive types a range (`minValue` / `maxValue`) applies to. */
const rangeablePrimitives: ReadonlySet<PrimitiveType> = new Set([PrimitiveType.Integer, PrimitiveType.Long, PrimitiveType.Double]);
/** The primitive types a length bound (`minLength` / `maxLength`) applies to. */
const lengthablePrimitives: ReadonlySet<PrimitiveType> = new Set([PrimitiveType.String, PrimitiveType.Binary]);

/** The extended type names EC gives meaning to. An unrecognized one is carried through everything
 * faithfully and understood by nothing. `URI` is in the list because released BIS schemas use it;
 * native's allowlist has only the first three. */
const knownExtendedTypes: ReadonlyArray<string> = ["BeGuid", "GeometryStream", "Json", "URI"];

/** The format types the EC schema specification serializes. `FormatType` comes from the quantity
 * formatting library and has members beyond what a schema `Format` item can hold. */
const specFormatTypes: ReadonlySet<FormatType> = new Set([FormatType.Decimal, FormatType.Fractional, FormatType.Scientific, FormatType.Station]);

/** Schema identity: name, alias, version components, and that no two items share a name.
 * @internal
 */
export function checkSchemaShape(document: SchemaDocument, context: ValidationContext): void {
  if (!ECName.validate(document.name))
    context.error("schema-name-invalid", `"${document.name}" is not a valid EC name.`);

  if (document.alias.length === 0)
    context.error("schema-alias-missing", `Schema "${document.name}" has no alias.`);
  else if (!ECName.validate(document.alias))
    context.error("schema-alias-invalid", `The schema alias "${document.alias}" is not a valid EC name.`);

  checkVersionComponent(document.readVersion, "read", maxReadOrWriteVersion, context);
  checkVersionComponent(document.writeVersion, "write", maxReadOrWriteVersion, context);
  checkVersionComponent(document.minorVersion, "minor", maxMinorVersion, context);

  // EC compares item names case-insensitively across kinds, so a Phenomenon named LENGTH and a
  // KindOfQuantity named Length collide and only the first of them ever resolves.
  const byName = new Map<string, AnySchemaItem>();
  for (const item of document.items) {
    const incumbent = byName.get(item.name.toLowerCase());
    if (incumbent !== undefined) {
      context.issues.addError("schema-item-name-duplicate",
        `"${document.name}" declares "${item.name}" twice (as ${incumbent.schemaItemType} and as ${item.schemaItemType}); item names are unique across all kinds, so only the first resolves.`,
        item.fullName);
    } else {
      byName.set(item.name.toLowerCase(), item);
    }
  }
}

function checkVersionComponent(value: number, component: string, maximum: number, context: ValidationContext): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum)
    context.error("schema-version-invalid", `The ${component} version component is ${value}; it must be a whole number between 0 and ${maximum}.`);
}

/** Every schema item's name.
 * @internal
 */
export function checkItemName(item: SchemaItem, context: ValidationContext): void {
  if (!ECName.validate(item.name))
    context.error("item-name-invalid", `"${item.name}" is not a valid EC name.`);
}

/** Class-level shape: the modifier, and that no two properties share a name.
 * @internal
 */
export function checkClassShape(ecClass: ECClass, context: ValidationContext): void {
  if (ecClass.modifier !== undefined && ECClassModifier[ecClass.modifier] === undefined)
    context.error("class-modifier-invalid", `The modifier of "${ecClass.name}" is ${ecClass.modifier}, which is not a class modifier.`);

  const byName = new Set<string>();
  for (const property of ecClass.properties) {
    const key = property.name.toLowerCase();
    if (byName.has(key)) {
      context.issues.addError("class-property-name-duplicate",
        `"${ecClass.fullName}" declares the property "${property.name}" twice; property names are unique within a class, so only the first resolves.`,
        property.fullName);
    }
    byName.add(key);
  }
}

/** Property shape: the type keyword, the value and length bounds, array occurrences, and whether
 * the fields carried actually apply to this property kind.
 * @internal
 */
export function checkProperty(property: AnyProperty, context: ValidationContext): void {
  if (!ECName.validate(property.name))
    context.error("property-name-invalid", `"${property.name}" is not a valid EC name.`);

  if (property.isPrimitive())
    checkPrimitiveProperty(property, context);

  if (property.isArray()) {
    if (!Number.isInteger(property.minOccurs) || property.minOccurs < 0)
      context.error("property-min-occurs-invalid", `minOccurs is ${property.minOccurs}; it must be a whole number of zero or more.`);
    if (property.maxOccurs !== undefined && property.maxOccurs < property.minOccurs)
      context.error("property-occurs-inverted", `maxOccurs (${property.maxOccurs}) is below minOccurs (${property.minOccurs}).`);
  }

  if (property.kindOfQuantity !== undefined && !property.isPrimitive()) {
    context.warning("property-kind-of-quantity-not-applicable",
      `A ${PropertyKind[property.kind]} property carries a kind of quantity, which only applies to primitive values.`);
  }
}

function checkPrimitiveProperty(property: AnyPrimitiveProperty, context: ValidationContext): void {
  const primitiveType = parsePrimitiveType(property.typeName);
  // An unparseable type name is an enumeration reference; the reference check reports it if it is
  // not one. Only the shape of the bounds is this rule's business.
  if (primitiveType === undefined)
    return;

  const extendedTypeName = property.extendedTypeName;
  if (extendedTypeName !== undefined && !knownExtendedTypes.some((known) => namesEqual(known, extendedTypeName))) {
    context.warning("property-extended-type-unknown",
      `The extended type "${extendedTypeName}" is not one EC gives meaning to (${knownExtendedTypes.join(", ")}).`);
  }

  checkBounds(property.minValue, property.maxValue, "minValue", "maxValue", "property-value-range", primitiveType, rangeablePrimitives, context);
  checkBounds(property.minLength, property.maxLength, "minLength", "maxLength", "property-length-range", primitiveType, lengthablePrimitives, context);
}

function checkBounds(minimum: number | undefined, maximum: number | undefined, minField: string, maxField: string, name: string,
  primitiveType: PrimitiveType, applicableTo: ReadonlySet<PrimitiveType>, context: ValidationContext): void {
  if (minimum === undefined && maximum === undefined)
    return;
  if (!applicableTo.has(primitiveType)) {
    context.warning(`${name}-not-applicable`,
      `${minField}/${maxField} were given on a ${primitiveTypeName(primitiveType)} property, which they do not apply to.`);
    return;
  }
  if (minimum !== undefined && maximum !== undefined && maximum < minimum)
    context.error(`${name}-inverted`, `${maxField} (${maximum}) is below ${minField} (${minimum}).`);
}

function primitiveTypeName(primitiveType: PrimitiveType): string {
  return PrimitiveType[primitiveType] ?? `${primitiveType}`;
}

/** Enumeration shape: the backing type, and enumerator names, values, and uniqueness.
 * @internal
 */
export function checkEnumeration(enumeration: Enumeration, context: ValidationContext): void {
  if (enumeration.backingType !== "int" && enumeration.backingType !== "string") {
    context.error("enumeration-backing-type-invalid",
      `The backing type is "${String(enumeration.backingType)}"; an enumeration is backed by "int" or "string".`, "ECObjects-700");
    return;
  }

  const expectedValueType = enumeration.backingType === "int" ? "number" : "string";
  const names = new Set<string>();
  const values = new Set<number | string>();
  for (const enumerator of enumeration.enumerators) {
    // Pre-3.2 sources carry no enumerator names; the readers synthesize one, so a missing name here
    // means the enumeration was built in code.
    if (context.dialect.enumeratorNames && !ECName.validate(enumerator.name))
      context.error("enumeration-enumerator-name-invalid", `The enumerator name "${enumerator.name}" is not a valid EC name.`);

    if (names.has(enumerator.name.toLowerCase()))
      context.error("enumeration-enumerator-name-duplicate", `The enumerator name "${enumerator.name}" is declared more than once.`);
    names.add(enumerator.name.toLowerCase());

    if (typeof enumerator.value !== expectedValueType) {
      context.error("enumeration-enumerator-value-type-mismatch",
        `The enumerator "${enumerator.name}" has a ${typeof enumerator.value} value, but the enumeration is backed by "${enumeration.backingType}".`);
      continue;
    }
    if (values.has(enumerator.value))
      context.error("enumeration-enumerator-value-duplicate", `The value ${JSON.stringify(enumerator.value)} is declared by more than one enumerator.`);
    values.add(enumerator.value);
  }
}

/** Kind of quantity shape: the relative error, and duplicate presentation formats.
 * @internal
 */
export function checkKindOfQuantity(kindOfQuantity: KindOfQuantity, context: ValidationContext): void {
  if (!Number.isFinite(kindOfQuantity.relativeError) || kindOfQuantity.relativeError < 0)
    context.error("koq-relative-error-invalid", `relativeError is ${kindOfQuantity.relativeError}; it must be a number of zero or more.`);

  const seen = new Set<string>();
  for (const presentationFormat of kindOfQuantity.presentationFormats) {
    const key = presentationFormat.replaceAll(".", ":").toLowerCase();
    if (seen.has(key))
      context.error("koq-presentation-format-duplicate", `The presentation format "${presentationFormat}" is listed more than once.`);
    seen.add(key);
  }
}

/** Unit shape: the definition and the conversion factor.
 * @internal
 */
export function checkUnit(unit: Unit, context: ValidationContext): void {
  if (unit.definition.length === 0)
    context.error("unit-definition-missing", `Unit "${unit.name}" has no definition.`);
  if (unit.denominator === 0)
    context.error("unit-denominator-zero", `Unit "${unit.name}" has a denominator of zero.`);
}

/** Format shape: the type, the fields that type requires, and the composite.
 * @internal
 */
export function checkFormat(format: Format, context: ValidationContext): void {
  if (!specFormatTypes.has(format.type)) {
    context.error("format-type-not-in-spec",
      `The format type ${FormatType[format.type] ?? format.type} belongs to the quantity formatting library; an EC schema format is ${[...specFormatTypes].map((type) => FormatType[type]).join(", ")}.`);
  }

  if (format.type === FormatType.Scientific && format.scientificType === undefined)
    context.error("format-scientific-type-missing", `A scientific format must declare a scientificType (${Object.keys(ScientificType).filter((key) => isNaN(Number(key))).join(", ")}).`);
  if (format.type === FormatType.Station && format.stationOffsetSize === undefined)
    context.error("format-station-offset-size-missing", `A station format must declare a stationOffsetSize.`);

  const composite = format.composite;
  if (composite === undefined)
    return;
  if (composite.units.length === 0 || composite.units.length > 4)
    context.error("format-composite-unit-count-invalid", `A composite declares one to four units, not ${composite.units.length}.`);

  const seen = new Set<string>();
  for (const unit of composite.units) {
    const key = unit.name.replaceAll(".", ":").toLowerCase();
    if (seen.has(key))
      context.error("format-composite-unit-duplicate", `The composite names the unit "${unit.name}" more than once.`);
    seen.add(key);
  }
}

/** Relationship constraint shape: the multiplicity string, and the role label the spec requires
 * from EC 3.1 on.
 * @internal
 */
export function checkRelationshipConstraintShape(constraint: RelationshipConstraint, context: ValidationContext): void {
  const bounds = parseMultiplicity(constraint.multiplicity);
  if (bounds === undefined) {
    context.error("relationship-constraint-multiplicity-invalid",
      `"${constraint.multiplicity}" is not a multiplicity; the form is "(lower..upper)", with upper a number or "*".`);
  } else if (bounds.upperLimit !== undefined && bounds.upperLimit < bounds.lowerLimit) {
    context.error("relationship-constraint-multiplicity-inverted",
      `The multiplicity "${constraint.multiplicity}" has an upper bound below its lower bound.`);
  }

  // Required from EC 3.1; a constraint of a derived relationship may take its base's instead.
  if (context.dialect.abstractConstraint && constraint.roleLabel === undefined && inheritedRoleLabel(constraint) === undefined)
    context.error("relationship-constraint-role-label-missing", `The constraint has no roleLabel and inherits none.`);
}

function inheritedRoleLabel(constraint: RelationshipConstraint): string | undefined {
  const visited = new Set<SchemaItem>();
  let current = constraint.relationshipClass.getBaseClass();
  while (current !== undefined && current.schemaItemType === SchemaItemType.RelationshipClass && !visited.has(current)) {
    visited.add(current);
    const inherited = current.source.relationshipEnd === constraint.relationshipEnd ? current.source : current.target;
    if (inherited.roleLabel !== undefined)
      return inherited.roleLabel;
    current = current.getBaseClass();
  }
  return undefined;
}
