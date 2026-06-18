/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { formatTraitsToArray } from "@itwin/core-quantity";
import { classModifierToString, containerTypeToString, parsePrimitiveType, SchemaItemType, strengthDirectionToString, strengthToString } from "../ECObjects";
import { SchemaView } from "../SchemaView/SchemaView";
import { customAttributeJsonToXml } from "./CustomAttributeConverter";
import * as Authoring from "./SchemaDocument";
import { ECSpec, mapFormatStringReferences, SchemaDocumentTextWriter, SchemaStreamWriteResult, SchemaTextSink, SchemaWriteOptions, SchemaWriteResult } from "./SchemaDocumentIO";
import { SchemaIssueList } from "./SchemaIssues";

/** The ECXML namespace URI of the 3.2 spec. */
const ECXML_3_2_NAMESPACE = "http://www.bentley.com/schemas/Bentley.ECXML.3.2";

/** Serializes a {@link Authoring.SchemaDocument} to ECXML text. The document always models the latest spec;
 * the writer converts to the requested spec version at this boundary (currently only
 * {@link ECSpec.V3_2} - older specs are future work and a different writer subclass/branch).
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
    const issues = new SchemaIssueList();
    const emitter = this._prepare(document, issues, options);
    if (emitter === undefined)
      return { issues };
    return { text: emitter.emit(), issues };
  }

  /** Streams the document to `sink` as ECXML text in chunks, never materializing it as one string, so
   * a schema of any size can be written. The whole document still passes through `sink`; concatenating
   * the chunks yields exactly what {@link writeDocument} returns. */
  public async writeDocumentTo(document: Authoring.SchemaDocument, sink: SchemaTextSink, options?: SchemaWriteOptions): Promise<SchemaStreamWriteResult> {
    const issues = new SchemaIssueList();
    const emitter = this._prepare(document, issues, options);
    if (emitter === undefined)
      return { issues };
    await emitter.emitTo(sink);
    return { issues };
  }

  /** Validates the target spec and constructs the emitter, or reports an unsupported spec and returns
   * `undefined`. Shared by the materializing and streaming entry points. */
  private _prepare(document: Authoring.SchemaDocument, issues: SchemaIssueList, options?: SchemaWriteOptions): ECXml32Emitter | undefined {
    const spec = options?.spec ?? ECSpec.Latest;
    if (spec !== ECSpec.V3_2) {
      issues.addError("SchemaXml-0001", `Unsupported target spec version "${spec as string}" - the XML writer currently supports only 3.2.`);
      return undefined;
    }
    return new ECXml32Emitter(document, issues, options?.schemaView);
  }
}

