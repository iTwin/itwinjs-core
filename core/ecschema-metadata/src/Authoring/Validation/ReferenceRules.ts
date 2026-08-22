/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { AbstractSchemaItemType, CustomAttributeContainerType, ECClassModifier, isSupportedSchemaItemType, PropertyKind, SchemaItemType } from "../../ECObjects";
import { ECName } from "../../ECName";
import { resolveCustomAttributeClass } from "../CustomAttributeConverter";
import {
  AnyProperty, AnySchemaItem, CustomAttributeContainer, CustomAttributeSet, LocalOrFullName, Property, RelationshipConstraint, SchemaDocument,
  SchemaItem, SchemaReference,
} from "../SchemaDocument";
import { mapFormatStringReferences } from "../SchemaDocumentIO";
import { SchemaIssueSeverity } from "../SchemaIssues";
import { ValidationContext } from "./SchemaValidator";

/** The kind, or group of kinds, a reference field is allowed to point at. */
type ExpectedKind = SchemaItemType | AbstractSchemaItemType;

/** Anything the walker resolves references out of. Only some of these carry custom attributes,
 * which is why the deprecation check tolerates their absence.
 * @internal
 */
export type ReferencingConstruct = AnySchemaItem | AnyProperty | RelationshipConstraint;

/** A construct that may or may not carry custom attributes - every item kind is one, but only
 * classes, properties, constraints, and the schema itself hold any. */
type DeprecationCandidate = SchemaDocument | SchemaItem | Property | RelationshipConstraint;

/** One place a construct names another schema item. Every resolving accessor on the model
 * (`getBaseClass`, `getMixins`, `getPersistenceUnit`, ...) has a site here, so a dangling or
 * mistyped reference is found by one check instead of by one check per accessor.
 * @internal
 */
export interface ReferenceSite {
  /** Which field, including the index for list-valued ones (`"mixins[1]"`). Named in the message,
   * since the issue's location identifies the construct. */
  field: string;
  /** The stored reference string. */
  value: LocalOrFullName;
  /** The kinds the reference may point at. */
  expected: ReadonlyArray<ExpectedKind>;
  /** Writes a new reference string back to the field this site came from. Validation never calls
   * it; it exists so a caller that renames an item can repoint the references to it using the same
   * table that enumerates them, rather than a second list that would drift from this one. For a
   * reference embedded in a presentation format string, this rewrites just that reference and
   * leaves the rest of the format spec alone. */
  set: (value: LocalOrFullName) => void;
}

/** The item kinds that are moving out of schemas and into the external units and formats framework.
 * A reference to one of these that does not resolve is a warning: the same identifier is expected to
 * resolve against that framework, which the schema set knows nothing about. */
const unitsAndFormatsKinds: ReadonlySet<ExpectedKind> = new Set([
  SchemaItemType.Unit, SchemaItemType.InvertedUnit, SchemaItemType.Constant,
  SchemaItemType.Phenomenon, SchemaItemType.UnitSystem, SchemaItemType.Format,
]);

/** The reference sites of one construct, in declaration order.
 *
 * This is the whole table of cross-item references the model holds. A field added to the model
 * without a row here is a reference nothing validates, which a drift test asserts against.
 * @internal
 */
export function* collectReferenceSites(construct: ReferencingConstruct): Iterable<ReferenceSite> {
  if (construct instanceof RelationshipConstraint) {
    if (construct.abstractConstraint !== undefined)
      yield { field: "abstractConstraint", value: construct.abstractConstraint, expected: [AbstractSchemaItemType.Class], set: (v) => construct.abstractConstraint = v };
    for (const [index, constraintClass] of construct.constraintClasses.entries())
      yield { field: `constraintClasses[${index}]`, value: constraintClass, expected: [AbstractSchemaItemType.Class], set: (v) => construct.constraintClasses[index] = v };
    return;
  }

  if (construct instanceof SchemaItem) {
    yield* collectItemReferenceSites(construct);
    return;
  }

  if (construct.category !== undefined)
    yield { field: "category", value: construct.category, expected: [SchemaItemType.PropertyCategory], set: (v) => construct.category = v };
  if (construct.kindOfQuantity !== undefined)
    yield { field: "kindOfQuantity", value: construct.kindOfQuantity, expected: [SchemaItemType.KindOfQuantity], set: (v) => construct.kindOfQuantity = v };

  switch (construct.kind) {
    case PropertyKind.Primitive:
    case PropertyKind.PrimitiveArray:
      if (construct.isEnumeration())
        yield { field: "typeName", value: construct.typeName, expected: [SchemaItemType.Enumeration], set: (v) => construct.typeName = v };
      return;
    case PropertyKind.Struct:
    case PropertyKind.StructArray:
      yield { field: "typeName", value: construct.typeName, expected: [SchemaItemType.StructClass], set: (v) => construct.typeName = v };
      return;
    case PropertyKind.Navigation:
      yield { field: "relationshipName", value: construct.relationshipName, expected: [SchemaItemType.RelationshipClass], set: (v) => construct.relationshipName = v };
      return;
  }
}

