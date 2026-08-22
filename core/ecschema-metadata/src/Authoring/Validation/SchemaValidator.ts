/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { CustomAttributeContainerType, PropertyKind, RelationshipEnd, SchemaItemType } from "../../ECObjects";
import { AnyProperty, AnySchemaItem, AuthoringSchemaItemType, ECClass, RelationshipConstraint, SchemaDocument, SchemaSet } from "../SchemaDocument";
import { ECSpec } from "../SchemaDocumentIO";
import { SchemaIssueList, SchemaIssueSeverity } from "../SchemaIssues";
import { dialectForSpec, dialectV32, ECXmlDialect } from "../SchemaXmlDialect";
import { checkCustomAttributes, checkReferenceSites, checkSchemaReferences, checkUnusedSchemaReferences } from "./ReferenceRules";
import {
  checkClassShape, checkEnumeration, checkFormat, checkItemName, checkKindOfQuantity, checkProperty, checkRelationshipConstraintShape,
  checkSchemaShape, checkUnit,
} from "./ShapeRules";
import {
  checkClassInheritance, checkCustomAttributeClass, checkEntityInheritance, checkMixin, checkNavigationProperty, checkPropertyOverride,
  checkRelationshipConstraintStructure, checkStructClass, checkStructPropertyRecursion, checkSystemPropertyName, checkView,
} from "./StructureRules";

/** How a {@link validateSchemaDocument} or {@link validateSchemaSet} run is configured.
 * @alpha
 */
export interface ValidationOptions {
  /** The EC specification version the schema is held to. Defaults to {@link ECSpec.Latest}.
   *
   * Only rules that genuinely got stricter between versions read this - three-component versions,
   * enumerator names, the strict multiplicity grammar, abstract constraints. A document read from
   * an older source is modelled at the latest spec either way, so validating it against
   * `ECSpec.Latest` is what tells you what to fix before it can be saved as 3.2. */
  spec?: ECSpec;
}

/** Reports everything wrong with one schema document: dangling and mistyped references, invalid
 * names and versions, duplicate declarations, illegal inheritance, incompatible property overrides,
 * malformed relationship constraints, and misapplied custom attributes.
 *
 * References resolve through the document's {@link SchemaSet}, so a document whose references are
 * not loaded reports each absent schema **once** and skips every reference into it - one missing
 * schema does not bury the output. Only the given document is walked; use
 * {@link validateSchemaSet} to validate the schemas it references as well.
 *
 * @example
 * ```ts
 * const issues = Authoring.validateSchemaDocument(doc);
 * if (issues.hasErrors)
 *   throw new Error(issues.errors.map((issue) => `${issue.location}: ${issue.message}`).join("\n"));
 * ```
 * @alpha
 */
export function validateSchemaDocument(document: SchemaDocument, options?: ValidationOptions): SchemaIssueList {
  const context = new ValidationContext(options);
  walkDocument(document, context);
  return context.issues;
}

/** Reports everything wrong with every document in a schema set, in one pass, into one issue list.
 * The same checks {@link validateSchemaDocument} runs, plus the reference versions each document
 * declares are compared against the versions the set actually holds.
 *
 * Derivations shared between documents (the inherited-property walk in particular) are computed
 * once for the whole run, so validating a set is substantially cheaper than validating its
 * documents one at a time.
 * @alpha
 */
export function validateSchemaSet(schemaSet: SchemaSet, options?: ValidationOptions): SchemaIssueList {
  const context = new ValidationContext(options);
  for (const document of schemaSet)
    walkDocument(document, context);
  return context.issues;
}

/** What a check reports through, and where the derivations too expensive to repeat are cached.
 *
 * One context serves a whole validation run, including a multi-document one, so a class's expanded
 * property list is built at most once no matter how many rules and how many documents need it.
 * @alpha
 */
export class ValidationContext {
  /** Everything reported so far. */
  public readonly issues = new SchemaIssueList("validation");
  /** The EC specification version being validated against. */
  public readonly spec: ECSpec;
  /** The serialization switches of {@link ValidationContext.spec}, which is how the version-sensitive
   * rules ask what this spec requires instead of comparing version numbers themselves. */
  public readonly dialect: ECXmlDialect;
  /** The schema element the checks currently running are about, as a path
   * (`"MyDomain"`, `"MyDomain:Pump"`, `"MyDomain:Pump.SerialNumber"`). Stamped onto every issue. */
  public location: string = "";

