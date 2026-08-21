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
  ECClassModifier, parseClassModifier, parseCustomAttributeContainerType, parsePrimitiveType, parseStrength, parseStrengthDirection,
  PrimitiveType, SchemaItemType,
} from "../ECObjects";
import { ECName } from "../ECName";
import { serializeCustomAttributeBody } from "./CustomAttributeConverter";
import * as Authoring from "./SchemaDocument";
import {
  decodeSchemaText, mapFormatStringReferences, parseVersionString, SchemaDocumentReadResult, SchemaDocumentTextReader, SchemaHeaderReadResult, SchemaText, SchemaTextReadOptions,
} from "./SchemaDocumentIO";
import { dialectForNamespace, dialectV32, ECXmlDialect, parseLegacyCardinality, synthesizeEnumeratorName } from "./SchemaXmlDialect";
import { SchemaIssueList } from "./SchemaIssues";

/** Matches the first EC separator (`:` or `.`) in an item reference. Hoisted: a regex literal
 * allocates a new RegExp on every evaluation, and this runs per reference. */
const separatorPattern = /[.:]/;

/** Reads {@link Authoring.SchemaDocument}s from ECXML text. Accepts every published ECXML version -
 * 2.0, 3.0, 3.1 and 3.2 - detecting which from the namespace and recording it on the document
 * ({@link Authoring.SchemaDocument.originalECXmlVersionMajor}).
 *
 * Reading 2.0 performs the lossless structural upgrade only: the element vocabulary, the attribute
 * renames, and `cardinality` to `multiplicity`. The legacy custom attributes 2.0 uses in place of
 * enumerations, kinds of quantity, and property categories are read as ordinary custom attributes
 * and stay that way. Turning them into first-class items is a separate opt-in pass
 * ({@link convertEC2CustomAttributes}), because that conversion is lossy and a caller has to be
 * able to decline it.
 *
 * The reader is as lenient as the validity-free document allows: it reports problems as issues and
 * keeps whatever it could extract, leaving semantic judgment to validation. Custom attribute
 * values are kept as their raw ECXML body: understanding one needs its custom attribute class, so
 * the attribute stays unmaterialized until something reads or writes it.
 * @alpha
 */
