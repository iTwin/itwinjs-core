/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import * as sax from "sax";
import { parseFormatTrait, parseFormatType, parsePrecision, parseScientificType, parseShowSignOption } from "@itwin/core-quantity";
import {
  parseClassModifier, parseCustomAttributeContainerType, parsePrimitiveType, parseStrength, parseStrengthDirection, PrimitiveType,
} from "../ECObjects";
import { Authoring, SchemaDocument } from "./SchemaDocument";
import {
  decodeSchemaText, SchemaDocumentReadResult, SchemaDocumentTextReader, SchemaHeaderReadResult, SchemaText, SchemaTextReadOptions,
} from "./SchemaDocumentIO";
import { SchemaIssueList } from "./SchemaIssues";

/** Reads {@link SchemaDocument}s from ECXML text. Accepts any ECXML 3.x source (3.0 and 3.1 are
 * close subsets of 3.2) and records the source spec version on the document
 * ({@link SchemaDocument.originalECXmlVersionMajor}); EC 2.0 is a substantially different format
 * and is rejected until a dedicated reader exists.
 *
 * The reader is as lenient as the validity-free document allows: it reports problems as issues and
 * keeps whatever it could extract, leaving semantic judgment to the compiler. Custom attribute
 * values are kept untyped (strings and plain object/array shapes mirroring the XML structure) -
 * typing them requires the CA class definition, which is resolved at compile, not read.
 * @alpha
 */
export class SchemaXmlReader implements SchemaDocumentTextReader {
  /** Reads a full document. The result carries no document only when the input is unusable
   * (malformed XML, not an ECSchema, an unsupported spec). */
  public async readDocument(text: SchemaText, options?: SchemaTextReadOptions): Promise<SchemaDocumentReadResult> {
    const issues = new SchemaIssueList();
    const root = await parseElementTree(text, issues, options?.source);
    if (root === undefined)
      return { issues };
    const walker = new EcXml3Walker(issues, options?.source);
    return { document: walker.readSchema(root), issues };
  }

  /** Reads only the schema's identity and reference list, stopping at the first schema item -
   * on a streamed input no further chunks are pulled past that point, so peeking a very large
   * file reads only its leading kilobytes. This is the peek schema discovery is built on.
   * Relies on references preceding items, which the spec's content model mandates. */
  public async readHeader(text: SchemaText, options?: SchemaTextReadOptions): Promise<SchemaHeaderReadResult> {
    const issues = new SchemaIssueList();
    const source = options?.source;

    let name: string | undefined;
    let version: { read: number, write: number, minor: number } | undefined;
    let alias: string | undefined;
    const references: Authoring.SchemaReference[] = [];

    const stopSentinel = new Error("header complete");
    const parser = sax.parser(true, { position: true });
    let depth = 0;
    parser.onerror = (error: Error) => {
      issues.addError("SchemaXml-0010", `Malformed XML: ${error.message}`, { source, line: parser.line + 1, column: parser.column + 1 });
      throw stopSentinel;
    };
    parser.onopentag = (tag: sax.Tag | sax.QualifiedTag) => {
      ++depth;
      const tagName = tag.name.toLowerCase();
      const attributes = tag.attributes as { [name: string]: string };
      if (depth === 1) {
        if (tagName !== "ecschema") {
          issues.addError("SchemaXml-0011", `Expected an ECSchema root element, found "${tag.name}".`, { source });
          throw stopSentinel;
        }
        name = attributes.schemaName;
        alias = attributes.alias;
        version = parseVersionString(attributes.version);
        return;
      }
      if (depth === 2) {
        if (tagName === "ecschemareference") {
          const reference = readSchemaReferenceAttributes(attributes, issues, source);
          if (reference !== undefined)
            references.push(reference);
          return;
        }
        // References precede everything else we care about; the first non-reference child ends the peek.
        if (tagName !== "eccustomattributes")
          throw stopSentinel;
      }
    };
    parser.onclosetag = () => {
      --depth;
      if (depth === 0)
        throw stopSentinel; // reference-only schema: the root just closed
    };

    // The sentinel thrown from a sax handler propagates out of `parser.write`, terminating the
    // loop - which closes the source iterator, so no further input is read or even produced.
    try {
      for await (const chunk of decodeSchemaText(text))
        parser.write(chunk);
      parser.close();
    } catch (error) {
      if (error !== stopSentinel)
        throw error;
    }

    if (name === undefined || version === undefined) {
      if (!issues.hasErrors)
        issues.addError("SchemaXml-0012", "The ECSchema element is missing its schemaName or a parseable version.", { source });
      return { issues };
    }
    return {
      header: { name, readVersion: version.read, writeVersion: version.write, minorVersion: version.minor, alias, references },
      issues,
    };
  }
}