function* collectItemReferenceSites(item: AnySchemaItem): Iterable<ReferenceSite> {
  switch (item.schemaItemType) {
    case SchemaItemType.EntityClass:
      yield* baseClassSite(item);
      for (const [index, mixin] of item.mixins.entries())
        yield { field: `mixins[${index}]`, value: mixin, expected: [SchemaItemType.Mixin], set: (v) => item.mixins[index] = v };
      return;
    case SchemaItemType.Mixin:
      yield* baseClassSite(item);
      yield { field: "appliesTo", value: item.appliesTo, expected: [SchemaItemType.EntityClass], set: (v) => item.appliesTo = v };
      return;
    case SchemaItemType.StructClass:
    case SchemaItemType.CustomAttributeClass:
    case SchemaItemType.RelationshipClass:
      yield* baseClassSite(item);
      return;
    case SchemaItemType.KindOfQuantity:
      yield { field: "persistenceUnit", value: item.persistenceUnit, expected: [SchemaItemType.Unit, SchemaItemType.InvertedUnit], set: (v) => item.persistenceUnit = v };
      for (const [index, presentationFormat] of item.presentationFormats.entries())
        yield* presentationFormatSites(`presentationFormats[${index}]`, presentationFormat, (v) => item.presentationFormats[index] = v);
      return;
    case SchemaItemType.Unit:
      yield { field: "phenomenon", value: item.phenomenon, expected: [SchemaItemType.Phenomenon], set: (v) => item.phenomenon = v };
      yield { field: "unitSystem", value: item.unitSystem, expected: [SchemaItemType.UnitSystem], set: (v) => item.unitSystem = v };
      return;
    case SchemaItemType.InvertedUnit:
      yield { field: "invertsUnit", value: item.invertsUnit, expected: [SchemaItemType.Unit], set: (v) => item.invertsUnit = v };
      yield { field: "unitSystem", value: item.unitSystem, expected: [SchemaItemType.UnitSystem], set: (v) => item.unitSystem = v };
      return;
    case SchemaItemType.Constant:
      yield { field: "phenomenon", value: item.phenomenon, expected: [SchemaItemType.Phenomenon], set: (v) => item.phenomenon = v };
      return;
    case SchemaItemType.Format:
      for (const [index, unit] of (item.composite?.units ?? []).entries())
        yield { field: `composite.units[${index}]`, value: unit.name, expected: [SchemaItemType.Unit, SchemaItemType.InvertedUnit], set: (v) => unit.name = v };
      return;
    default:
      return; // Enumeration, PropertyCategory, UnitSystem, Phenomenon reference nothing
  }
}

function* baseClassSite(item: { baseClass?: LocalOrFullName }): Iterable<ReferenceSite> {
  if (item.baseClass !== undefined)
    yield { field: "baseClass", value: item.baseClass, expected: [AbstractSchemaItemType.Class], set: (v) => item.baseClass = v };
}

/** A presentation format override names a `Format` and, in its bracketed segments, the units that
 * format is applied with (`"Formats:DefaultRealU(4)[Units:M]"`). Both are ordinary item references
 * embedded in a string, so both get sites. */
