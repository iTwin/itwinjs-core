/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import * as sax from "sax";
import { parsePrimitiveType, PrimitiveType, SchemaItemType } from "../ECObjects";
import type {
  AnyProperty, CustomAttribute, CustomAttributeClass, CustomAttributeValue, CustomAttributeValues, ECClass, SchemaDocument, XmlString,
} from "./SchemaDocument";
import { SchemaIssueList } from "./SchemaIssues";
import { getStandardSchemas } from "./StandardSchemas";
import { SchemaAuthoringError } from "./SchemaAuthoringError";

/** Matches the first EC separator (`:` or `.`) in an item reference. Hoisted: a regex literal
 * allocates a new RegExp on every evaluation, and this runs per reference. */
const separatorPattern = /[.:]/;

/**
 * Conversion of custom attribute values between the raw ECXML body a document reads them from and
 * the typed {@link CustomAttributeValues} it holds them as, plus the way back out to ECXML.
 *
 * Every conversion runs **against the custom attribute class**, which is what makes it exact: the
 * class says a value is a boolean rather than the text `"True"`, and that a nested element is a
 * one-entry struct array rather than a struct - two things neither serialization format can tell
 * you on its own. Resolution goes through the owning document's schema set first, then the
 * built-in definitions of the standard custom attribute classes ({@link getStandardSchemas}), so
 * the common ones need nothing loaded.
 *
 * A property the class does not declare is still converted, by shape alone, so an attribute whose
 * class has drifted still round-trips its extra values instead of losing them. Validation is where
 * that mismatch gets reported.
 */

/** A minimal XML element node - the shape both the XML reader's parsed tree and this module's own
 * fragment parser expose. Attributes are irrelevant inside a custom attribute body (the only
 * attribute, `xmlns`, lives on the custom attribute element itself), so they are not modeled here.
 * @alpha
 */
export interface CustomAttributeXmlNode {
  readonly name: string;
  readonly text: string;
  readonly children: ReadonlyArray<CustomAttributeXmlNode>;
}

/** Serializes a custom attribute element's child nodes (its property value elements) into the raw
 * {@link XmlString} body an unmaterialized custom attribute holds. Returns `undefined` when there
 * are no children. The XML reader calls this on the nodes it parsed; the formatting matches what
 * this module produces when writing, so an XML-sourced and an in-memory custom attribute of
 * identical content serialize to identical bytes.
 * @alpha
 */
export function serializeCustomAttributeBody(children: ReadonlyArray<CustomAttributeXmlNode>): XmlString | undefined {
  return serializeCustomAttributeBodyLines(children)?.join("\n");
}

/** The same body as {@link serializeCustomAttributeBody}, kept as one entry per XML line rather than
 * joined. A property value may itself contain newlines - an ECSQL string in `ECDbMap:QueryView`
 * does - and those are part of the value, not line breaks in the markup. A writer that re-splits
 * the joined form on newlines cannot tell the two apart and indents into the value, corrupting it a
 * little more on every write. Handing the lines over keeps that distinction.
 * @internal
 */
export function serializeCustomAttributeBodyLines(children: ReadonlyArray<CustomAttributeXmlNode>): string[] | undefined {
  if (children.length === 0)
    return undefined;
  return serializeNodes(children, 0);
}

/** Converts a custom attribute's unconverted ECXML body into its typed values, against its custom
 * attribute class. Called by {@link CustomAttribute.values} and {@link CustomAttribute.tryGetValues}.
 * Throws when `throwOnMissingClass` is set and the class cannot be resolved, and returns
 * `undefined` otherwise - the two behaviours those two accessors promise.
 * @internal
 */
export function materializeCustomAttribute(customAttribute: CustomAttribute, throwOnMissingClass: true): CustomAttributeValues;
export function materializeCustomAttribute(customAttribute: CustomAttribute, throwOnMissingClass: boolean): CustomAttributeValues | undefined;
export function materializeCustomAttribute(customAttribute: CustomAttribute, throwOnMissingClass: boolean): CustomAttributeValues | undefined {
  const body = customAttribute.rawXml;
  if (body === undefined || body.trim().length === 0)
    return {};
  const caClass = resolveCustomAttributeClass(customAttribute.document, customAttribute.className);
  if (caClass === undefined) {
    if (throwOnMissingClass)
      SchemaAuthoringError.throwError("custom-attribute-class-not-found",
        `Cannot read the custom attribute "${customAttribute.className}" on "${containerName(customAttribute)}": its custom attribute class is not in the schema set. Put the schema that defines it in the set, then read it again.`,
        { itemName: customAttribute.className, location: containerName(customAttribute) });
    return undefined;
  }
  const nodes = parseCustomAttributeBody(body);
  if (nodes === undefined) {
    if (throwOnMissingClass)
      SchemaAuthoringError.throwError("malformed-custom-attribute-xml",
        `The custom attribute "${customAttribute.className}" on "${containerName(customAttribute)}" holds an ECXML body that is not well-formed.`,
        { itemName: customAttribute.className, location: containerName(customAttribute) });
    return undefined;
  }
  return nodesToValues(nodes, caClass);
}