/** A lightweight element-tree node built from the sax event stream. Schemas are small enough that
 * materializing the tree costs little, and walking a tree keeps the per-element logic readable and
 * lets a future spec-version reader share the tokenization. */
interface XmlElementNode {
  name: string;
  attributes: { [name: string]: string };
  children: XmlElementNode[];
  text: string;
  line: number;
  column: number;
}

async function parseElementTree(text: SchemaText, issues: SchemaIssueList, source: string | undefined): Promise<XmlElementNode | undefined> {
  const parser = sax.parser(true, { position: true });
  const stopSentinel = new Error("parse failed");
  let root: XmlElementNode | undefined;
  const stack: XmlElementNode[] = [];

  parser.onerror = (error: Error) => {
    issues.addError("SchemaXml-0010", `Malformed XML: ${error.message}`, { source, line: parser.line + 1, column: parser.column + 1 });
    throw stopSentinel;
  };
  parser.onopentag = (tag: sax.Tag | sax.QualifiedTag) => {
    const node: XmlElementNode = {
      name: tag.name,
      attributes: tag.attributes as { [name: string]: string },
      children: [],
      text: "",
      line: parser.line + 1,
      column: parser.column + 1,
    };
    if (stack.length === 0)
      root = node;
    else
      stack[stack.length - 1].children.push(node);
    stack.push(node);
  };
  parser.onclosetag = () => {
    stack.pop();
  };
  const appendText = (value: string) => {
    if (stack.length > 0)
      stack[stack.length - 1].text += value;
  };
  parser.ontext = appendText;
  parser.oncdata = appendText;

  try {
    for await (const chunk of decodeSchemaText(text))
      parser.write(chunk);
    parser.close();
  } catch (error) {
    if (error !== stopSentinel)
      throw error;
    return undefined;
  }
  return root;
}

function parseVersionString(version: string | undefined): { read: number, write: number, minor: number } | undefined {
  if (version === undefined)
    return undefined;
  const parts = version.split(".");
  if (parts.length !== 3)
    return undefined;
  const [read, write, minor] = parts.map((part) => parseInt(part, 10));
  if (isNaN(read) || isNaN(write) || isNaN(minor))
    return undefined;
  return { read, write, minor };
}

function readSchemaReferenceAttributes(attributes: { [name: string]: string }, issues: SchemaIssueList, source: string | undefined): Authoring.SchemaReference | undefined {
  const name = attributes.name;
  const version = parseVersionString(attributes.version);
  if (name === undefined || version === undefined) {
    issues.addError("SchemaXml-0013", "An ECSchemaReference is missing its name or a parseable version.", { source });
    return undefined;
  }
  return { name, readVersion: version.read, writeVersion: version.write, minorVersion: version.minor, alias: attributes.alias ?? null };
}

/** The ECXML namespace pattern; the captured groups carry the spec version. */
const ECXML_NAMESPACE_PATTERN = /Bentley\.ECXML\.(\d+)\.(\d+)$/;

/** The item element names of ECXML 3.x, lowercase. */
const ITEM_ELEMENT_NAMES = new Set([
  "ecentityclass", "ecstructclass", "eccustomattributeclass", "ecrelationshipclass", "ecenumeration",
  "kindofquantity", "propertycategory", "unitsystem", "phenomenon", "unit", "invertedunit", "constant", "format",
]);

/** Walks a parsed element tree into a SchemaDocument. Created per read. */
class EcXml3Walker {
  private readonly _issues: SchemaIssueList;
  private readonly _source: string | undefined;
  /** Lowercased reference alias -> schema name, for normalizing alias-qualified references. */
  private readonly _aliasToSchemaName = new Map<string, string>();
  private _documentInProgress?: SchemaDocument;

  public constructor(issues: SchemaIssueList, source: string | undefined) {
    this._issues = issues;
    this._source = source;
  }

  /** The document under construction. Set at the start of {@link readSchema}; every item/property
   * reader runs within that call, so accessing it earlier is a programming error. */
  private get _document(): SchemaDocument {
    if (this._documentInProgress === undefined)
      throw new Error("SchemaXmlReader: the document is accessed before readSchema initialized it.");
    return this._documentInProgress;
  }