/** Escapes a string for use inside an XML attribute value. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Escapes a string for use as XML element text. */
function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  public rawBlock(text: string): void {
    const indent = this._indent();
    for (const line of text.split("\n"))
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
  public async drainTo(sink: SchemaTextSink): Promise<void> {
    await sink(`<?xml version="1.0" encoding="UTF-8"?>\n`);
    for (let start = 0; start < this._lines.length; start += XmlStringBuilder._linesPerChunk)
      await sink(`${this._lines.slice(start, start + XmlStringBuilder._linesPerChunk).join("\n")}\n`);
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

/** Emits one document as ECXML 3.2. Created per write; holds the document and the issue list. */
class ECXml32Emitter {
  private readonly _document: Authoring.SchemaDocument;
  private readonly _issues: SchemaIssueList;
  private readonly _schemaView: SchemaView | undefined;
  private readonly _xml = new XmlStringBuilder();

  public constructor(document: Authoring.SchemaDocument, issues: SchemaIssueList, schemaView: SchemaView | undefined) {
    this._document = document;
    this._issues = issues;
    this._schemaView = schemaView;
  }

  public emit(): string {
    this._build();
    return this._xml.toString();
  }

  /** Builds the document, then streams it to `sink` in chunks instead of returning one string. */
  public async emitTo(sink: SchemaTextSink): Promise<void> {
    this._build();
    await this._xml.drainTo(sink);
  }

  /** Walks the document and fills the builder. Synchronous - the chunking happens at drain time, so
   * the emit walk itself stays a plain recursive descent. */
  private _build(): void {
    const doc = this._document;
    this._xml.openElement("ECSchema", [
      ["schemaName", doc.name],
      ["alias", doc.alias],
      ["version", formatVersion(doc.readVersion, doc.writeVersion, doc.minorVersion)],
      ["displayLabel", doc.label],
      ["description", doc.description],
      ["xmlns", ECXML_3_2_NAMESPACE],
    ]);

    for (const reference of doc.references)
      this._emitSchemaReference(reference);

    this._emitCustomAttributes(doc.customAttributes);

    for (const item of doc.items)
      this._emitItem(item);

    this._xml.closeElement("ECSchema");
  }

  private _emitSchemaReference(reference: Authoring.SchemaReference): void {
    if (reference.alias === null) {
      this._issues.addError("SchemaXml-0002",
        `The reference to schema "${reference.name}" has no alias; ECXML requires one on every ECSchemaReference.`,
        { location: this._document.name });
    }
    this._xml.selfClosingElement("ECSchemaReference", [
      ["name", reference.name],
      ["version", formatVersion(reference.readVersion, reference.writeVersion, reference.minorVersion)],
      ["alias", reference.alias ?? undefined],
    ]);
  }

  /** Converts a stored item reference (local name or `Schema:Item` full name, either separator,
   * alias-qualified tolerated) to the alias-qualified form ECXML uses. */
  private _toXmlItemReference(reference: Authoring.LocalOrFullName, location: string): string {
    const separatorIndex = reference.search(/[.:]/);
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
          this._issues.addWarning("SchemaXml-0003",
            `Cannot alias-qualify "${reference}": the reference to schema "${schemaReference.name}" has no alias.`, { location });
          return `${qualifier}:${itemName}`;
        }
        return `${schemaReference.alias}:${itemName}`;
      }
      if (schemaReference.alias !== null && schemaReference.alias.toLowerCase() === qualifierLower)
        return `${schemaReference.alias}:${itemName}`; // already alias-qualified
    }

    this._issues.addWarning("SchemaXml-0004",
      `The item reference "${reference}" does not match this schema or any schema in the reference list; emitting it unchanged.`, { location });
    return `${qualifier}:${itemName}`;
  }

  /** Resolves the `xmlns` of a custom attribute element: the full name (`Schema.RR.WW.mm`) of the
   * schema defining the CA class, looked up from the reference list at emit time - the document
   * itself never stores a version on a CA reference. */
  private _customAttributeNamespace(className: string, location: string): { elementName: string, xmlns: string | undefined } {
    const separatorIndex = className.search(/[.:]/);
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
        return { elementName, xmlns: `${schemaReference.name}.${formatVersion(schemaReference.readVersion, schemaReference.writeVersion, schemaReference.minorVersion)}` };
    }

    this._issues.addWarning("SchemaXml-0005",
      `The custom attribute class "${className}" does not match this schema or any schema in the reference list; emitting without an xmlns.`, { location });
    return { elementName, xmlns: undefined };
  }

  private _ownNamespace(): string {
    const doc = this._document;
    return `${doc.name}.${formatVersion(doc.readVersion, doc.writeVersion, doc.minorVersion)}`;
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
      this._xml.rawBlock(body);
      this._xml.closeElement(elementName);
    }
    this._xml.closeElement("ECCustomAttributes");
  }

  /** The CA's value as a raw ECXML body: passthrough when it is already in XML form, otherwise
   * converted from its JSON value. Returns `""` for a valueless CA (emitted self-closing), or
   * `undefined` when a JSON value could not be expressed in XML - a struct array needing a CA class no
   * {@link _schemaView} supplied - in which case the CA is dropped and an issue has been reported. */
  private _customAttributeXmlBody(ca: Authoring.CustomAttribute, location: string): string | undefined {
    if (ca.format === Authoring.CustomAttributeFormat.Xml)
      return ca.xml ?? "";
    const json = ca.json;
    if (json === undefined || Object.keys(json).length === 0)
      return "";
    return customAttributeJsonToXml(json, ca.className,
      { schemaView: this._schemaView, ownerSchemaName: this._document.name, issues: this._issues, location });
  }

  private _emitItem(item: Authoring.AnySchemaItem): void {
    if (item.isEntity())
      return this._emitEntityClass(item);
    if (item.isMixin())
      return this._emitMixin(item);
    if (item.isStruct())
      return this._emitClass("ECStructClass", item, []);
    if (item.isCustomAttribute())
      return this._emitClass("ECCustomAttributeClass", item, [["appliesTo", containerTypeToString(item.appliesTo)]]);
    if (item.isRelationship())
      return this._emitRelationshipClass(item);
    switch (item.schemaItemType) {
      case SchemaItemType.Enumeration: return this._emitEnumeration(item);
      case SchemaItemType.KindOfQuantity: return this._emitKindOfQuantity(item);
      case SchemaItemType.PropertyCategory: return this._emitPropertyCategory(item);
      case SchemaItemType.UnitSystem: return this._emitSimpleItem("UnitSystem", item, []);
      case SchemaItemType.Phenomenon: return this._emitSimpleItem("Phenomenon", item, [["definition", item.definition]]);
      case SchemaItemType.Unit: return this._emitUnit(item);
      case SchemaItemType.InvertedUnit: return this._emitInvertedUnit(item);
      case SchemaItemType.Constant: return this._emitConstant(item);
      case SchemaItemType.Format: return this._emitFormat(item);
    }
  }

  private _itemHeaderAttributes(item: Authoring.SchemaItem): XmlAttribute[] {
    return [
      ["typeName", item.name],
      ["displayLabel", item.label],
      ["description", item.description],
    ];
  }

  private _modifierAttribute(item: Authoring.AnyClass): XmlAttribute {
    return ["modifier", item.modifier === undefined ? undefined : classModifierToString(item.modifier)];
  }

  private _emitEntityClass(item: Authoring.EntityClass): void {
    this._xml.openElement("ECEntityClass", [...this._itemHeaderAttributes(item), this._modifierAttribute(item)]);
    // The entity base class comes first, then the applied mixins - the order ECXML mandates.
    if (item.baseClass !== undefined)
      this._xml.textElement("BaseClass", this._toXmlItemReference(item.baseClass, item.name));
    for (const mixin of item.mixins)
      this._xml.textElement("BaseClass", this._toXmlItemReference(mixin, item.name));
    this._emitCustomAttributes(item.customAttributes, item.name);
    this._emitProperties(item);
    this._xml.closeElement("ECEntityClass");
  }

  private _emitMixin(item: Authoring.Mixin): void {
    // ECXML 3.2 has no first-class mixin: it is an entity class carrying the IsMixin custom attribute.
    this._xml.openElement("ECEntityClass", [...this._itemHeaderAttributes(item), this._modifierAttribute(item)]);
    if (item.baseClass !== undefined)
      this._xml.textElement("BaseClass", this._toXmlItemReference(item.baseClass, item.name));
    this._emitCustomAttributes(item.customAttributes, item.name, () => {
      const coreCa = this._document.getSchemaReference("CoreCustomAttributes");
      if (coreCa === undefined) {
        this._issues.addWarning("SchemaXml-0007",
          `The mixin "${item.name}" requires the IsMixin custom attribute, but "CoreCustomAttributes" is not in the reference list; emitting with a 01.00.00 namespace.`,
          { location: item.name });
      }
      const xmlns = coreCa !== undefined
        ? `CoreCustomAttributes.${formatVersion(coreCa.readVersion, coreCa.writeVersion, coreCa.minorVersion)}`
        : "CoreCustomAttributes.01.00.00";
      this._xml.openElement("IsMixin", [["xmlns", xmlns]]);
      this._xml.textElement("AppliesToEntityClass", this._toXmlItemReference(item.appliesTo, item.name));
      this._xml.closeElement("IsMixin");
    });
    this._emitProperties(item);
    this._xml.closeElement("ECEntityClass");
  }

  private _emitClass(elementName: string, item: Authoring.AnyClass, extraAttributes: XmlAttribute[]): void {
    this._xml.openElement(elementName, [...this._itemHeaderAttributes(item), this._modifierAttribute(item), ...extraAttributes]);
    if (item.baseClass !== undefined)
      this._xml.textElement("BaseClass", this._toXmlItemReference(item.baseClass, item.name));
    this._emitCustomAttributes(item.customAttributes, item.name);
    this._emitProperties(item);
    this._xml.closeElement(elementName);
  }

  private _emitRelationshipClass(item: Authoring.RelationshipClass): void {
    this._xml.openElement("ECRelationshipClass", [
      ...this._itemHeaderAttributes(item),
      // ECXML 3.1+ requires the modifier attribute on relationship classes (it is optional elsewhere),
      // so emit it unconditionally, falling back to the spec default when the document leaves it absent.
      ["modifier", classModifierToString(item.modifier ?? Authoring.SpecDefaults.classModifier)],
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
      ["multiplicity", constraint.multiplicity],
      ["roleLabel", constraint.roleLabel],
      ["polymorphic", constraint.polymorphic],
      ["abstractConstraint", constraint.abstractConstraint !== undefined ? this._toXmlItemReference(constraint.abstractConstraint, location) : undefined],
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
    return [
      ["propertyName", property.name],
      ["displayLabel", property.label],
      ["description", property.description],
      ["readOnly", property.isReadOnly],
      ["priority", property.priority],
      ["category", property.category !== undefined ? this._toXmlItemReference(property.category, location) : undefined],
      ["kindOfQuantity", property.kindOfQuantity !== undefined ? this._toXmlItemReference(property.kindOfQuantity, location) : undefined],
    ];
  }

  /** A property's `typeName` is a primitive keyword (emitted as-is) or an item reference (converted
   * to the alias-qualified XML form). The primitive keywords are a closed set, so the distinction
   * is a lexical check. */
  private _propertyTypeName(typeName: string, location: string): string {
    return parsePrimitiveType(typeName) !== undefined ? typeName : this._toXmlItemReference(typeName, location);
  }

  private _emitProperty(property: Authoring.AnyProperty, className: string): void {
    const location = `${this._document.name}:${className}.${property.name}`;
    const common = this._commonPropertyAttributes(property, location);

    let elementName: string;
    let attributes: XmlAttribute[];
    if (property.isNavigation()) {
      elementName = "ECNavigationProperty";
      attributes = [
        common[0],
        ["relationshipName", this._toXmlItemReference(property.relationshipName, location)],
        ["direction", strengthDirectionToString(property.direction)],
        ...common.slice(1),
      ];
    } else if (property.isStruct()) {
      elementName = property.isArray() ? "ECStructArrayProperty" : "ECStructProperty";
      attributes = [
        common[0],
        ["typeName", this._toXmlItemReference(property.typeName, location)],
        ...common.slice(1),
        ...this._occursAttributes(property),
      ];
    } else {
      elementName = property.isArray() ? "ECArrayProperty" : "ECProperty";
      attributes = [
        common[0],
        ["typeName", this._propertyTypeName(property.typeName, location)],
        ...common.slice(1),
        ["extendedTypeName", property.extendedTypeName],
        ["minimumValue", property.minValue],
        ["maximumValue", property.maxValue],
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

  private _emitEnumeration(item: Authoring.Enumeration): void {
    this._xml.openElement("ECEnumeration", [
      ...this._itemHeaderAttributes(item),
      ["backingTypeName", item.backingType],
      ["isStrict", item.isStrict],
    ]);
    for (const enumerator of item.enumerators) {
      this._xml.selfClosingElement("ECEnumerator", [
        ["name", enumerator.name],
        ["value", enumerator.value],
        ["displayLabel", enumerator.label],
        ["description", enumerator.description],
      ]);
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