/** The typed values of a custom attribute for a writer: materializes if needed, and on failure
 * reports an issue and returns `undefined` instead of throwing. Writers report and carry on.
 * @internal
 */
export function readCustomAttributeValues(customAttribute: CustomAttribute, issues: SchemaIssueList, location: string): CustomAttributeValues | undefined {
  const values = customAttribute.tryGetValues();
  if (values === undefined) {
    issues.addError("custom-attribute-class-unresolved",
      `The custom attribute "${customAttribute.className}" could not be converted because its custom attribute class is not in the schema set; it was skipped.`,
      location);
  }
  return values;
}

/** Serializes a custom attribute into an ECXML body for a writer.
 *
 * An attribute that is still unmaterialized and whose class cannot be resolved is passed through
 * verbatim, with a warning - the output stays valid and keeps the data, which beats dropping it.
 * Returns `undefined` when the attribute cannot be written at all (its values need the class to
 * name a struct array's entry elements), in which case an error has been reported and the caller
 * drops it.
 * @internal
 */
export function writeCustomAttributeXmlBody(customAttribute: CustomAttribute, issues: SchemaIssueList, location: string): string[] | undefined {
  const values = customAttribute.tryGetValues();
  if (values === undefined) {
    issues.addWarning("custom-attribute-body-passed-through",
      `The custom attribute "${customAttribute.className}" was copied verbatim: its custom attribute class is not in the schema set, so its values could not be validated.`,
      location);
    // One entry, newlines and all: a verbatim body is already indented for the file it came from,
    // and re-indenting it would change any value that spans lines.
    const raw = customAttribute.rawXml;
    return raw === undefined || raw.length === 0 ? [] : [raw];
  }
  const caClass = resolveCustomAttributeClass(customAttribute.document, customAttribute.className);
  const nodes = valuesToNodes(values, caClass, customAttribute.className, issues, location);
  if (nodes === undefined)
    return undefined;
  return serializeNodes(nodes, 0);
}

/** Resolves a custom attribute class name against a document: its own schema set first, then the
 * built-in standard schemas. Returns `undefined` when neither holds a custom attribute class of
 * that name.
 * @internal
 */
export function resolveCustomAttributeClass(document: SchemaDocument, className: string): CustomAttributeClass | undefined {
  const own = document.resolveItemOfType(className, SchemaItemType.CustomAttributeClass);
  if (own !== undefined)
    return own;
  const schemaName = document.resolveSchemaName(className);
  const localName = className.substring(className.search(separatorPattern) + 1);
  return getStandardSchemas().getSchema(schemaName)?.getItemOfType(localName, SchemaItemType.CustomAttributeClass);
}

// ===== values <- XML nodes =====

function nodesToValues(nodes: ReadonlyArray<CustomAttributeXmlNode>, ownerClass: ECClass | undefined): CustomAttributeValues {
  const values: CustomAttributeValues = {};
  for (const node of nodes)
    values[node.name] = nodeToValue(node, ownerClass?.getExpandedProperty(node.name));
  return values;
}

function nodeToValue(node: CustomAttributeXmlNode, property: AnyProperty | undefined): CustomAttributeValue {
  if (property !== undefined && property.isStruct()) {
    const structClass = property.getStructClass();
    if (property.isArray())
      return node.children.map((entry) => nodesToValues(entry.children, structClass));
    return nodesToValues(node.children, structClass);
  }

  if (property !== undefined && property.isPrimitive()) {
    const elementType = primitiveTypeOf(property);
    if (property.isArray())
      return node.children.map((entry) => parseScalar(entry.text, elementType));
    return parseScalar(node.text, elementType);
  }

  // No declared property to go on - the class has drifted, or this is a navigation property, which
  // a custom attribute cannot carry. Read by shape so the value survives to be reported.
  if (node.children.length === 0)
    return node.text;
  return nodesToValues(node.children, undefined);
}