  public readSchema(root: XmlElementNode): SchemaDocument | undefined {
    if (root.name.toLowerCase() !== "ecschema") {
      this._error("SchemaXml-0011", `Expected an ECSchema root element, found "${root.name}".`, root);
      return undefined;
    }

    const namespaceMatch = ECXML_NAMESPACE_PATTERN.exec(root.attributes.xmlns ?? "");
    if (namespaceMatch === null) {
      this._error("SchemaXml-0014", `The ECSchema element has a missing or unrecognized xmlns ("${root.attributes.xmlns ?? ""}").`, root);
      return undefined;
    }
    const specMajor = parseInt(namespaceMatch[1], 10);
    const specMinor = parseInt(namespaceMatch[2], 10);
    if (specMajor !== 3) {
      this._error("SchemaXml-0015", `Unsupported ECXML spec version ${specMajor}.${specMinor} - this reader handles 3.x.`, root);
      return undefined;
    }

    const name = root.attributes.schemaName;
    const alias = root.attributes.alias;
    const version = parseVersionString(root.attributes.version);
    if (name === undefined || version === undefined) {
      this._error("SchemaXml-0012", "The ECSchema element is missing its schemaName or a parseable version.", root);
      return undefined;
    }
    if (alias === undefined)
      this._error("SchemaXml-0016", `The schema "${name}" is missing the required alias attribute.`, root);

    const document = new SchemaDocument(name, alias ?? "", version.read, version.write, version.minor, {
      label: root.attributes.displayLabel,
      description: root.attributes.description,
      originalECXmlVersionMajor: specMajor,
      originalECXmlVersionMinor: specMinor,
      source: this._source,
    });
    this._documentInProgress = document;
    this._aliasToSchemaName.set(document.alias.toLowerCase(), document.name);

    // References first, so item-reference normalization sees the full alias map.
    for (const child of root.children) {
      if (child.name.toLowerCase() !== "ecschemareference")
        continue;
      const reference = readSchemaReferenceAttributes(child.attributes, this._issues, this._source);
      if (reference !== undefined) {
        document.setSchemaReference(reference);
        if (reference.alias !== null)
          this._aliasToSchemaName.set(reference.alias.toLowerCase(), reference.name);
      }
    }

    for (const child of root.children) {
      const childName = child.name.toLowerCase();
      if (childName === "ecschemareference")
        continue;
      if (childName === "eccustomattributes") {
        this.readCustomAttributes(child, document.customAttributes, document.name);
        continue;
      }
      if (ITEM_ELEMENT_NAMES.has(childName)) {
        this.readItem(child);
        continue;
      }
      this._warning("SchemaXml-0017", `Unrecognized schema child element "${child.name}" was skipped.`, child);
    }

    return document;
  }

  // ===== Item dispatch =====

  private readItem(node: XmlElementNode): void {
    switch (node.name.toLowerCase()) {
      case "ecentityclass": return this.readEntityOrMixin(node);
      case "ecstructclass": return this.readStructClass(node);
      case "eccustomattributeclass": return this.readCustomAttributeClass(node);
      case "ecrelationshipclass": return this.readRelationshipClass(node);
      case "ecenumeration": return this.readEnumeration(node);
      case "kindofquantity": return this.readKindOfQuantity(node);
      case "propertycategory": return this.readPropertyCategory(node);
      case "unitsystem": return this.readUnitSystem(node);
      case "phenomenon": return this.readPhenomenon(node);
      case "unit": return this.readUnit(node);
      case "invertedunit": return this.readInvertedUnit(node);
      case "constant": return this.readConstant(node);
      case "format": return this.readFormat(node);
    }
  }

  private itemName(node: XmlElementNode): string | undefined {
    const name = node.attributes.typeName;
    if (name === undefined)
      this._error("SchemaXml-0018", `A ${node.name} element is missing the required typeName attribute; the item was skipped.`, node);
    return name;
  }

  private itemInit(node: XmlElementNode): Authoring.SchemaItemInit {
    return { label: node.attributes.displayLabel, description: node.attributes.description };
  }

  private classInit(node: XmlElementNode, baseClasses: Authoring.LocalOrFullName[]): Authoring.ClassInit {
    const init: Authoring.ClassInit = this.itemInit(node);
    const modifierText = node.attributes.modifier;
    if (modifierText !== undefined) {
      const modifier = parseClassModifier(modifierText);
      if (modifier === undefined)
        this._warning("SchemaXml-0019", `Unrecognized class modifier "${modifierText}" was ignored.`, node);
      else
        init.modifier = modifier;
    }
    init.baseClass = baseClasses[0];
    return init;
  }

  private readBaseClassReferences(node: XmlElementNode): Authoring.LocalOrFullName[] {
    const references: Authoring.LocalOrFullName[] = [];
    for (const child of node.children) {
      if (child.name.toLowerCase() === "baseclass")
        references.push(this.normalizeItemReference(child.text.trim()));
    }
    return references;
  }

