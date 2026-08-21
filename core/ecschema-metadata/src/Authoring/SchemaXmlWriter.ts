/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { formatTraitsToArray } from "@itwin/core-quantity";
import { classModifierToString, containerTypeToString, ECClassModifier, parsePrimitiveType, SchemaItemType, strengthDirectionToString, strengthToString } from "../ECObjects";
import { writeCustomAttributeXmlBody } from "./CustomAttributeConverter";
import * as Authoring from "./SchemaDocument";
import { parseMultiplicity } from "./SchemaDocument";
import { ECName } from "../ECName";
import { ECSpec, mapFormatStringReferences, SchemaDocumentTextWriter, SchemaStreamWriteResult, SchemaTextSink, SchemaWriteOptions, SchemaWriteResult } from "./SchemaDocumentIO";
import { dialectForSpec, ECXmlDialect, formatLegacyCardinality, synthesizeEnumeratorName } from "./SchemaXmlDialect";
import { SchemaIssueList } from "./SchemaIssues";

/** Matches the first EC separator (`:` or `.`) in an item reference. Hoisted: a regex literal
 * allocates a new RegExp on every evaluation, and this runs per reference. */
const separatorPattern = /[.:]/;


/** Serializes a {@link Authoring.SchemaDocument} to ECXML text, in any published spec version -
 * 2.0, 3.0, 3.1 or 3.2. The document always models the latest spec; the writer converts at this
 * boundary.
 *
 * Writing an older spec drops what that spec cannot express, and each drop is reported as a
 * warning. 2.0 gives up the most: it has no enumerations, kinds of quantity, property categories,
 * units or formats, and it cannot express a navigation property or a class modifier beyond
 * abstract. Where the legacy custom attributes those constructs replaced are wanted in the output,
 * run {@link convertToEC2CustomAttributes} over a copy of the document first - the writer never
 * invents custom attributes on its own.
 *
 * Problems that do not prevent producing output (an item reference whose schema is missing from
 * the reference list, a CA value too ambiguous to serialize) are reported as issues alongside
 * best-effort text; only an unsupported target spec yields no text at all.
 * @alpha
 */
export class SchemaXmlWriter implements SchemaDocumentTextWriter {
  /** Writes the document to ECXML text in the requested spec version (default {@link ECSpec.Latest}).
   * Builds the whole document as one string; for a schema large enough to approach the platform's
   * maximum string length use {@link writeDocumentTo} instead. */
  public writeDocument(document: Authoring.SchemaDocument, options?: SchemaWriteOptions): SchemaWriteResult {
    const issues = new SchemaIssueList("xml");
    const emitter = this._prepare(document, issues, options);
    if (emitter === undefined)
      return { issues };
    return { text: emitter.emit(), issues };
  }

  /** Streams the document to `sink` as ECXML text in chunks, never materializing it as one string, so
   * a schema of any size can be written. The whole document still passes through `sink`; concatenating
   * the chunks yields exactly what {@link writeDocument} returns. */
  public async writeDocumentTo(document: Authoring.SchemaDocument, sink: SchemaTextSink, options?: SchemaWriteOptions): Promise<SchemaStreamWriteResult> {
    const issues = new SchemaIssueList("xml");
    const emitter = this._prepare(document, issues, options);
    if (emitter === undefined)
      return { issues };
    await emitter.emitTo(sink, options?.abortSignal);
    return { issues };
  }

  /** Validates the target spec and constructs the emitter, or reports an unsupported spec and returns
   * `undefined`. Shared by the materializing and streaming entry points. */
  private _prepare(document: Authoring.SchemaDocument, issues: SchemaIssueList, options?: SchemaWriteOptions): ECXmlEmitter | undefined {
    const spec = options?.spec ?? ECSpec.Latest;
    const dialect = dialectForSpec(spec);
    if (dialect === undefined) {
      issues.addError("target-spec-unsupported", `Unsupported target spec version "${spec as string}".`);
      return undefined;
    }
    return new ECXmlEmitter(document, issues, dialect);
  }
}

/** Replacement per escapable character. Hoisted, and matched in a single pass: escaping runs on
 * every attribute and every text node, so a large schema goes through it hundreds of thousands of
 * times. */