/** The primitive type of a primitive property's value (its element type, on an array), or
 * `undefined` when it is enumeration-backed with an unresolvable enumeration. */
function primitiveTypeOf(property: AnyProperty & { typeName: string }): PrimitiveType | undefined {
  const keyword = parsePrimitiveType(property.typeName);
  if (keyword !== undefined)
    return keyword;
  const enumeration = property.document.resolveItemOfType(property.typeName, SchemaItemType.Enumeration);
  if (enumeration === undefined)
    return undefined;
  return enumeration.backingType === "int" ? PrimitiveType.Integer : PrimitiveType.String;
}

/** Converts XML text to a typed value per the declared primitive type. An unparseable number and
 * an unrecognized boolean keep their text: the document tolerates invalid data and validation is
 * where it gets reported.
 *
 * A string keeps its surrounding whitespace, which is part of the value - published schemas do
 * carry an enumerator display string like `" Light Paving"`. The types that cannot hold whitespace
 * are trimmed before parsing, so a value written across lines still reads. */
function parseScalar(text: string, type: PrimitiveType | undefined): string | number | boolean {
  switch (type) {
    case PrimitiveType.Boolean: {
      const lower = text.trim().toLowerCase();
      if (lower === "true" || lower === "1")
        return true;
      if (lower === "false" || lower === "0")
        return false;
      return text;
    }
    case PrimitiveType.Integer:
    case PrimitiveType.Long: {
      const value = Number.parseInt(text.trim(), 10);
      return Number.isNaN(value) ? text : value;
    }
    case PrimitiveType.Double: {
      const value = Number.parseFloat(text.trim());
      return Number.isNaN(value) ? text : value;
    }
    default:
      // String, DateTime, Binary, Point2d, Point3d, IGeometry and anything unresolved: the wire form
      // is the value.
      return text;
  }
}

// ===== values -> XML nodes =====

function valuesToNodes(values: CustomAttributeValues, ownerClass: ECClass | undefined, className: string, issues: SchemaIssueList, location: string): CustomAttributeXmlNode[] | undefined {
  const nodes: CustomAttributeXmlNode[] = [];
  for (const [name, value] of Object.entries(values)) {
    const node = valueToNode(name, value, ownerClass?.getExpandedProperty(name), className, issues, location);
    if (node === undefined)
      return undefined;
    nodes.push(node);
  }
  return nodes;
}

function valueToNode(name: string, value: CustomAttributeValue, property: AnyProperty | undefined, className: string, issues: SchemaIssueList, location: string): CustomAttributeXmlNode | undefined {
  if (Array.isArray(value)) {
    if (value.length === 0)
      return { name, text: "", children: [] };

    if (isValuesObject(value[0])) {
      // A struct array's entries are elements named for their struct class, which the values do not
      // carry - only the property does.
      const structClass = property !== undefined && property.isStruct() && property.isArray() ? property.getStructClass() : undefined;
      if (structClass === undefined) {
        issues.addError("custom-attribute-struct-array-entry-class-unresolved",
          `The custom attribute "${className}" has a struct-array property "${name}" whose entry struct class cannot be determined without the custom attribute class; put the schema that defines it in the schema set. The custom attribute was skipped.`,
          location);
        return undefined;
      }
      const children: CustomAttributeXmlNode[] = [];
      for (const entry of value) {
        if (!isValuesObject(entry)) {
          issues.addError("custom-attribute-struct-array-entry-not-convertible",
            `The custom attribute "${className}" has a struct-array property "${name}" holding a non-struct entry. The custom attribute was skipped.`,
            location);
          return undefined;
        }
        const memberNodes = valuesToNodes(entry, structClass, className, issues, location);
        if (memberNodes === undefined)
          return undefined;
        children.push({ name: structClass.name, text: "", children: memberNodes });
      }
      return { name, text: "", children };
    }

    // A primitive array's entry elements are named for the element's primitive type.
    const entryName = primitiveKeywordOf(property) ?? primitiveKeywordOfValue(value[0]);
    return { name, text: "", children: value.map((entry) => ({ name: entryName, text: scalarToXmlText(entry), children: [] })) };
  }

  if (isValuesObject(value)) {
    const structClass = property !== undefined && property.isStruct() && !property.isArray() ? property.getStructClass() : undefined;
    const memberNodes = valuesToNodes(value, structClass, className, issues, location);
    if (memberNodes === undefined)
      return undefined;
    return { name, text: "", children: memberNodes };
  }

  return { name, text: scalarToXmlText(value), children: [] };
}