  private readEntityOrMixin(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const baseClasses = this.readBaseClassReferences(node);

    // ECXML 3.2 has no first-class mixin: detect the IsMixin custom attribute and promote it,
    // consuming the CA. Everything else in ECCustomAttributes stays an ordinary instance.
    const caContainer = this.findChild(node, "eccustomattributes");
    const isMixinNode = caContainer !== undefined ? this.findChild(caContainer, "ismixin") : undefined;

    if (isMixinNode !== undefined) {
      const appliesToNode = this.findChild(isMixinNode, "appliestoentityclass");
      let appliesTo = "";
      if (appliesToNode === undefined)
        this._error("SchemaXml-0020", `The mixin "${name}" has an IsMixin custom attribute without the AppliesToEntityClass property.`, isMixinNode);
      else
        appliesTo = this.normalizeItemReference(appliesToNode.text.trim());
      const mixin = this._document.createMixin(name, appliesTo, this.classInit(node, baseClasses));
      if (baseClasses.length > 1)
        this._warning("SchemaXml-0021", `The mixin "${name}" lists more than one BaseClass; only the first was kept.`, node);
      this.readClassContent(node, mixin, { skipCustomAttribute: "ismixin" });
      return;
    }

    const entity = this._document.createEntity(name, this.classInit(node, baseClasses));
    // A bare BaseClass entry does not reveal whether it names a class or a mixin; the first goes
    // to baseClass and the rest to mixins, and the compiler reconciles misplacements.
    entity.mixins.push(...baseClasses.slice(1));
    this.readClassContent(node, entity);
  }

  private readStructClass(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const item = this._document.createStructClass(name, this.classInit(node, this.readBaseClassReferences(node)));
    this.readClassContent(node, item);
  }

  private readCustomAttributeClass(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    let appliesTo = 0;
    const appliesToText = node.attributes.appliesTo;
    if (appliesToText === undefined) {
      this._error("SchemaXml-0022", `The custom attribute class "${name}" is missing the required appliesTo attribute.`, node);
    } else {
      try {
        appliesTo = parseCustomAttributeContainerType(appliesToText) ?? 0;
      } catch {
        this._error("SchemaXml-0023", `The custom attribute class "${name}" has an unparseable appliesTo ("${appliesToText}").`, node);
      }
    }
    const item = this._document.createCustomAttributeClass(name, appliesTo, this.classInit(node, this.readBaseClassReferences(node)));
    this.readClassContent(node, item);
  }

  private readRelationshipClass(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const init: Authoring.RelationshipClassInit = this.classInit(node, this.readBaseClassReferences(node));
    if (node.attributes.strength !== undefined) {
      init.strength = parseStrength(node.attributes.strength);
      if (init.strength === undefined)
        this._warning("SchemaXml-0024", `Unrecognized relationship strength "${node.attributes.strength}" was ignored.`, node);
    }
    if (node.attributes.strengthDirection !== undefined) {
      init.strengthDirection = parseStrengthDirection(node.attributes.strengthDirection);
      if (init.strengthDirection === undefined)
        this._warning("SchemaXml-0025", `Unrecognized strengthDirection "${node.attributes.strengthDirection}" was ignored.`, node);
    }
    const item = this._document.createRelationship(name, init);
    this.readClassContent(node, item);

    const sourceNode = this.findChild(node, "source");
    const targetNode = this.findChild(node, "target");
    if (sourceNode !== undefined)
      this.readRelationshipConstraint(sourceNode, item.source, name);
    else
      this._error("SchemaXml-0026", `The relationship class "${name}" is missing its Source constraint.`, node);
    if (targetNode !== undefined)
      this.readRelationshipConstraint(targetNode, item.target, name);
    else
      this._error("SchemaXml-0026", `The relationship class "${name}" is missing its Target constraint.`, node);
  }

  private readRelationshipConstraint(node: XmlElementNode, constraint: Authoring.RelationshipConstraint, className: string): void {
    if (node.attributes.multiplicity !== undefined)
      constraint.multiplicity = node.attributes.multiplicity;
    constraint.roleLabel = node.attributes.roleLabel;
    if (node.attributes.polymorphic !== undefined)
      constraint.polymorphic = this.parseBooleanAttribute(node, "polymorphic") ?? constraint.polymorphic;
    if (node.attributes.abstractConstraint !== undefined)
      constraint.abstractConstraint = this.normalizeItemReference(node.attributes.abstractConstraint);
    for (const child of node.children) {
      const childName = child.name.toLowerCase();
      if (childName === "class") {
        const classReference = child.attributes.class;
        if (classReference === undefined)
          this._error("SchemaXml-0027", `A constraint Class element of "${className}" is missing the class attribute.`, child);
        else
          constraint.constraintClasses.push(this.normalizeItemReference(classReference));
      } else if (childName === "eccustomattributes") {
        this.readCustomAttributes(child, constraint.customAttributes, className);
      }
    }
  }