  private readonly _expandedProperties = new Map<ECClass, AnyProperty[]>();
  private readonly _absentSchemas = new Set<string>();
  private _usedSchemas = new Set<string>();

  /** @internal */
  public constructor(options?: ValidationOptions) {
    this.spec = options?.spec ?? ECSpec.Latest;
    this.dialect = dialectForSpec(this.spec) ?? dialectV32;
  }

  /** Reports a problem that makes the schema invalid. */
  public error(name: string, message: string, code?: string): void {
    this.issues.addError(name, message, this.location, code);
  }

  /** Reports something suspicious that does not by itself make the schema invalid. */
  public warning(name: string, message: string, code?: string): void {
    this.issues.addWarning(name, message, this.location, code);
  }

  /** Reports an observation worth surfacing but requiring no action. */
  public info(name: string, message: string, code?: string): void {
    this.issues.addInfo(name, message, this.location, code);
  }

  /** Reports at the given severity, for checks whose severity depends on what they found. */
  public report(severity: SchemaIssueSeverity, name: string, message: string, code?: string): void {
    this.issues.add({ severity, group: "validation", name, message, location: this.location, code });
  }

  /** Every property of a class, inherited ones included, computed once per run.
   * @see {@link ECClass.getExpandedProperties} for the ordering and the resolution rules. */
  public getExpandedProperties(ecClass: ECClass): AnyProperty[] {
    let properties = this._expandedProperties.get(ecClass);
    if (properties === undefined) {
      properties = ecClass.getExpandedProperties();
      this._expandedProperties.set(ecClass, properties);
    }
    return properties;
  }

  /** Whether the schema an item reference names is absent from the document's schema set, reporting
   * it the first time that is asked about a given document and schema. Every check that resolves a
   * reference consults this first and stays silent when it answers `true`, so an unloaded schema
   * costs one issue instead of one per reference into it.
   * @internal
   */
  public isSchemaAbsent(document: SchemaDocument, schemaName: string): boolean {
    if (document.schemaSet.hasSchema(schemaName))
      return false;
    const key = `${document.name.toLowerCase()}|${schemaName.toLowerCase()}`;
    if (!this._absentSchemas.has(key)) {
      this._absentSchemas.add(key);
      this.issues.addError("schema-reference-not-loaded",
        `Schema "${schemaName}" is referenced but is not in the schema set, so nothing it declares could be checked. Load it (see SchemaResolver) to validate the references into it.`,
        document.name);
    }
    return true;
  }

  /** Records that something in the document being walked names this schema. What is "used" is
   * exactly the reference sites and custom attribute classes the walk visits, which is what lets an
   * unused schema reference be reported without a second pass over the document.
   * @internal
   */
  public noteSchemaUsed(schemaName: string): void {
    this._usedSchemas.add(schemaName.toLowerCase());
  }

  /** Hands over the schema names used since the last call and starts collecting again.
   * @internal
   */
  public takeUsedSchemas(): ReadonlySet<string> {
    const used = this._usedSchemas;
    this._usedSchemas = new Set<string>();
    return used;
  }
}

/** The single walk. Every construct is visited once and the checks for it are called here, so the
 * cost of validating is one traversal regardless of how many rules there are, and adding a rule is
 * a function plus a call at the slot it belongs to. */
function walkDocument(document: SchemaDocument, context: ValidationContext): void {
  context.location = document.name;
  checkSchemaShape(document, context);
  checkSchemaReferences(document, context);
  checkCustomAttributes(document, CustomAttributeContainerType.Schema, context);

  for (const item of document.items) {
    context.location = item.fullName;
    checkItemName(item, context);
    checkReferenceSites(item, context);
    walkItem(item, context);
  }

  context.location = document.name;
  checkUnusedSchemaReferences(document, context.takeUsedSchemas(), context);
}