/** The EC primitive keyword an array property's entry elements carry, from the declared type. */
function primitiveKeywordOf(property: AnyProperty | undefined): string | undefined {
  if (property === undefined || !property.isPrimitive() || !property.isArray())
    return undefined;
  const type = primitiveTypeOf(property);
  return type === undefined ? undefined : primitiveKeyword(type);
}

function primitiveKeyword(type: PrimitiveType): string {
  switch (type) {
    case PrimitiveType.Boolean: return "boolean";
    case PrimitiveType.Integer: return "int";
    case PrimitiveType.Long: return "long";
    case PrimitiveType.Double: return "double";
    case PrimitiveType.DateTime: return "dateTime";
    case PrimitiveType.Binary: return "binary";
    case PrimitiveType.Point2d: return "point2d";
    case PrimitiveType.Point3d: return "point3d";
    case PrimitiveType.IGeometry: return "Bentley.Geometry.Common.IGeometry";
    default: return "string";
  }
}

/** Fallback entry element name when the property is not declared: the JS type is all there is. */
function primitiveKeywordOfValue(value: CustomAttributeValue): string {
  if (typeof value === "boolean")
    return "boolean";
  if (typeof value === "number")
    return Number.isInteger(value) ? "int" : "double";
  return "string";
}

/** Serializes a scalar to its EC-canonical XML text: `True`/`False` for booleans (capitalized, not
 * `String(value)`'s lowercase), the plain string form otherwise. A struct or array reaching here
 * means the values disagree with the class about the property's shape; it is written as JSON so the
 * data survives to be reported rather than becoming "[object Object]". */
function scalarToXmlText(value: CustomAttributeValue): string {
  if (typeof value === "boolean")
    return value ? "True" : "False";
  if (typeof value === "object")
    return JSON.stringify(value);
  return String(value);
}

// ===== Shared: node serialization, fragment parsing =====

/** Whether the value is a struct (a plain object), as opposed to a scalar or array. */
function isValuesObject(value: CustomAttributeValue): value is CustomAttributeValues {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containerName(customAttribute: CustomAttribute): string {
  const container = customAttribute.container;
  return "fullName" in container ? container.fullName : customAttribute.document.name;
}

/** Serializes nodes to indented XML lines at the given base indent. A node with children is emitted as
 * an open/close pair wrapping its (further-indented) children; a leaf becomes a single
 * `<name>text</name>` line. Indentation is four spaces per level, matching the schema writers. */
function serializeNodes(nodes: ReadonlyArray<CustomAttributeXmlNode>, indent: number): string[] {
  const pad = "    ".repeat(indent);
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      lines.push(`${pad}<${node.name}>`);
      lines.push(...serializeNodes(node.children, indent + 1));
      lines.push(`${pad}</${node.name}>`);
    } else {
      // The text is emitted as it is: whitespace inside a value belongs to the value, and the only
      // whitespace this serializer adds is the indent in front of the element.
      lines.push(`${pad}<${node.name}>${escapeText(node.text)}</${node.name}>`);
    }
  }
  return lines;
}

const textEscapes: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const textEscapePattern = /[&<>]/g;

/** Escapes element text - mirrors the schema writers so custom attribute bodies escape identically. */
function escapeText(value: string): string {
  return value.replace(textEscapePattern, (char) => textEscapes[char]);
}

/** Parses a raw body (a sequence of sibling value elements) into nodes. Synchronous - custom
 * attribute bodies are tiny. Returns `undefined` on malformed XML. */
function parseCustomAttributeBody(body: XmlString): CustomAttributeXmlNode[] | undefined {
  interface MutableNode { name: string, text: string, children: MutableNode[] }
  const root: MutableNode = { name: "", text: "", children: [] };
  const stack: MutableNode[] = [root];
  const parser = sax.parser(true, {});
  let failed = false;
  parser.onerror = () => { failed = true; };
  parser.onopentag = (tag: sax.Tag | sax.QualifiedTag) => {
    const node: MutableNode = { name: tag.name, text: "", children: [] };
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  };
  parser.onclosetag = () => { stack.pop(); };
  const appendText = (value: string) => { stack[stack.length - 1].text += value; };
  parser.ontext = appendText;
  parser.oncdata = appendText;
  try {
    // Wrap the sibling elements in a synthetic root so the fragment is a single well-formed document.
    parser.write(`<_>${body}</_>`).close();
  } catch {
    return undefined;
  }
  if (failed || root.children.length !== 1)
    return undefined;
  return root.children[0].children;
}