  /** Reads the children shared by every class kind: properties and custom attributes.
   * BaseClass / Source / Target are consumed by the per-kind callers. */
  private readClassContent(node: XmlElementNode, item: Authoring.AnyClass, options?: { skipCustomAttribute?: string }): void {
    for (const child of node.children) {
      const childName = child.name.toLowerCase();
      switch (childName) {
        case "baseclass":
        case "source":
        case "target":
          break;
        case "eccustomattributes":
          this.readCustomAttributes(child, item.customAttributes, item.name, options?.skipCustomAttribute);
          break;
        case "ecproperty":
        case "ecarrayproperty":
        case "ecstructproperty":
        case "ecstructarrayproperty":
        case "ecnavigationproperty":
          this.readProperty(child, item);
          break;
        default:
          this._warning("SchemaXml-0017", `Unrecognized child element "${child.name}" of class "${item.name}" was skipped.`, child);
          break;
      }
    }
  }

  // ===== Properties =====

  private readProperty(node: XmlElementNode, item: Authoring.AnyClass): void {
    const name = node.attributes.propertyName;
    if (name === undefined) {
      this._error("SchemaXml-0028", `A ${node.name} element of class "${item.name}" is missing the required propertyName attribute; the property was skipped.`, node);
      return;
    }

    let property: Authoring.AnyProperty | undefined;
    switch (node.name.toLowerCase()) {
      case "ecproperty": {
        const type = this.resolvePrimitivePropertyType(node, name, item.name);
        if (type === undefined)
          return;
        const init = this.primitivePropertyInit(node);
        property = "primitiveType" in type
          ? item.createPrimitive(name, type.primitiveType, init)
          : item.createEnumeration(name, type.enumeration, init);
        break;
      }
      case "ecarrayproperty": {
        const type = this.resolvePrimitivePropertyType(node, name, item.name);
        if (type === undefined)
          return;
        const init = { ...this.primitivePropertyInit(node), ...this.occursInit(node) };
        property = "primitiveType" in type
          ? item.createPrimitiveArray(name, type.primitiveType, init)
          : item.createEnumerationArray(name, type.enumeration, init);
        break;
      }
      case "ecstructproperty": {
        const typeName = this.propertyTypeName(node, name, item.name);
        if (typeName === undefined)
          return;
        property = item.createStruct(name, typeName, this.propertyInit(node));
        break;
      }
      case "ecstructarrayproperty": {
        const typeName = this.propertyTypeName(node, name, item.name);
        if (typeName === undefined)
          return;
        property = item.createStructArray(name, typeName, { ...this.propertyInit(node), ...this.occursInit(node) });
        break;
      }
      case "ecnavigationproperty": {
        const relationshipName = node.attributes.relationshipName;
        const direction = node.attributes.direction !== undefined ? parseStrengthDirection(node.attributes.direction) : undefined;
        if (relationshipName === undefined || direction === undefined) {
          this._error("SchemaXml-0029", `The navigation property "${item.name}.${name}" is missing relationshipName or a parseable direction; the property was skipped.`, node);
          return;
        }
        property = item.createNavigation(name, this.normalizeItemReference(relationshipName), direction, this.propertyInit(node));
        break;
      }
    }

    const caContainer = this.findChild(node, "eccustomattributes");
    if (property !== undefined && caContainer !== undefined)
      this.readCustomAttributes(caContainer, property.customAttributes, `${item.name}.${name}`);
  }

  /** A struct property's `typeName` is always a struct-class reference, so it is normalized to the
   * full schema-qualified form. */
  private propertyTypeName(node: XmlElementNode, propertyName: string, className: string): string | undefined {
    const typeName = node.attributes.typeName;
    if (typeName === undefined) {
      this._error("SchemaXml-0030", `The property "${className}.${propertyName}" is missing the required typeName attribute; the property was skipped.`, node);
      return undefined;
    }
    return this.normalizeItemReference(typeName);
  }

  /** Resolves a primitive/array property's `typeName`: a primitive keyword parses to a
   * {@link PrimitiveType}, anything else is an enumeration reference and is normalized. Returns
   * `undefined` (after reporting it) when the attribute is missing. */
  private resolvePrimitivePropertyType(node: XmlElementNode, propertyName: string, className: string):
    { primitiveType: PrimitiveType } | { enumeration: string } | undefined {
    const typeName = node.attributes.typeName;
    if (typeName === undefined) {
      this._error("SchemaXml-0030", `The property "${className}.${propertyName}" is missing the required typeName attribute; the property was skipped.`, node);
      return undefined;
    }
    const primitiveType = parsePrimitiveType(typeName);
    return primitiveType !== undefined ? { primitiveType } : { enumeration: this.normalizeItemReference(typeName) };
  }