function* presentationFormatSites(field: string, presentationFormat: string, write: (value: string) => void): Iterable<ReferenceSite> {
  const sites: ReferenceSite[] = [];
  // Rewrites the reference at `position` and leaves every other segment of the format spec as it
  // was, by running the mapper again and swapping only that one.
  const setAt = (position: number) => (value: LocalOrFullName) => {
    let seen = 0;
    write(mapFormatStringReferences(presentationFormat, (reference) => seen++ === position ? value : reference));
  };
  mapFormatStringReferences(presentationFormat, (reference) => {
    sites.push(sites.length === 0
      ? { field, value: reference, expected: [SchemaItemType.Format], set: setAt(0) }
      : { field: `${field}[${sites.length - 1}]`, value: reference, expected: [SchemaItemType.Unit, SchemaItemType.InvertedUnit], set: setAt(sites.length) });
    return reference;
  });
  yield* sites;
}

/** Resolves every reference a construct holds and reports the four ways one fails: the qualifier
 * names no declared schema reference, the named schema is not loaded, the schema is loaded but has
 * no such item, or the item is there but of the wrong kind. Also warns about a reference to a
 * deprecated item.
 * @internal
 */
export function checkReferenceSites(construct: ReferencingConstruct, context: ValidationContext): void {
  const document = construct.document;
  for (const site of collectReferenceSites(construct))
    checkReferenceSite(site, document, construct, context);
}

function checkReferenceSite(site: ReferenceSite, document: SchemaDocument, referrer: ReferencingConstruct, context: ValidationContext): void {
  const severity: SchemaIssueSeverity = site.expected.some((kind) => unitsAndFormatsKinds.has(kind)) ? "warning" : "error";
  const { qualifier } = splitReference(site.value);

  if (qualifier !== undefined && !isDeclaredQualifier(document, qualifier)) {
    context.error("reference-qualifier-undeclared",
      `${site.field} names "${site.value}", but "${qualifier}" is neither this schema's alias nor the name or alias of any schema it references.`);
    return;
  }

  const schemaName = document.resolveSchemaName(site.value);
  context.noteSchemaUsed(schemaName);
  if (!namesEqual(schemaName, document.name) && context.isSchemaAbsent(document, schemaName))
    return;

  const item = document.resolveItem(site.value);
  if (item === undefined) {
    context.report(severity, "reference-item-not-found",
      `${site.field} names "${site.value}", which schema "${schemaName}" does not declare.`);
    return;
  }

  if (!site.expected.some((kind) => isSupportedSchemaItemType(item.schemaItemType, kind))) {
    context.error("reference-item-wrong-kind",
      `${site.field} names "${site.value}", which is a ${item.schemaItemType}; expected ${describeKinds(site.expected)}.`);
    return;
  }

  if (isDeprecated(item) && !isDeprecated(referrer))
    context.warning("reference-item-deprecated", `${site.field} names "${site.value}", which is deprecated.`);
}

/** Checks the schema reference list itself: alias shape and uniqueness, self-references, cycles,
 * supplemental and deprecated targets, and the declared version against the version the schema set
 * actually holds.
 * @internal
 */
export function checkSchemaReferences(document: SchemaDocument, context: ValidationContext): void {
  const aliases = new Map<string, SchemaReference>();
  for (const reference of document.references) {
    if (!ECName.validate(reference.name))
      context.error("schema-reference-name-invalid", `Schema reference "${reference.name}" is not a valid EC name.`);

    if (namesEqual(reference.name, document.name)) {
      context.error("schema-reference-self", `A schema may not reference itself, but "${document.name}" declares a reference to "${reference.name}".`, "ECObjects-003");
      continue;
    }

    checkReferenceAlias(reference, document, aliases, context);
    checkReferenceVersion(reference, document, context);
  }

  checkReferenceCycle(document, context);
}