function walkItem(item: AnySchemaItem, context: ValidationContext): void {
  switch (item.schemaItemType) {
    case SchemaItemType.EntityClass:
      walkClass(item, context);
      checkEntityInheritance(item, context);
      return;
    case SchemaItemType.Mixin:
      walkClass(item, context);
      checkMixin(item, context);
      // A mixin serializes as an entity class carrying CoreCustomAttributes:IsMixin, so a document
      // holding one uses that schema even though nothing in the model names it.
      context.noteSchemaUsed("CoreCustomAttributes");
      return;
    case AuthoringSchemaItemType.View:
      walkClass(item, context);
      checkView(item, context);
      // A view serializes as an entity class carrying ECDbMap:QueryView, so a document holding one
      // uses that schema even though nothing in the model names it.
      context.noteSchemaUsed("ECDbMap");
      return;
    case SchemaItemType.StructClass:
      walkClass(item, context);
      checkStructClass(item, context);
      return;
    case SchemaItemType.CustomAttributeClass:
      walkClass(item, context);
      checkCustomAttributeClass(item, context);
      return;
    case SchemaItemType.RelationshipClass:
      walkClass(item, context);
      walkConstraint(item.source, context);
      walkConstraint(item.target, context);
      return;
    case SchemaItemType.Enumeration:
      checkEnumeration(item, context);
      return;
    case SchemaItemType.KindOfQuantity:
      checkKindOfQuantity(item, context);
      return;
    case SchemaItemType.Unit:
      checkUnit(item, context);
      return;
    case SchemaItemType.Format:
      checkFormat(item, context);
      return;
    case SchemaItemType.PropertyCategory:
    case SchemaItemType.UnitSystem:
    case SchemaItemType.Phenomenon:
    case SchemaItemType.InvertedUnit:
    case SchemaItemType.Constant:
      return; // nothing beyond the name and the reference sites already checked
  }
}

function walkClass(ecClass: ECClass, context: ValidationContext): void {
  checkClassShape(ecClass, context);
  checkClassInheritance(ecClass, context);
  checkCustomAttributes(ecClass, containerTypeOfClass(ecClass), context);

  for (const property of ecClass.properties) {
    context.location = property.fullName;
    checkProperty(property, context);
    checkReferenceSites(property, context);
    checkPropertyOverride(property, context);
    checkSystemPropertyName(property, context);
    checkStructPropertyRecursion(property, context);
    if (property.isNavigation())
      checkNavigationProperty(property, context);
    checkCustomAttributes(property, containerTypeOfProperty(property), context);
  }
  context.location = ecClass.fullName;
}

function walkConstraint(constraint: RelationshipConstraint, context: ValidationContext): void {
  context.location = locationOfConstraint(constraint);
  checkRelationshipConstraintShape(constraint, context);
  checkReferenceSites(constraint, context);
  checkRelationshipConstraintStructure(constraint, context);
  checkCustomAttributes(constraint, containerTypeOfConstraint(constraint), context);
  context.location = constraint.relationshipClass.fullName;
}

/** `"MyDomain:PumpHasPorts(Source)"` - a constraint is not a schema item, so it has no full name of
 * its own and one is composed here. */
function locationOfConstraint(constraint: RelationshipConstraint): string {
  return `${constraint.relationshipClass.fullName}(${constraint.relationshipEnd === RelationshipEnd.Source ? "Source" : "Target"})`;
}

/** The container kind a custom attribute applied here must declare in its `appliesTo`. A mixin is
 * an entity class as far as custom attributes are concerned - `CustomAttributeContainerType` has no
 * mixin member, and in ECXML a mixin *is* an entity class. */
function containerTypeOfClass(ecClass: ECClass): CustomAttributeContainerType {
  switch (ecClass.schemaItemType) {
    case SchemaItemType.StructClass: return CustomAttributeContainerType.StructClass;
    case SchemaItemType.CustomAttributeClass: return CustomAttributeContainerType.CustomAttributeClass;
    case SchemaItemType.RelationshipClass: return CustomAttributeContainerType.RelationshipClass;
    default: return CustomAttributeContainerType.EntityClass;
  }
}

function containerTypeOfProperty(property: AnyProperty): CustomAttributeContainerType {
  switch (property.kind) {
    case PropertyKind.PrimitiveArray: return CustomAttributeContainerType.PrimitiveArrayProperty;
    case PropertyKind.Struct: return CustomAttributeContainerType.StructProperty;
    case PropertyKind.StructArray: return CustomAttributeContainerType.StructArrayProperty;
    case PropertyKind.Navigation: return CustomAttributeContainerType.NavigationProperty;
    default: return CustomAttributeContainerType.PrimitiveProperty;
  }
}

function containerTypeOfConstraint(constraint: RelationshipConstraint): CustomAttributeContainerType {
  return constraint.relationshipEnd === RelationshipEnd.Source
    ? CustomAttributeContainerType.SourceRelationshipConstraint
    : CustomAttributeContainerType.TargetRelationshipConstraint;
}