  private propertyInit(node: XmlElementNode): Authoring.PropertyInit {
    return {
      label: node.attributes.displayLabel,
      description: node.attributes.description,
      isReadOnly: this.parseBooleanAttribute(node, "readOnly"),
      priority: this.parseIntAttribute(node, "priority"),
      category: node.attributes.category !== undefined ? this.normalizeItemReference(node.attributes.category) : undefined,
      kindOfQuantity: node.attributes.kindOfQuantity !== undefined ? this.normalizeItemReference(node.attributes.kindOfQuantity) : undefined,
    };
  }

  private primitivePropertyInit(node: XmlElementNode): Authoring.PrimitivePropertyInit {
    return {
      ...this.propertyInit(node),
      extendedTypeName: node.attributes.extendedTypeName,
      minValue: this.parseFloatAttribute(node, "minimumValue"),
      maxValue: this.parseFloatAttribute(node, "maximumValue"),
      minLength: this.parseIntAttribute(node, "minimumLength"),
      maxLength: this.parseIntAttribute(node, "maximumLength"),
    };
  }

  private occursInit(node: XmlElementNode): { minOccurs?: number, maxOccurs?: number } {
    const maxOccursText = node.attributes.maxOccurs;
    return {
      minOccurs: this.parseIntAttribute(node, "minOccurs"),
      maxOccurs: maxOccursText === undefined || maxOccursText.toLowerCase() === "unbounded" ? undefined : this.parseIntAttribute(node, "maxOccurs"),
    };
  }

  // ===== Non-class items =====

  private readEnumeration(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const backingTypeText = (node.attributes.backingTypeName ?? "").toLowerCase();
    let backingType: Authoring.EnumerationBackingType;
    if (backingTypeText === "int" || backingTypeText === "integer")
      backingType = "int";
    else if (backingTypeText === "string")
      backingType = "string";
    else {
      this._error("SchemaXml-0031", `The enumeration "${name}" has a missing or unsupported backingTypeName ("${node.attributes.backingTypeName ?? ""}"); the item was skipped.`, node);
      return;
    }
    const item = this._document.createEnumeration(name, backingType, {
      ...this.itemInit(node),
      isStrict: this.parseBooleanAttribute(node, "isStrict"),
    });
    for (const child of node.children) {
      if (child.name.toLowerCase() !== "ecenumerator")
        continue;
      const enumeratorName = child.attributes.name;
      const valueText = child.attributes.value;
      if (enumeratorName === undefined || valueText === undefined) {
        this._error("SchemaXml-0032", `An enumerator of "${name}" is missing its name or value; it was skipped.`, child);
        continue;
      }
      let value: number | string = valueText;
      if (backingType === "int") {
        value = parseInt(valueText, 10);
        if (isNaN(value)) {
          this._error("SchemaXml-0033", `The enumerator "${name}.${enumeratorName}" has a non-integer value "${valueText}" on an int enumeration; it was skipped.`, child);
          continue;
        }
      }
      item.createEnumerator(enumeratorName, value, { label: child.attributes.displayLabel, description: child.attributes.description });
    }
  }

  private readKindOfQuantity(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const persistenceUnit = node.attributes.persistenceUnit;
    const relativeError = this.parseFloatAttribute(node, "relativeError");
    if (persistenceUnit === undefined || relativeError === undefined) {
      this._error("SchemaXml-0034", `The kind of quantity "${name}" is missing persistenceUnit or a parseable relativeError; the item was skipped.`, node);
      return;
    }
    // Presentation format strings stay verbatim; the override grammar is parsed at compile.
    const presentationFormats = node.attributes.presentationUnits !== undefined
      ? node.attributes.presentationUnits.split(";").map((entry) => entry.trim()).filter((entry) => entry.length > 0)
      : undefined;
    this._document.createKindOfQuantity(name, this.normalizeItemReference(persistenceUnit), relativeError, {
      ...this.itemInit(node),
      presentationFormats,
    });
  }

  private readPropertyCategory(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    this._document.createPropertyCategory(name, { ...this.itemInit(node), priority: this.parseIntAttribute(node, "priority") });
  }