function checkReferenceAlias(reference: SchemaReference, document: SchemaDocument, aliases: Map<string, SchemaReference>, context: ValidationContext): void {
  const alias = reference.alias;
  if (alias === null || alias.length === 0) {
    context.warning("schema-reference-alias-missing",
      `The reference to "${reference.name}" has no alias, so this schema cannot be written as ECXML. ECJSON carries no aliases; call fillMissingReferenceAliases once the referenced schemas are in the set.`);
    return;
  }
  if (!ECName.validate(alias)) {
    context.error("schema-reference-alias-invalid", `The alias "${alias}" of the reference to "${reference.name}" is not a valid EC name.`);
    return;
  }
  if (namesEqual(alias, document.alias)) {
    context.error("schema-reference-alias-shadowed",
      `The reference to "${reference.name}" uses alias "${alias}", which is this schema's own alias, so nothing can be referenced through it.`);
    return;
  }
  const incumbent = aliases.get(alias.toLowerCase());
  if (incumbent !== undefined) {
    context.error("schema-reference-alias-duplicate",
      `The references to "${incumbent.name}" and "${reference.name}" both use the alias "${alias}".`, "ECObjects-002");
    return;
  }
  aliases.set(alias.toLowerCase(), reference);
}

function checkReferenceVersion(reference: SchemaReference, document: SchemaDocument, context: ValidationContext): void {
  const referenced = document.schemaSet.getSchema(reference.name);
  if (referenced === undefined)
    return; // absence is reported once, by the first reference site that needs the schema

  if (isSupplemental(referenced))
    context.error("schema-reference-supplemental",
      `"${referenced.name}" is a supplemental schema and may not be referenced.`, "ECObjects-001");

  if (isDeprecated(referenced) && !isDeprecated(document))
    context.warning("schema-reference-deprecated", `The referenced schema "${referenced.name}" is deprecated.`);

  const declared = `${reference.readVersion}.${reference.writeVersion}.${reference.minorVersion}`;
  const held = `${referenced.readVersion}.${referenced.writeVersion}.${referenced.minorVersion}`;
  if (referenced.readVersion !== reference.readVersion || referenced.writeVersion !== reference.writeVersion) {
    context.error("schema-reference-version-incompatible",
      `The reference to "${reference.name}" declares version ${declared}, but the schema set holds ${held}, which is not read/write compatible with it.`);
  } else if (referenced.minorVersion < reference.minorVersion) {
    context.warning("schema-reference-version-older",
      `The reference to "${reference.name}" declares version ${declared}, but the schema set holds the older ${held}.`);
  }
}

/** Follows the reference graph through the schema set looking for a way back to where it started.
 * Only schemas the set holds take part; an unloaded one is reported elsewhere and cannot close a
 * cycle here. */
function checkReferenceCycle(document: SchemaDocument, context: ValidationContext): void {
  const visited = new Set<SchemaDocument>([document]);
  const pending = document.references.map((reference) => document.schemaSet.getSchema(reference.name)).filter((d): d is SchemaDocument => d !== undefined);
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next === document) {
      context.error("schema-reference-cycle",
        `The schema references of "${document.name}" form a cycle that leads back to itself.`, "ECObjects-003");
      return;
    }
    if (visited.has(next))
      continue;
    visited.add(next);
    for (const reference of next.references) {
      const referenced = next.schemaSet.getSchema(reference.name);
      if (referenced !== undefined)
        pending.push(referenced);
    }
  }
}

/** Reports schema references nothing in the document names. Runs after the walk, because what
 * counts as "named" is exactly the set of reference sites and custom attribute classes the walk
 * visited.
 * @internal
 */
export function checkUnusedSchemaReferences(document: SchemaDocument, used: ReadonlySet<string>, context: ValidationContext): void {
  for (const reference of document.references) {
    if (!used.has(reference.name.toLowerCase()))
      context.warning("schema-reference-unused", `The schema reference to "${reference.name}" is declared but nothing in this schema uses it.`);
  }
}

/** Checks every custom attribute on one container: that its class resolves, is concrete, comes from
 * a schema this one references, may be applied to a container of this kind, is applied only once,
 * and carries only values the class declares.
 * @internal
 */