export class SchemaXmlReader implements SchemaDocumentTextReader {
  /** Reads a full document. The result carries no document only when the input is unusable
   * (malformed XML, not an ECSchema, an unsupported spec). */
  public async readDocument(text: SchemaText, options?: SchemaTextReadOptions): Promise<SchemaDocumentReadResult> {
    const issues = new SchemaIssueList();
    const root = await parseElementTree(text, issues, options?.source, options?.abortSignal);
    if (root === undefined)
      return { issues };
    // The file declares its own version, so the reader detects rather than asking the caller - who
    // cannot know it before opening the file.
    const dialect = dialectForNamespace(root.attributes?.xmlns);
    if (dialect === undefined) {
      issues.addError("SchemaXml-0014", `The ECSchema element has a missing or unrecognized xmlns ("${root.attributes?.xmlns ?? ""}").`, { source: options?.source, line: root.line, column: root.column });
      return { issues };
    }
    const walker = new ECXmlWalker(issues, options?.source, options?.schemaSet, dialect);
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
    let dialect: ECXmlDialect = dialectV32;
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
        dialect = dialectForNamespace(attributes.xmlns) ?? dialectV32;
        alias = attributes[dialect.schemaAliasAttribute] ?? (dialect.aliasDefaultsToSchemaName ? name : undefined);
        version = parseVersionString(attributes.version) ?? (dialect.requiresVersion ? undefined : { read: 1, write: 0, minor: 0 });
        return;
      }
      if (depth === 2) {
        if (tagName === "ecschemareference") {
          const reference = readSchemaReferenceAttributes(attributes, issues, source, dialect);
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
      for await (const chunk of decodeSchemaText(text, options?.abortSignal))
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

async function parseElementTree(text: SchemaText, issues: SchemaIssueList, source: string | undefined, abortSignal: AbortSignal | undefined): Promise<XmlElementNode | undefined> {
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
    for await (const chunk of decodeSchemaText(text, abortSignal))
      parser.write(chunk);
    parser.close();
  } catch (error) {
    if (error !== stopSentinel)
      throw error;
    return undefined;
  }
  return root;
}

function readSchemaReferenceAttributes(attributes: { [name: string]: string }, issues: SchemaIssueList, source: string | undefined, dialect: ECXmlDialect): Authoring.SchemaReference | undefined {
  const name = attributes.name;
  const version = parseVersionString(attributes.version);
  if (name === undefined || version === undefined) {
    issues.addError("SchemaXml-0013", "An ECSchemaReference is missing its name or a parseable version.", { source });
    return undefined;
  }
  return { name, readVersion: version.read, writeVersion: version.write, minorVersion: version.minor, alias: attributes[dialect.referenceAliasAttribute] ?? null };
}

/** The item element names of ECXML 3.x, lowercase. */
const ITEM_ELEMENT_NAMES = new Set([
  "ecentityclass", "ecstructclass", "eccustomattributeclass", "ecrelationshipclass", "ecenumeration",
  "kindofquantity", "propertycategory", "unitsystem", "phenomenon", "unit", "invertedunit", "constant", "format",
]);

/** The one class element ECXML 2.0 has in place of the three typed ones, plus the relationship
 * element it shares with 3.x. */
const LEGACY_CLASS_ELEMENT = "ecclass";

/** Walks a parsed element tree into a Authoring.SchemaDocument. Created per read; the dialect it is
 * given carries every difference between the spec versions. */
class ECXmlWalker {
  private readonly _issues: SchemaIssueList;
  private readonly _source: string | undefined;
  private readonly _schemaSet: Authoring.SchemaSet | undefined;
  protected readonly _dialect: ECXmlDialect;
  /** Lowercased reference alias -> schema name, for normalizing alias-qualified references. */
  private readonly _aliasToSchemaName = new Map<string, string>();
  /** Lowercased names of the classes this document declares as structs. ECXML 2.0 marks a struct
   * array with `isStruct` on `ECArrayProperty`, but native ignores that flag and classifies from
   * whether the `typeName` names a struct class - so this collects the answer before any property
   * is read. Empty for 3.x, which has a dedicated element. */
  private readonly _localStructClassNames = new Set<string>();
  private _documentInProgress?: Authoring.SchemaDocument;

  public constructor(issues: SchemaIssueList, source: string | undefined, schemaSet: Authoring.SchemaSet | undefined, dialect: ECXmlDialect) {
    this._issues = issues;
    this._source = source;
    this._schemaSet = schemaSet;
    this._dialect = dialect;
  }

  /** Moves the freshly read document into the caller's schema set, or reports why it could not.
   * A name collision leaves the document in the private set it was constructed with, which is the
   * only outcome that does not silently evict someone else's schema. */
  private _joinSchemaSet(document: Authoring.SchemaDocument): void {
    const schemaSet = this._schemaSet;
    if (schemaSet === undefined)
      return;
    const incumbent = schemaSet.getSchema(document.name);
    if (incumbent !== undefined) {
      this._issues.addError("SchemaXml-0055", `The schema set already holds a schema named "${incumbent.name}"; "${document.name}" was read into a set of its own.`, { source: this._source });
      return;
    }
    schemaSet.moveIn(document);
  }

  /** The document under construction. Set at the start of {@link readSchema}; every item/property
   * reader runs within that call, so accessing it earlier is a programming error. */
  private get _document(): Authoring.SchemaDocument {
    if (this._documentInProgress === undefined)
      throw new Error("SchemaXmlReader: the document is accessed before readSchema initialized it.");
    return this._documentInProgress;
  }

  public readSchema(root: XmlElementNode): Authoring.SchemaDocument | undefined {
    if (root.name.toLowerCase() !== "ecschema") {
      this._error("SchemaXml-0011", `Expected an ECSchema root element, found "${root.name}".`, root);
      return undefined;
    }

    const specMajor = this._dialect.major;
    const specMinor = this._dialect.minor;
    const name = root.attributes.schemaName;
    let alias = root.attributes[this._dialect.schemaAliasAttribute];
    const version = this._readSchemaVersion(root);
    if (name === undefined || version === undefined) {
      this._error("SchemaXml-0012", "The ECSchema element is missing its schemaName or a parseable version.", root);
      return undefined;
    }
    if (alias === undefined) {
      // Before 3.1 the alias is optional and defaults to the schema name.
      if (this._dialect.aliasDefaultsToSchemaName)
        alias = name;
      else
        this._error("SchemaXml-0016", `The schema "${name}" is missing the required ${this._dialect.schemaAliasAttribute} attribute.`, root);
    }

    const document = new Authoring.SchemaDocument(name, alias ?? "", version.read, version.write, version.minor, {
      label: root.attributes.displayLabel,
      description: root.attributes.description,
      originalECXmlVersionMajor: specMajor,
      originalECXmlVersionMinor: specMinor,
      source: this._source,
    });
    this._documentInProgress = document;
    this._joinSchemaSet(document);
    this._aliasToSchemaName.set(document.alias.toLowerCase(), document.name);

    // References first, so item-reference normalization sees the full alias map.
    for (const child of root.children) {
      if (child.name.toLowerCase() !== "ecschemareference")
        continue;
      const reference = readSchemaReferenceAttributes(child.attributes, this._issues, this._source, this._dialect);
      if (reference !== undefined) {
        document.setSchemaReference(reference);
        if (reference.alias !== null)
          this._aliasToSchemaName.set(reference.alias.toLowerCase(), reference.name);
      }
    }

    if (this._dialect.classElements === "flagged")
      this._collectLegacyStructClassNames(root);

    for (const child of root.children) {
      const childName = child.name.toLowerCase();
      if (childName === "ecschemareference")
        continue;
      if (childName === "eccustomattributes") {
        this.readCustomAttributes(child, document.customAttributes, document.name);
        continue;
      }
      if (ITEM_ELEMENT_NAMES.has(childName) || (childName === LEGACY_CLASS_ELEMENT && this._dialect.classElements === "flagged")) {
        this.readItem(child);
        continue;
      }
      this._warning("SchemaXml-0017", `Unrecognized schema child element "${child.name}" was skipped.`, child);
    }

    return document;
  }

  private _collectLegacyStructClassNames(root: XmlElementNode): void {
    for (const child of root.children) {
      if (child.name.toLowerCase() === LEGACY_CLASS_ELEMENT && this.parseBooleanAttribute(child, "isStruct") === true && child.attributes.typeName !== undefined)
        this._localStructClassNames.add(child.attributes.typeName.toLowerCase());
    }
  }

  /** The schema's own version. Before 3.1 it is optional, and published legacy schemas do leave it
   * out or misspell it, so the spec default is used and the source text reported. */
  private _readSchemaVersion(root: XmlElementNode): { read: number, write: number, minor: number } | undefined {
    const version = parseVersionString(root.attributes.version);
    if (version !== undefined || this._dialect.requiresVersion)
      return version;
    this._warning("SchemaXml-0068", `The schema "${root.attributes.schemaName ?? ""}" has a missing or unparseable version ("${root.attributes.version ?? ""}"); it was read as 01.00.00.`, root);
    return { read: 1, write: 0, minor: 0 };
  }

  // ===== Item dispatch =====

  private readItem(node: XmlElementNode): void {
    switch (node.name.toLowerCase()) {
      case LEGACY_CLASS_ELEMENT: return this.readLegacyClass(node);
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

  /** Reads the ECXML 2.0 `ECClass` element, whose kind is carried by boolean flags rather than by
   * the element name. `isStruct` wins over `isCustomAttributeClass`, which wins over entity - the
   * precedence native applies, and the reason a class flagged both is not ambiguous. */
  private readLegacyClass(node: XmlElementNode): void {
    const isStruct = this.parseBooleanAttribute(node, "isStruct") ?? false;
    const isCustomAttribute = this.parseBooleanAttribute(node, "isCustomAttributeClass") ?? false;
    if (isStruct) {
      if (isCustomAttribute)
        this._warning("SchemaXml-0062", `The class "${node.attributes.typeName ?? ""}" is flagged both isStruct and isCustomAttributeClass; it was read as a struct class.`, node);
      return this.readStructClass(node);
    }
    if (isCustomAttribute)
      return this.readCustomAttributeClass(node);
    return this.readEntityOrMixin(node);
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
    // ECXML 2.0 has no modifier attribute: a class is abstract when it claims to be none of the
    // three kinds, sealed when isFinal says so, and plain otherwise. Native still honours an
    // explicit modifier if one is present, so it is read afterwards and wins.
    if (this._dialect.classElements === "flagged")
      init.modifier = this.legacyClassModifier(node);
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

  private legacyClassModifier(node: XmlElementNode): ECClassModifier | undefined {
    const flagCount = ["isStruct", "isCustomAttributeClass", "isDomainClass"]
      .reduce((count, flag) => count + ((this.parseBooleanAttribute(node, flag) ?? flag === "isDomainClass") ? 1 : 0), 0);
    if (flagCount === 0)
      return ECClassModifier.Abstract;
    return this.parseBooleanAttribute(node, "isFinal") === true ? ECClassModifier.Sealed : undefined;
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
    // to baseClass and the rest to mixins; validation reports a misplacement.
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
      // 2.0 has no appliesTo on a custom attribute class; native reads such a class as applying to
      // anything, which is the only interpretation that keeps its instances readable.
      if (this._dialect.classElements === "flagged")
        appliesTo = parseCustomAttributeContainerType("Any") ?? 0;
      else
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
    this.readConstraintBounds(node, constraint, className);
    constraint.roleLabel = node.attributes.roleLabel;
    if (node.attributes.polymorphic !== undefined)
      constraint.polymorphic = this.parseBooleanAttribute(node, "polymorphic") ?? constraint.polymorphic;
    if (this._dialect.abstractConstraint && node.attributes.abstractConstraint !== undefined)
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

  /** Endpoint bounds under the spelling this version uses. Before 3.1 they are a legacy
   * `cardinality="(0,N)"`, which is normalized to the `(0..*)` form the document stores; an
   * unparseable one is kept verbatim so validation can report the source text. */
  private readConstraintBounds(node: XmlElementNode, constraint: Authoring.RelationshipConstraint, className: string): void {
    const text = node.attributes[this._dialect.constraintBoundsAttribute];
    if (text === undefined)
      return;
    if (this._dialect.constraintBoundsAttribute === "multiplicity") {
      constraint.multiplicity = text;
      return;
    }
    const multiplicity = parseLegacyCardinality(text);
    if (multiplicity === undefined) {
      this._warning("SchemaXml-0063", `The constraint of "${className}" has an unparseable cardinality ("${text}"); it was kept as written.`, node);
      constraint.multiplicity = text;
      return;
    }
    constraint.multiplicity = multiplicity;
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
        // Before 3.2 a struct array is an ECArrayProperty carrying isStruct. Native ignores that
        // flag and decides from whether typeName names a struct class, because published schemas
        // get the flag wrong in both directions; the flag is the fallback when the type is not
        // resolvable here.
        if (!this._dialect.structArrayElement && this.namesStructClass(node.attributes.typeName)) {
          const typeName = this.propertyTypeName(node, name, item.name);
          if (typeName === undefined)
            return;
          property = item.createStructArray(name, typeName, { ...this.propertyInit(node), ...this.occursInit(node) });
          break;
        }
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

  /** Whether a legacy array property's `typeName` names a struct class: one this document declares,
   * one a schema in the set declares, or - when neither can answer - what the `isStruct` flag on
   * the element claimed. */
  private namesStructClass(typeName: string | undefined): boolean {
    if (typeName === undefined)
      return false;
    const normalized = this.normalizeItemReference(typeName);
    if (normalized.search(separatorPattern) < 0)
      return this._localStructClassNames.has(normalized.toLowerCase());
    return this._document.resolveItemOfType(normalized, SchemaItemType.StructClass) !== undefined;
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
  private resolvePrimitivePropertyType(node: XmlElementNode, propertyName: string, className: string): { primitiveType: PrimitiveType } | { enumeration: string } | undefined {
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
    // 2.0 spelled the range attributes with a leading capital.
    const camelCase = this._dialect.rangeAttributes === "camelCase";
    return {
      ...this.propertyInit(node),
      extendedTypeName: node.attributes.extendedTypeName,
      minValue: this.parseFloatAttribute(node, camelCase ? "minimumValue" : "MinimumValue"),
      maxValue: this.parseFloatAttribute(node, camelCase ? "maximumValue" : "MaximumValue"),
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
      isStrict: this.parseBooleanAttribute(node, this._dialect.enumerationStrictAttribute),
    });
    for (const child of node.children) {
      if (child.name.toLowerCase() !== "ecenumerator")
        continue;
      const valueText = child.attributes.value;
      if (valueText === undefined) {
        this._error("SchemaXml-0032", `An enumerator of "${name}" is missing its value; it was skipped.`, child);
        continue;
      }
      let value: number | string = valueText;
      if (backingType === "int") {
        value = parseInt(valueText, 10);
        if (isNaN(value)) {
          this._error("SchemaXml-0033", `The enumerator "${name}.${valueText}" has a non-integer value on an int enumeration; it was skipped.`, child);
          continue;
        }
      }
      // Before 3.2 an enumerator carries no name; native synthesizes one and so must this, or the
      // same enumeration read from two spec versions would not compare equal.
      let enumeratorName = child.attributes.name;
      if (enumeratorName === undefined) {
        if (this._dialect.enumeratorNames) {
          this._error("SchemaXml-0032", `An enumerator of "${name}" is missing its name; it was skipped.`, child);
          continue;
        }
        enumeratorName = ECName.encode(synthesizeEnumeratorName(name, value)).name;
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
    // Presentation format strings stay verbatim; the override grammar is not parsed here.
    const presentationFormats = node.attributes.presentationUnits !== undefined
      ? node.attributes.presentationUnits.split(";").map((entry) => entry.trim()).filter((entry) => entry.length > 0)
        .map((entry) => mapFormatStringReferences(entry, (reference) => this.normalizeItemReference(reference)))
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

  /** Reads an `<ECCustomAttributes>` container into a set. The custom attribute class is identified
   * by the entry element's name plus its `xmlns` (`Schema.RR.WW.mm` - the version is a serialization
   * artifact and is dropped). The value is kept as the raw ECXML body, exactly as written: the body
   * cannot be understood without the custom attribute class, so the attribute stays unmaterialized
   * until something reads or writes it (see {@link Authoring.CustomAttribute}). */
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
      Authoring.CustomAttribute.fromXmlBody(target.container, className, serializeCustomAttributeBody(caNode.children));
    }
  }

  // ===== Shared helpers =====

  /** Returns the first child element with the given lowercase name, or `undefined`. */
  private findChild(node: XmlElementNode, lowerCaseName: string): XmlElementNode | undefined {
    return node.children.find((child) => child.name.toLowerCase() === lowerCaseName);
  }

  /** Normalizes an item reference read from XML: the alias-qualified form becomes the full-name
   * form (`bis:PhysicalElement` -> `BisCore:PhysicalElement`), a reference into this schema becomes
   * a bare local name. Unknown qualifiers are left as written for validation to diagnose. */
  private normalizeItemReference(reference: string): Authoring.LocalOrFullName {
    const separatorIndex = reference.search(separatorPattern);
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