  private readUnitSystem(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name !== undefined)
      this._document.createUnitSystem(name, this.itemInit(node));
  }

  private readPhenomenon(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const definition = node.attributes.definition;
    if (definition === undefined) {
      this._error("SchemaXml-0035", `The phenomenon "${name}" is missing the required definition attribute; the item was skipped.`, node);
      return;
    }
    this._document.createPhenomenon(name, definition, this.itemInit(node));
  }

  private readUnit(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const { phenomenon, unitSystem, definition } = node.attributes;
    if (phenomenon === undefined || unitSystem === undefined || definition === undefined) {
      this._error("SchemaXml-0036", `The unit "${name}" is missing phenomenon, unitSystem, or definition; the item was skipped.`, node);
      return;
    }
    this._document.createUnit(name, this.normalizeItemReference(phenomenon), this.normalizeItemReference(unitSystem), definition, {
      ...this.itemInit(node),
      numerator: this.parseFloatAttribute(node, "numerator"),
      denominator: this.parseFloatAttribute(node, "denominator"),
      offset: this.parseFloatAttribute(node, "offset"),
    });
  }

  private readInvertedUnit(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const { invertsUnit, unitSystem } = node.attributes;
    if (invertsUnit === undefined || unitSystem === undefined) {
      this._error("SchemaXml-0037", `The inverted unit "${name}" is missing invertsUnit or unitSystem; the item was skipped.`, node);
      return;
    }
    this._document.createInvertedUnit(name, this.normalizeItemReference(invertsUnit), this.normalizeItemReference(unitSystem), this.itemInit(node));
  }

  private readConstant(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const { phenomenon, definition } = node.attributes;
    if (phenomenon === undefined || definition === undefined) {
      this._error("SchemaXml-0038", `The constant "${name}" is missing phenomenon or definition; the item was skipped.`, node);
      return;
    }
    this._document.createConstant(name, this.normalizeItemReference(phenomenon), definition, {
      ...this.itemInit(node),
      numerator: this.parseFloatAttribute(node, "numerator"),
      denominator: this.parseFloatAttribute(node, "denominator"),
    });
  }

  private readFormat(node: XmlElementNode): void {
    const name = this.itemName(node);
    if (name === undefined)
      return;
    const typeText = node.attributes.type;
    if (typeText === undefined) {
      this._error("SchemaXml-0039", `The format "${name}" is missing the required type attribute; the item was skipped.`, node);
      return;
    }
    const init: Authoring.FormatInit = this.itemInit(node);
    try {
      const type = parseFormatType(typeText, name);
      const precision = this.parseIntAttribute(node, "precision");
      if (precision !== undefined)
        init.precision = parsePrecision(precision, type, name);
      if (node.attributes.showSignOption !== undefined)
        init.showSignOption = parseShowSignOption(node.attributes.showSignOption, name);
      if (node.attributes.scientificType !== undefined)
        init.scientificType = parseScientificType(node.attributes.scientificType, name);
      if (node.attributes.formatTraits !== undefined) {
        let traits = 0;
        for (const trait of node.attributes.formatTraits.split(/[|,;]/)) {
          if (trait.trim().length > 0)
            traits |= parseFormatTrait(trait.trim(), name);
        }
        init.formatTraits = traits;
      }
      init.roundFactor = this.parseFloatAttribute(node, "roundFactor");
      init.minWidth = this.parseIntAttribute(node, "minWidth");
      init.decimalSeparator = node.attributes.decimalSeparator;
      init.thousandSeparator = node.attributes.thousandSeparator;
      init.uomSeparator = node.attributes.uomSeparator;
      init.stationOffsetSize = this.parseIntAttribute(node, "stationOffsetSize");
      init.stationSeparator = node.attributes.stationSeparator;

      const compositeNode = this.findChild(node, "composite");
      if (compositeNode !== undefined) {
        const units: Authoring.FormatCompositeUnit[] = [];
        for (const unitNode of compositeNode.children) {
          if (unitNode.name.toLowerCase() === "unit")
            units.push({ name: this.normalizeItemReference(unitNode.text.trim()), label: unitNode.attributes.label });
        }
        init.composite = {
          spacer: compositeNode.attributes.spacer,
          includeZero: this.parseBooleanAttribute(compositeNode, "includeZero"),
          units,
        };
      }

      this._document.createFormat(name, type, init);
    } catch (error) {
      this._error("SchemaXml-0040", `The format "${name}" could not be read: ${error instanceof Error ? error.message : String(error)}; the item was skipped.`, node);
    }
  }

  // ===== Custom attributes =====

  /** Reads an `<ECCustomAttributes>` container into a set. The CA class is identified by the entry
   * element's name plus its `xmlns` (`Schema.RR.WW.mm` - the version is a serialization artifact
   * and is dropped). Values stay untyped: without the CA class definition the reader cannot type
   * them, so they keep the structural shape of the XML and are typed at compile - the same split
   * ECDb's XmlCAToJson conversion makes, which types values against the resolved class. */
  private readCustomAttributes(container: XmlElementNode, target: Authoring.CustomAttributeSet, _location: string, skipElementName?: string): void {
    for (const caNode of container.children) {
      if (skipElementName !== undefined && caNode.name.toLowerCase() === skipElementName)
        continue;
      const xmlns = caNode.attributes.xmlns;
      let className = caNode.name;
      if (xmlns !== undefined) {
        const schemaName = xmlns.split(".")[0];
        if (schemaName.length > 0 && schemaName.toLowerCase() !== this._document.name.toLowerCase())
          className = `${schemaName}:${caNode.name}`;
      }
      const properties = this.readCustomAttributeStruct(caNode);
      target.add(properties !== undefined ? { className, properties } : { className });
    }
  }

  /** An element whose children are property elements -> a plain object, or `undefined` when empty. */
  private readCustomAttributeStruct(node: XmlElementNode): { [name: string]: unknown } | undefined {
    if (node.children.length === 0)
      return undefined;
    const result: { [name: string]: unknown } = {};
    for (const child of node.children)
      result[child.name] = this.readCustomAttributeValue(child);
    return result;
  }

  /** Maps one CA property element to an untyped value:
   * - text only -> the string
   * - children named by a primitive keyword -> an array of strings (primitive array)
   * - two or more children sharing another name -> an array of single-key objects, the key keeping
   *   the entry element name (struct array; the bag has nowhere else to carry it)
   * - anything else -> a nested object (struct)
   * A one-entry struct array is indistinguishable from a struct without the class definition; the
   * heuristic prefers the struct reading. */
  private readCustomAttributeValue(node: XmlElementNode): unknown {
    if (node.children.length === 0)
      return node.text.trim();

    const firstName = node.children[0].name;
    const allSameName = node.children.every((child) => child.name === firstName);

    if (allSameName && parsePrimitiveType(firstName) !== undefined)
      return node.children.map((child) => child.text.trim());

    if (allSameName && node.children.length >= 2)
      return node.children.map((child) => ({ [child.name]: this.readCustomAttributeStruct(child) ?? {} }));

    return this.readCustomAttributeStruct(node) ?? {};
  }

  // ===== Shared helpers =====

  /** Returns the first child element with the given lowercase name, or `undefined`. */
  private findChild(node: XmlElementNode, lowerCaseName: string): XmlElementNode | undefined {
    return node.children.find((child) => child.name.toLowerCase() === lowerCaseName);
  }

  /** Normalizes an item reference read from XML: the alias-qualified form becomes the full-name
   * form (`bis:PhysicalElement` -> `BisCore:PhysicalElement`), a reference into this schema becomes
   * a bare local name. Unknown qualifiers are left as written for the compiler to diagnose. */
  private normalizeItemReference(reference: string): Authoring.LocalOrFullName {
    const separatorIndex = reference.search(/[.:]/);
    if (separatorIndex < 0)
      return reference;
    const qualifier = reference.substring(0, separatorIndex).toLowerCase();
    const itemName = reference.substring(separatorIndex + 1);
    const document = this._document;
    if (qualifier === document.name.toLowerCase() || qualifier === document.alias.toLowerCase())
      return itemName;
    const schemaName = this._aliasToSchemaName.get(qualifier);
    if (schemaName !== undefined)
      return `${schemaName}:${itemName}`;
    const reference2 = document.getSchemaReference(reference.substring(0, separatorIndex));
    if (reference2 !== undefined)
      return `${reference2.name}:${itemName}`;
    return reference;
  }

  private parseBooleanAttribute(node: XmlElementNode, attributeName: string): boolean | undefined {
    const text = node.attributes[attributeName];
    if (text === undefined)
      return undefined;
    const lower = text.toLowerCase();
    if (lower === "true")
      return true;
    if (lower === "false")
      return false;
    this._warning("SchemaXml-0041", `The attribute ${attributeName}="${text}" is not a boolean and was ignored.`, node);
    return undefined;
  }

  private parseIntAttribute(node: XmlElementNode, attributeName: string): number | undefined {
    const text = node.attributes[attributeName];
    if (text === undefined)
      return undefined;
    const value = parseInt(text, 10);
    if (isNaN(value)) {
      this._warning("SchemaXml-0042", `The attribute ${attributeName}="${text}" is not an integer and was ignored.`, node);
      return undefined;
    }
    return value;
  }

  private parseFloatAttribute(node: XmlElementNode, attributeName: string): number | undefined {
    const text = node.attributes[attributeName];
    if (text === undefined)
      return undefined;
    const value = parseFloat(text);
    if (isNaN(value)) {
      this._warning("SchemaXml-0043", `The attribute ${attributeName}="${text}" is not a number and was ignored.`, node);
      return undefined;
    }
    return value;
  }

  private _error(code: string, message: string, node: XmlElementNode): void {
    this._issues.addError(code, message, { source: this._source, line: node.line, column: node.column });
  }

  private _warning(code: string, message: string, node: XmlElementNode): void {
    this._issues.addWarning(code, message, { source: this._source, line: node.line, column: node.column });
  }
}