const xmlEscapes: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" };
const attributeEscapePattern = /[&<>"]/g;
const textEscapePattern = /[&<>]/g;

/** Escapes a string for use inside an XML attribute value. */
function escapeAttribute(value: string): string {
  return value.replace(attributeEscapePattern, (char) => xmlEscapes[char]);
}

/** Escapes a string for use as XML element text. */
function escapeText(value: string): string {
  return value.replace(textEscapePattern, (char) => xmlEscapes[char]);
}

/** An attribute as [name, value]; a `undefined` value omits the attribute. */
type XmlAttribute = [name: string, value: string | number | boolean | undefined];

/** Accumulates indented XML text. */
class XmlStringBuilder {
  private readonly _lines: string[] = [];
  private _depth = 0;

  /** How many lines each {@link drainTo} chunk joins. Large enough that the per-chunk join cost is
   * negligible, small enough that the joined chunk stays far below any string-length limit. */
  private static readonly _linesPerChunk = 4096;

  public openElement(name: string, attributes: XmlAttribute[] = []): void {
    this._lines.push(`${this._indent()}<${name}${this._formatAttributes(attributes)}>`);
    ++this._depth;
  }

  public closeElement(name: string): void {
    --this._depth;
    this._lines.push(`${this._indent()}</${name}>`);
  }

  public selfClosingElement(name: string, attributes: XmlAttribute[] = []): void {
    this._lines.push(`${this._indent()}<${name}${this._formatAttributes(attributes)}/>`);
  }

  public textElement(name: string, text: string, attributes: XmlAttribute[] = []): void {
    this._lines.push(`${this._indent()}<${name}${this._formatAttributes(attributes)}>${escapeText(text)}</${name}>`);
  }

  /** Appends a block of pre-rendered XML lines (a custom attribute's raw body), indenting each line to
   * the current depth. The block is serialized at indent 0 with the same four-space step, so prefixing
   * the current indent preserves its internal nesting. Already escaped - lines are emitted verbatim. */
  /** Appends pre-rendered XML, one entry per line, at the current depth. Entries are never split:
   * an entry may contain newlines that belong to a text value, and indenting those would change the
   * value. */
  public rawLines(lines: ReadonlyArray<string>): void {
    const indent = this._indent();
    for (const line of lines)
      this._lines.push(line.length > 0 ? `${indent}${line}` : line);
  }

  public toString(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${this._lines.join("\n")}\n`;
  }

  /** Streams the accumulated XML to `sink` in line-batches rather than building one string, so the
   * output never has to fit in a single string (the document can exceed the platform's maximum string
   * length). Concatenating every chunk yields exactly what {@link toString} returns. The batch join
   * stays well under any limit, so this writes arbitrarily large documents; memory is still ~one
   * serialized copy (the line array), which is the accepted tier-1 tradeoff. */
  public async drainTo(sink: SchemaTextSink, abortSignal?: AbortSignal): Promise<void> {
    abortSignal?.throwIfAborted();
    await sink(`<?xml version="1.0" encoding="UTF-8"?>\n`);
    for (let start = 0; start < this._lines.length; start += XmlStringBuilder._linesPerChunk) {
      abortSignal?.throwIfAborted();
      await sink(`${this._lines.slice(start, start + XmlStringBuilder._linesPerChunk).join("\n")}\n`);
    }
  }

  private _indent(): string {
    return "    ".repeat(this._depth);
  }

  private _formatAttributes(attributes: XmlAttribute[]): string {
    let result = "";
    for (const [name, value] of attributes) {
      if (value !== undefined)
        result += ` ${name}="${escapeAttribute(String(value))}"`;
    }
    return result;
  }
}

/** Zero-pads a version component to two digits, the conventional ECXML formatting. */
function padVersionComponent(component: number): string {
  return component < 10 ? `0${component}` : `${component}`;
}

function formatVersion(read: number, write: number, minor: number): string {
  return `${padVersionComponent(read)}.${padVersionComponent(write)}.${padVersionComponent(minor)}`;
}

/** Emits one document in the dialect it is given. Created per write; holds the document and the
 * issue list. */
class ECXmlEmitter {
  private readonly _document: Authoring.SchemaDocument;
  private readonly _issues: SchemaIssueList;
  private readonly _xml = new XmlStringBuilder();
  private readonly _dialect: ECXmlDialect;

  public constructor(document: Authoring.SchemaDocument, issues: SchemaIssueList, dialect: ECXmlDialect) {
    this._document = document;
    this._issues = issues;
    this._dialect = dialect;
  }

  /** A schema's own version. Before 3.2 it is written `RR.mm`, dropping the write component - which
   * native's lenient parser reads back as read/0/minor, so a non-zero write component cannot be
   * expressed and is reported rather than silently dropped. */
  private _formatSchemaVersion(read: number, write: number, minor: number): string {
    if (this._dialect.versionComponents === 3)
      return formatVersion(read, write, minor);
    if (write !== 0) {
      this._issues.addWarning("schema-write-version-dropped",
        `ECXML ${this._dialect.spec} writes a two-component version, so the write component ${write} of "${this._document.name}" cannot be expressed and was dropped.`,
        this._document.name);
    }
    return `${padVersionComponent(read)}.${padVersionComponent(minor)}`;
  }

  public emit(): string {
    this._build();
    return this._xml.toString();
  }

  /** Builds the document, then streams it to `sink` in chunks instead of returning one string. */
  public async emitTo(sink: SchemaTextSink, abortSignal?: AbortSignal): Promise<void> {
    this._build();
    await this._xml.drainTo(sink, abortSignal);
  }

  /** Walks the document and fills the builder. Synchronous - the chunking happens at drain time, so
   * the emit walk itself stays a plain recursive descent. */
  private _build(): void {
    const doc = this._document;
    this._xml.openElement("ECSchema", [
      ["schemaName", doc.name],
      [this._dialect.schemaAliasAttribute, doc.alias],
      ["version", this._formatSchemaVersion(doc.readVersion, doc.writeVersion, doc.minorVersion)],
      ["displayLabel", doc.label],
      ["description", doc.description],
      ["xmlns", this._dialect.namespace],
    ]);

    for (const reference of doc.references) {
      // Before 3.2 the Units and Formats schemas hold nothing a document of that version can point
      // at, so native leaves the references out and a reader would fail to resolve them anyway.
      if (!this._dialect.unitAndFormatReferences && (reference.name === "Units" || reference.name === "Formats"))
        continue;
      this._emitSchemaReference(reference);
    }

    this._emitCustomAttributes(doc.customAttributes);

    for (const item of doc.items)
      this._emitItem(item);

    this._xml.closeElement("ECSchema");
  }

  private _emitSchemaReference(reference: Authoring.SchemaReference): void {
    if (reference.alias === null) {
      this._issues.addError("reference-alias-missing",
        `The reference to schema "${reference.name}" has no alias; ECXML requires one on every ECSchemaReference.`,
        this._document.name);
    }
    this._xml.selfClosingElement("ECSchemaReference", [
      ["name", reference.name],
      ["version", this._formatSchemaVersion(reference.readVersion, reference.writeVersion, reference.minorVersion)],
      [this._dialect.referenceAliasAttribute, reference.alias ?? undefined],
    ]);
  }

  /** Converts a stored item reference (local name or `Schema:Item` full name, either separator,
   * alias-qualified tolerated) to the alias-qualified form ECXML uses. */
  private _toXmlItemReference(reference: Authoring.LocalOrFullName, location: string): string {
    const separatorIndex = reference.search(separatorPattern);
    if (separatorIndex < 0)
      return reference; // local name
    const qualifier = reference.substring(0, separatorIndex);
    const itemName = reference.substring(separatorIndex + 1);
    const qualifierLower = qualifier.toLowerCase();

    if (qualifierLower === this._document.name.toLowerCase() || qualifierLower === this._document.alias.toLowerCase())
      return itemName; // reference into this schema - local in XML

    for (const schemaReference of this._document.references) {
      if (schemaReference.name.toLowerCase() === qualifierLower) {
        if (schemaReference.alias === null) {
          this._issues.addWarning("reference-alias-unavailable",
            `Cannot alias-qualify "${reference}": the reference to schema "${schemaReference.name}" has no alias.`, location);
          return `${qualifier}:${itemName}`;
        }
        return `${schemaReference.alias}:${itemName}`;
      }
      if (schemaReference.alias !== null && schemaReference.alias.toLowerCase() === qualifierLower)
        return `${schemaReference.alias}:${itemName}`; // already alias-qualified
    }

    this._issues.addWarning("reference-item-unresolved",
      `The item reference "${reference}" does not match this schema or any schema in the reference list; emitting it unchanged.`, location);
    return `${qualifier}:${itemName}`;
  }

  /** Resolves the `xmlns` of a custom attribute element: the full name (`Schema.RR.WW.mm`, or the
   * two-component `Schema.RR.mm` before 3.0) of the schema defining the CA class, looked up from the
   * reference list at emit time - the document itself never stores a version on a CA reference. */
  private _customAttributeNamespace(className: string, location: string): { elementName: string, xmlns: string | undefined } {
    const separatorIndex = className.search(separatorPattern);
    if (separatorIndex < 0)
      return { elementName: className, xmlns: this._ownNamespace() };
    const qualifier = className.substring(0, separatorIndex);
    const elementName = className.substring(separatorIndex + 1);
    const qualifierLower = qualifier.toLowerCase();

    if (qualifierLower === this._document.name.toLowerCase() || qualifierLower === this._document.alias.toLowerCase())
      return { elementName, xmlns: this._ownNamespace() };

    for (const schemaReference of this._document.references) {
      const aliasMatches = schemaReference.alias !== null && schemaReference.alias.toLowerCase() === qualifierLower;
      if (schemaReference.name.toLowerCase() === qualifierLower || aliasMatches)
        return { elementName, xmlns: `${schemaReference.name}.${this._formatNamespaceVersion(schemaReference.readVersion, schemaReference.writeVersion, schemaReference.minorVersion)}` };
    }

    this._issues.addWarning("custom-attribute-class-unresolved",
      `The custom attribute class "${className}" does not match this schema or any schema in the reference list; its qualifier is emitted without a version.`, location);
    // Emit the qualifier rather than nothing. Dropping the xmlns would leave a bare element name,
    // which a reader binds to whatever schema it is reading - silently turning this into an
    // instance of a different class. Keeping the qualifier without a version preserves which class
    // was named; the reference list is what validation reports as missing.
    return { elementName, xmlns: qualifier };
  }

  /** The version inside a custom attribute instance's `xmlns`. 2.0 carries `RR.mm`. */
  private _formatNamespaceVersion(read: number, write: number, minor: number): string {
    return this._dialect.legacyCustomAttributeNamespace
      ? `${padVersionComponent(read)}.${padVersionComponent(minor)}`
      : formatVersion(read, write, minor);
  }

  private _ownNamespace(): string {
    const doc = this._document;
    return `${doc.name}.${this._formatNamespaceVersion(doc.readVersion, doc.writeVersion, doc.minorVersion)}`;
  }

  /** Emits an `<ECCustomAttributes>` container. `synthesized` carries spec-mandated CA instances the
   * model holds first-class (today: a mixin's IsMixin), emitted ahead of the user's instances. */
  private _emitCustomAttributes(customAttributes: Authoring.CustomAttributeSet, location: string = this._document.name, synthesized?: () => void): void {
    if (customAttributes.size === 0 && synthesized === undefined)
      return;
    this._xml.openElement("ECCustomAttributes");
    if (synthesized)
      synthesized();
    for (const ca of customAttributes) {
      const body = this._customAttributeXmlBody(ca, location);
      if (body === undefined)
        continue; // dropped - the value could not be converted to XML; an issue was reported
      const { elementName, xmlns } = this._customAttributeNamespace(ca.className, location);
      const attributes: XmlAttribute[] = [["xmlns", xmlns]];
      if (body.length === 0) {
        this._xml.selfClosingElement(elementName, attributes);
        continue;
      }
      this._xml.openElement(elementName, attributes);
      this._xml.rawLines(body);
      this._xml.closeElement(elementName);
    }
    this._xml.closeElement("ECCustomAttributes");
  }

  /** The custom attribute's values serialized to a raw ECXML body. `""` for a valueless attribute
   * (emitted self-closing), or `undefined` when the values cannot be expressed in ECXML - a struct
   * array whose entry struct class no resolvable custom attribute class names - in which case the
   * attribute is dropped and an issue has been reported. */
  private _customAttributeXmlBody(ca: Authoring.CustomAttribute, location: string): string[] | undefined {
    return writeCustomAttributeXmlBody(ca, this._issues, location);
  }

  private _emitItem(item: Authoring.AnySchemaItem): void {
    if (item.isEntity())
      return this._emitEntityClass(item);
    if (item.isMixin())
      return this._emitMixin(item);
    if (item.isStruct())
      return this._emitClass(this._classElementName("ECStructClass"), item, []);
    if (item.isCustomAttribute()) {
      // 2.0 has no appliesTo on a class; native drops it and reads such a class as applying to anything.
      const appliesTo: XmlAttribute[] = this._dialect.classElements === "typed" ? [["appliesTo", containerTypeToString(item.appliesTo)]] : [];
      return this._emitClass(this._classElementName("ECCustomAttributeClass"), item, appliesTo);
    }
    if (item.isRelationship())
      return this._emitRelationshipClass(item);
    switch (item.schemaItemType) {
      case SchemaItemType.Enumeration:
        return this._dialect.enumerationItems ? this._emitEnumeration(item) : this._dropItem(item, "enumerations");
      case SchemaItemType.KindOfQuantity:
        return this._dialect.kindOfQuantityItems ? this._emitKindOfQuantity(item) : this._dropItem(item, "kinds of quantity");
      case SchemaItemType.PropertyCategory:
        return this._dialect.propertyCategoryItems ? this._emitPropertyCategory(item) : this._dropItem(item, "property categories");
      case SchemaItemType.UnitSystem:
        return this._dialect.unitAndFormatItems ? this._emitSimpleItem("UnitSystem", item, []) : this._dropItem(item, "unit systems");
      case SchemaItemType.Phenomenon:
        return this._dialect.unitAndFormatItems ? this._emitSimpleItem("Phenomenon", item, [["definition", item.definition]]) : this._dropItem(item, "phenomena");
      case SchemaItemType.Unit:
        return this._dialect.unitAndFormatItems ? this._emitUnit(item) : this._dropItem(item, "units");
      case SchemaItemType.InvertedUnit:
        return this._dialect.unitAndFormatItems ? this._emitInvertedUnit(item) : this._dropItem(item, "inverted units");
      case SchemaItemType.Constant:
        return this._dialect.unitAndFormatItems ? this._emitConstant(item) : this._dropItem(item, "constants");
      case SchemaItemType.Format:
        return this._dialect.unitAndFormatItems ? this._emitFormat(item) : this._dropItem(item, "formats");
    }
  }

  /** Reports an item the target spec has no element for. The output stays readable, which is what a
   * downgrade is for, but the item is gone - so it is never silent. */
  private _dropItem(item: Authoring.SchemaItem, plural: string): void {
    this._issues.addWarning("enumeration-unsupported-in-spec",
      `ECXML ${this._dialect.spec} has no ${plural}, so "${item.name}" was dropped.`,
      `${this._document.name}:${item.name}`);
  }

  /** 2.0 has one `ECClass` element carrying type flags where 3.x has three typed elements. */
  private _classElementName(typedName: string): string {
    return this._dialect.classElements === "typed" ? typedName : "ECClass";
  }

  /** The class kind attributes: `modifier` from 3.0, the `isStruct` / `isCustomAttributeClass` /
   * `isDomainClass` flag triple at 2.0. The flags carry less than the modifier does - a sealed class
   * is indistinguishable from a plain one - so the loss is reported. */
  private _classKindAttributes(item: Authoring.AnyClass, kind: "entity" | "struct" | "customAttribute" | "relationship"): XmlAttribute[] {
    if (this._dialect.classElements === "typed")
      return [["modifier", item.modifier === undefined ? undefined : classModifierToString(item.modifier)]];

    if (item.modifier === ECClassModifier.Sealed) {
      this._issues.addWarning("class-sealed-modifier-dropped",
        `ECXML ${this._dialect.spec} cannot express a sealed class, so the modifier of "${item.name}" was dropped.`,
        `${this._document.name}:${item.name}`);
    }
    const isStruct = kind === "struct";
    const isCustomAttribute = kind === "customAttribute";
    return [
      ["isStruct", isStruct],
      ["isCustomAttributeClass", isCustomAttribute],
      ["isDomainClass", item.modifier !== ECClassModifier.Abstract && !isStruct && !isCustomAttribute],
    ];
  }

  private _itemHeaderAttributes(item: Authoring.SchemaItem): XmlAttribute[] {
    return [
      ["typeName", item.name],
      ["displayLabel", item.label],
      ["description", item.description],
    ];
  }

  private _emitEntityClass(item: Authoring.EntityClass): void {
    const elementName = this._classElementName("ECEntityClass");
    this._xml.openElement(elementName, [...this._itemHeaderAttributes(item), ...this._classKindAttributes(item, "entity")]);
    // The entity base class comes first, then the applied mixins - the order ECXML mandates.
    if (item.baseClass !== undefined)
      this._xml.textElement("BaseClass", this._toXmlItemReference(item.baseClass, item.name));
    for (const mixin of item.mixins)
      this._xml.textElement("BaseClass", this._toXmlItemReference(mixin, item.name));
    this._emitCustomAttributes(item.customAttributes, item.name);
    this._emitProperties(item);
    this._xml.closeElement(elementName);
  }

  private _emitMixin(item: Authoring.Mixin): void {
    // No ECXML version has a first-class mixin: it is an entity class carrying the IsMixin custom attribute.
    const elementName = this._classElementName("ECEntityClass");
    this._xml.openElement(elementName, [...this._itemHeaderAttributes(item), ...this._classKindAttributes(item, "entity")]);
    if (item.baseClass !== undefined)
      this._xml.textElement("BaseClass", this._toXmlItemReference(item.baseClass, item.name));
    this._emitCustomAttributes(item.customAttributes, item.name, () => {
      const coreCa = this._document.getSchemaReference("CoreCustomAttributes");
      if (coreCa === undefined) {
        this._issues.addWarning("mixin-custom-attribute-reference-missing",
          `The mixin "${item.name}" requires the IsMixin custom attribute, but "CoreCustomAttributes" is not in the reference list; emitting with a 01.00.00 namespace.`,
          item.name);
      }
      const xmlns = coreCa !== undefined
        ? `CoreCustomAttributes.${this._formatNamespaceVersion(coreCa.readVersion, coreCa.writeVersion, coreCa.minorVersion)}`
        : `CoreCustomAttributes.${this._formatNamespaceVersion(1, 0, 0)}`;
      this._xml.openElement("IsMixin", [["xmlns", xmlns]]);
      this._xml.textElement("AppliesToEntityClass", this._toXmlItemReference(item.appliesTo, item.name));
      this._xml.closeElement("IsMixin");
    });
    this._emitProperties(item);
    this._xml.closeElement(elementName);
  }

  private _emitClass(elementName: string, item: Authoring.AnyClass, extraAttributes: XmlAttribute[]): void {
    const kind = item.isStruct() ? "struct" : "customAttribute";
    this._xml.openElement(elementName, [...this._itemHeaderAttributes(item), ...this._classKindAttributes(item, kind), ...extraAttributes]);
    if (item.baseClass !== undefined)
      this._xml.textElement("BaseClass", this._toXmlItemReference(item.baseClass, item.name));
    this._emitCustomAttributes(item.customAttributes, item.name);
    this._emitProperties(item);
    this._xml.closeElement(elementName);
  }

  private _emitRelationshipClass(item: Authoring.RelationshipClass): void {
    // ECXML 3.1+ requires the modifier attribute on relationship classes (it is optional elsewhere),
    // so emit it unconditionally, falling back to the spec default when the document leaves it absent.
    const kindAttributes: XmlAttribute[] = this._dialect.classElements === "typed"
      ? [["modifier", classModifierToString(item.modifier ?? Authoring.SpecDefaults.classModifier)]]
      : this._classKindAttributes(item, "relationship");
    this._xml.openElement("ECRelationshipClass", [
      ...this._itemHeaderAttributes(item),
      ...kindAttributes,
      ["strength", item.strength === undefined ? undefined : strengthToString(item.strength)],
      ["strengthDirection", item.strengthDirection === undefined ? undefined : strengthDirectionToString(item.strengthDirection)],
    ]);
    if (item.baseClass !== undefined)
      this._xml.textElement("BaseClass", this._toXmlItemReference(item.baseClass, item.name));
    this._emitCustomAttributes(item.customAttributes, item.name);
    // ECXML 3.2 sequences the constraints before any properties on the relationship; native's
    // parser rejects the reverse order, so Source/Target must precede _emitProperties here.
    this._emitRelationshipConstraint("Source", item.source, item.name);
    this._emitRelationshipConstraint("Target", item.target, item.name);
    this._emitProperties(item);
    this._xml.closeElement("ECRelationshipClass");
  }

  private _emitRelationshipConstraint(elementName: string, constraint: Authoring.RelationshipConstraint, className: string): void {
    const location = `${this._document.name}:${className}`;
    this._xml.openElement(elementName, [
      [this._dialect.constraintBoundsAttribute, this._formatConstraintBounds(constraint.multiplicity)],
      ["roleLabel", constraint.roleLabel],
      ["polymorphic", constraint.polymorphic],
      ["abstractConstraint", this._dialect.abstractConstraint && constraint.abstractConstraint !== undefined ? this._toXmlItemReference(constraint.abstractConstraint, location) : undefined],
    ]);
    this._emitCustomAttributes(constraint.customAttributes, location);
    for (const constraintClass of constraint.constraintClasses)
      this._xml.selfClosingElement("Class", [["class", this._toXmlItemReference(constraintClass, location)]]);
    this._xml.closeElement(elementName);
  }

  private _emitProperties(item: Authoring.AnyClass): void {
    for (const property of item.properties)
      this._emitProperty(property, item.name);
  }

  private _commonPropertyAttributes(property: Authoring.AnyProperty, location: string): XmlAttribute[] {
    // Property categories and priorities arrived in 3.1, the kindOfQuantity attribute in 3.0.
    const categories = this._dialect.propertyCategoryItems;
    return [
      ["propertyName", property.name],
      ["displayLabel", property.label],
      ["description", property.description],
      ["readOnly", property.isReadOnly],
      ["priority", categories ? property.priority : undefined],
      ["category", categories && property.category !== undefined ? this._toXmlItemReference(property.category, location) : undefined],
      ["kindOfQuantity", this._dialect.kindOfQuantityAttribute && property.kindOfQuantity !== undefined ? this._toXmlItemReference(property.kindOfQuantity, location) : undefined],
    ];
  }

  /** A property's `typeName` is a primitive keyword (emitted as-is) or an item reference (converted
   * to the alias-qualified XML form). The primitive keywords are a closed set, so the distinction
   * is a lexical check.
   *
   * A spec without enumerations gets the enumeration's backing primitive instead, which is what
   * native writes; the set of allowed values is lost with it. */
  private _propertyTypeName(typeName: string, location: string): string {
    if (parsePrimitiveType(typeName) !== undefined)
      return typeName;
    if (!this._dialect.enumerationBackedProperties) {
      const enumeration = this._document.resolveItemOfType(typeName, SchemaItemType.Enumeration);
      if (enumeration !== undefined) {
        this._issues.addWarning("property-enumeration-dropped",
          `ECXML ${this._dialect.spec} has no enumerations, so "${location}" was written as its backing ${enumeration.backingType} and its allowed values were dropped.`,
          location);
        return enumeration.backingType;
      }
    }
    return this._toXmlItemReference(typeName, location);
  }

  private _emitProperty(property: Authoring.AnyProperty, className: string): void {
    const location = `${this._document.name}:${className}.${property.name}`;
    const common = this._commonPropertyAttributes(property, location);

    let elementName: string;
    let attributes: XmlAttribute[];
    if (property.isNavigation()) {
      if (this._dialect.navigationProperties) {
        elementName = "ECNavigationProperty";
        attributes = [
          common[0],
          ["relationshipName", this._toXmlItemReference(property.relationshipName, location)],
          ["direction", strengthDirectionToString(property.direction)],
          ...common.slice(1),
        ];
      } else {
        // 2.0 has no navigation property. Native writes the backing long instead of dropping the
        // property, so the instance data still has somewhere to live; the relationship is lost.
        this._issues.addWarning("property-navigation-relationship-dropped",
          `ECXML ${this._dialect.spec} has no navigation properties, so "${location}" was written as a long and its relationship was dropped.`,
          location);
        elementName = "ECProperty";
        attributes = [common[0], ["typeName", "long"], ...common.slice(1)];
      }
    } else if (property.isStruct()) {
      const isLegacyStructArray = property.isArray() && !this._dialect.structArrayElement;
      elementName = property.isArray() ? (this._dialect.structArrayElement ? "ECStructArrayProperty" : "ECArrayProperty") : "ECStructProperty";
      attributes = [
        common[0],
        ["typeName", this._toXmlItemReference(property.typeName, location)],
        ...common.slice(1),
        // Before 3.0 a struct array is an ECArrayProperty flagged isStruct.
        ["isStruct", isLegacyStructArray ? true : undefined],
        ...this._occursAttributes(property),
      ];
    } else {
      elementName = property.isArray() ? "ECArrayProperty" : "ECProperty";
      attributes = [
        common[0],
        ["typeName", this._propertyTypeName(property.typeName, location)],
        ...common.slice(1),
        ["extendedTypeName", property.extendedTypeName],
        [this._dialect.rangeAttributes === "camelCase" ? "minimumValue" : "MinimumValue", property.minValue],
        [this._dialect.rangeAttributes === "camelCase" ? "maximumValue" : "MaximumValue", property.maxValue],
        ["minimumLength", property.minLength],
        ["maximumLength", property.maxLength],
        ...this._occursAttributes(property),
      ];
    }

    if (property.customAttributes.size === 0) {
      this._xml.selfClosingElement(elementName, attributes);
    } else {
      this._xml.openElement(elementName, attributes);
      this._emitCustomAttributes(property.customAttributes, location);
      this._xml.closeElement(elementName);
    }
  }

  private _occursAttributes(property: Authoring.AnyProperty): XmlAttribute[] {
    if (!property.isArray())
      return [];
    // An unbounded array omits maxOccurs - one of the published spellings (the others being
    // maxOccurs="unbounded" in XML and 2147483647 in JSON, both normalized by the readers).
    return [
      ["minOccurs", property.minOccurs],
      ["maxOccurs", property.maxOccurs],
    ];
  }

  /** Endpoint bounds in the target's spelling. 2.0 and 3.0 write `cardinality="(0,N)"`, using `N`
   * for unbounded and a comma separator; 3.1 and later write the `(lo..hi)` multiplicity form. */
  private _formatConstraintBounds(multiplicity: string): string {
    if (this._dialect.constraintBoundsAttribute === "multiplicity")
      return multiplicity;
    const bounds = parseMultiplicity(multiplicity);
    return bounds === undefined ? multiplicity : formatLegacyCardinality(bounds);
  }

  private _emitEnumeration(item: Authoring.Enumeration): void {
    this._xml.openElement("ECEnumeration", [
      ...this._itemHeaderAttributes(item),
      ["backingTypeName", item.backingType],
      [this._dialect.enumerationStrictAttribute, item.isStrict],
    ]);
    for (const enumerator of item.enumerators) {
      this._xml.selfClosingElement("ECEnumerator", [
        // Before 3.2 an enumerator has no name attribute. The reader synthesizes the same name back
        // from the value, so a name that matches what synthesis would produce round-trips; one that
        // does not is a real loss and is reported.
        ["name", this._dialect.enumeratorNames ? enumerator.name : undefined],
        ["value", enumerator.value],
        ["displayLabel", enumerator.label],
        ["description", this._dialect.enumeratorNames ? enumerator.description : undefined],
      ]);
      if (!this._dialect.enumeratorNames) {
        const synthesized = ECName.encode(synthesizeEnumeratorName(item.name, enumerator.value)).name;
        if (enumerator.name !== synthesized) {
          this._issues.addWarning("enumerator-name-dropped",
            `ECXML ${this._dialect.spec} does not carry enumerator names, and "${enumerator.name}" differs from the "${synthesized}" a reader will derive from its value; the name was dropped.`,
            `${this._document.name}:${item.name}`);
        }
      }
    }
    this._xml.closeElement("ECEnumeration");
  }

  private _emitKindOfQuantity(item: Authoring.KindOfQuantity): void {
    // The references embedded in the override grammar are alias-qualified like any other item
    // reference in ECXML.
    const presentationUnits = item.presentationFormats
      .map((entry) => mapFormatStringReferences(entry, (reference) => this._toXmlItemReference(reference, item.name)));
    this._xml.selfClosingElement("KindOfQuantity", [
      ...this._itemHeaderAttributes(item),
      ["persistenceUnit", this._toXmlItemReference(item.persistenceUnit, item.name)],
      ["relativeError", item.relativeError],
      ["presentationUnits", presentationUnits.length > 0 ? presentationUnits.join(";") : undefined],
    ]);
  }

  private _emitPropertyCategory(item: Authoring.PropertyCategory): void {
    this._xml.selfClosingElement("PropertyCategory", [
      ...this._itemHeaderAttributes(item),
      ["priority", item.priority],
    ]);
  }

  private _emitSimpleItem(elementName: string, item: Authoring.SchemaItem, extraAttributes: XmlAttribute[]): void {
    this._xml.selfClosingElement(elementName, [...this._itemHeaderAttributes(item), ...extraAttributes]);
  }

  private _emitUnit(item: Authoring.Unit): void {
    this._xml.selfClosingElement("Unit", [
      ...this._itemHeaderAttributes(item),
      ["phenomenon", this._toXmlItemReference(item.phenomenon, item.name)],
      ["unitSystem", this._toXmlItemReference(item.unitSystem, item.name)],
      ["definition", item.definition],
      ["numerator", item.numerator],
      ["denominator", item.denominator],
      ["offset", item.offset],
    ]);
  }

  private _emitInvertedUnit(item: Authoring.InvertedUnit): void {
    this._xml.selfClosingElement("InvertedUnit", [
      ...this._itemHeaderAttributes(item),
      ["invertsUnit", this._toXmlItemReference(item.invertsUnit, item.name)],
      ["unitSystem", this._toXmlItemReference(item.unitSystem, item.name)],
    ]);
  }

  private _emitConstant(item: Authoring.Constant): void {
    this._xml.selfClosingElement("Constant", [
      ...this._itemHeaderAttributes(item),
      ["phenomenon", this._toXmlItemReference(item.phenomenon, item.name)],
      ["definition", item.definition],
      ["numerator", item.numerator],
      ["denominator", item.denominator],
    ]);
  }

  private _emitFormat(item: Authoring.Format): void {
    const attributes: XmlAttribute[] = [
      ...this._itemHeaderAttributes(item),
      ["type", item.type.toLowerCase()],
      ["precision", item.precision],
      ["roundFactor", item.roundFactor],
      ["minWidth", item.minWidth],
      ["showSignOption", item.showSignOption],
      ["formatTraits", item.formatTraits !== undefined ? formatTraitsToArray(item.formatTraits).join("|") : undefined],
      ["decimalSeparator", item.decimalSeparator],
      ["thousandSeparator", item.thousandSeparator],
      ["uomSeparator", item.uomSeparator],
      ["scientificType", item.scientificType],
      ["stationOffsetSize", item.stationOffsetSize],
      ["stationSeparator", item.stationSeparator],
    ];
    if (item.composite === undefined) {
      this._xml.selfClosingElement("Format", attributes);
      return;
    }
    this._xml.openElement("Format", attributes);
    this._xml.openElement("Composite", [
      ["spacer", item.composite.spacer],
      ["includeZero", item.composite.includeZero],
    ]);
    for (const unit of item.composite.units)
      this._xml.textElement("Unit", this._toXmlItemReference(unit.name, item.name), [["label", unit.label]]);
    this._xml.closeElement("Composite");
    this._xml.closeElement("Format");
  }
}