export function checkCustomAttributes(container: CustomAttributeContainer, containerType: CustomAttributeContainerType, context: ValidationContext): void {
  const document = container instanceof SchemaDocument ? container : container.document;
  const applied = new Set<string>();

  for (const customAttribute of container.customAttributes) {
    const className = customAttribute.className;
    const schemaName = document.resolveSchemaName(className);
    context.noteSchemaUsed(schemaName);

    const customAttributeClass = resolveCustomAttributeClass(document, className);
    if (customAttributeClass === undefined) {
      context.error("custom-attribute-class-not-found",
        `The custom attribute class "${className}" was not found. Load schema "${schemaName}" into the schema set, or correct the name.`, "ECObjects-502");
      continue;
    }

    const key = customAttributeClass.fullName.toLowerCase();
    if (applied.has(key)) {
      context.error("custom-attribute-duplicate", `The custom attribute class "${customAttributeClass.fullName}" is applied more than once here.`);
      continue;
    }
    applied.add(key);

    if (!namesEqual(schemaName, document.name) && document.getSchemaReference(schemaName) === undefined) {
      context.error("custom-attribute-schema-not-referenced",
        `The custom attribute "${className}" comes from schema "${schemaName}", which this schema does not reference.`, "ECObjects-501");
    }

    if (customAttributeClass.modifier === ECClassModifier.Abstract) {
      context.error("custom-attribute-class-abstract",
        `The custom attribute class "${customAttributeClass.fullName}" is abstract and cannot be applied.`, "ECObjects-500");
    }

    if ((customAttributeClass.appliesTo & containerType) === 0) {
      context.error("custom-attribute-container-not-allowed",
        `The custom attribute class "${customAttributeClass.fullName}" applies to ${CustomAttributeContainerType[customAttributeClass.appliesTo] ?? customAttributeClass.appliesTo}, not to a ${CustomAttributeContainerType[containerType]}.`);
    }

    if (isDeprecated(customAttributeClass) && !isDeprecated(container))
      context.warning("custom-attribute-class-deprecated", `The custom attribute class "${customAttributeClass.fullName}" is deprecated.`);

    const values = customAttribute.tryGetValues();
    for (const name of Object.keys(values ?? {})) {
      if (customAttributeClass.getExpandedProperty(name) === undefined) {
        context.error("custom-attribute-value-unknown",
          `The custom attribute "${className}" carries a value named "${name}", which its class does not declare.`);
      }
    }
  }
}

/** Whether the container carries `CoreCustomAttributes:Deprecated`. Kept here because the reference
 * check and the schema reference check both warn about deprecated targets.
 * @internal
 */
export function isDeprecated(container: DeprecationCandidate): boolean {
  return hasCoreCustomAttribute(container, "Deprecated");
}

function isSupplemental(document: SchemaDocument): boolean {
  return hasCoreCustomAttribute(document, "SupplementalSchema");
}

/** Matches by resolved schema name rather than by spelling, so an alias-qualified application
 * (`"bis:Deprecated"`) counts the same as the schema-qualified one. Item kinds that carry no custom
 * attributes at all (an enumeration, a unit) answer `false`. */
function hasCoreCustomAttribute(container: DeprecationCandidate, className: string): boolean {
  const customAttributes: CustomAttributeSet | undefined = (container as Partial<{ customAttributes: CustomAttributeSet }>).customAttributes;
  if (customAttributes === undefined)
    return false;
  const document = container instanceof SchemaDocument ? container : container.document;
  for (const customAttribute of customAttributes) {
    const { name } = splitReference(customAttribute.className);
    if (namesEqual(name, className) && namesEqual(document.resolveSchemaName(customAttribute.className), "CoreCustomAttributes"))
      return true;
  }
  return false;
}

function isDeclaredQualifier(document: SchemaDocument, qualifier: string): boolean {
  if (namesEqual(qualifier, document.name) || namesEqual(qualifier, document.alias))
    return true;
  return document.references.some((reference) => namesEqual(reference.name, qualifier) || (reference.alias !== null && namesEqual(reference.alias, qualifier)));
}

function describeKinds(expected: ReadonlyArray<ExpectedKind>): string {
  return expected.map((kind) => kind === AbstractSchemaItemType.Class ? "a class" : `a ${kind}`).join(" or ");
}

/** @internal */
export function splitReference(reference: LocalOrFullName): { qualifier?: string, name: string } {
  const separator = reference.search(/[.:]/);
  if (separator < 0)
    return { name: reference };
  return { qualifier: reference.substring(0, separator), name: reference.substring(separator + 1) };
}

/** @internal */
export function namesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
