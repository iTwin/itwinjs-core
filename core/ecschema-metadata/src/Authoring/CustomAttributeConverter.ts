/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import * as sax from "sax";
import { parsePrimitiveType } from "../ECObjects";
import { SchemaView } from "../SchemaView";
import { Authoring } from "./SchemaDocument";
import { SchemaIssueList } from "./SchemaIssues";

/** A custom attribute's value in canonical ECJSON form: a property-name -> value object. Values are
 * untyped (`unknown`) because the document has no CA class to type them against. */
interface JsonObject { [name: string]: unknown }

/**
 * Conversion between the two raw, format-native shapes a custom-attribute value takes inside a
 * {@link Authoring.CustomAttribute}: the canonical ECJSON property object and the raw ECXML body
 * string. Every wrinkle of the XML<->JSON custom-attribute representation gap is confined to this
 * module.
 *
 * A {@link SchemaDocument} deliberately has no resolved CA class definitions, so its readers store CA
 * values in whichever shape the source produced - the XML reader an {@link Authoring.XmlString}, the
 * JSON reader and in-memory construction a JSON object. Writing to the *same* format is then a
 * passthrough; only crossing the format boundary calls into here.
 *
 * The boundary cannot be crossed losslessly without the CA class, because ECXML carries information
 * ECJSON drops (the struct class on a struct-array entry, spelled as the entry element name) and
 * ECJSON carries types ECXML drops (a value is just text in XML). What this module recovers without
 * the class, and where it needs one:
 *  - Scalars: text <-> typed value, recovered heuristically with a reversibility guard (see
 *    {@link promoteScalar}). No class needed.
 *  - Primitive arrays: repeated primitive-keyword entry elements <-> a JS array of values. No class.
 *  - Structs: nested element <-> object. No class.
 *  - Multi-entry struct arrays, XML -> JSON: the >=2 repeated entry elements are unambiguously an
 *    array, so the entry element name is dropped and a canonical array is produced. No class needed.
 *  - Single-entry struct arrays, XML -> JSON: one nested element is lexically identical to a struct,
 *    so without a {@link SchemaView} it is read as a struct (best effort, the common case). A view
 *    resolves it to a one-element array.
 *  - Struct arrays, JSON -> XML: the entry element name (struct class) is absent from canonical JSON
 *    and cannot be invented. Without a {@link SchemaView} that resolves the CA class, the whole CA is
 *    dropped and an error is reported - the caller must check the issue list. A view supplies the name.
 */

/** Context threaded through a conversion: the optional resolver, the issue sink, and provenance. */
export interface CustomAttributeConversionContext {
  /** Resolves CA classes so struct-array shapes can be converted faithfully. When absent, conversions
   * fall back to best effort and report an error where the class is genuinely required (struct arrays,
   * JSON -> XML). */
  schemaView?: SchemaView;
  /** The name of the schema that owns the custom attribute, used to qualify a bare own-schema class
   * name before looking it up in {@link schemaView}. */
  ownerSchemaName: string;
  /** Where conversion problems are reported. */
  issues: SchemaIssueList;
  /** Path of the element carrying the custom attribute, copied onto reported issues. */
  location: string;
}

/** A minimal XML element node - the shape both the XML reader's parsed tree and this module's own
 * fragment parser expose. Attributes are irrelevant inside a CA body (the only attribute, `xmlns`,
 * lives on the CA element itself), so they are not modeled here. */
export interface CustomAttributeXmlNode {
  readonly name: string;
  readonly text: string;
  readonly children: ReadonlyArray<CustomAttributeXmlNode>;
}

/** Serializes a custom attribute element's child nodes (its property value elements) into the raw
 * {@link Authoring.XmlString} body the document stores for an XML-sourced CA. Returns `undefined` when
 * there are no children (an empty CA carries no body). The XML reader calls this on the nodes it
 * parsed; the formatting matches what {@link customAttributeJsonToXml} produces, so an XML-sourced and
 * a JSON-sourced CA of identical content serialize to identical bytes. */
export function serializeCustomAttributeBody(children: ReadonlyArray<CustomAttributeXmlNode>): Authoring.XmlString | undefined {
  if (children.length === 0)
    return undefined;
  return serializeNodes(children, 0).join("\n");
}

/** Converts a raw ECXML CA body into the canonical ECJSON property object. Used by the JSON writer
 * when it meets an XML-sourced CA. Never throws; an unparseable body reports an error and yields
 * `undefined` (the caller drops the CA). See the module comment for what needs a {@link SchemaView}. */
export function customAttributeXmlToJson(body: Authoring.XmlString, className: string, context: CustomAttributeConversionContext): JsonObject | undefined {
  const nodes = parseCustomAttributeBody(body);
  if (nodes === undefined) {
    context.issues.addError("SchemaCA-0003", `The custom attribute "${className}" has an XML value that could not be parsed; it was skipped.`, { location: context.location });
    return undefined;
  }
  const caClass = resolveClass(className, context);
  return nodesToBag(nodes, caClass, context);
}

/** Converts a canonical ECJSON property object into the raw ECXML CA body. Used by the XML writer when
 * it meets a JSON-sourced (or in-memory) CA. Returns `undefined` when the value cannot be expressed in
 * XML without the CA class - a struct array with no {@link SchemaView} to name its entry elements - in
 * which case an error is reported and the caller drops the whole CA. An empty object yields `""`. */
export function customAttributeJsonToXml(json: JsonObject, className: string, context: CustomAttributeConversionContext): Authoring.XmlString | undefined {
  const caClass = resolveClass(className, context);
  const nodes = bagToNodes(json, className, caClass, context);
  if (nodes === undefined)
    return undefined;
  return serializeNodes(nodes, 0).join("\n");
}

// ===== XML <- JSON (json object -> nodes) =====

/** Builds the value-element nodes for a JSON property object, or `undefined` if any value needs the CA
 * class but it is unavailable (the whole CA is then dropped by the caller). `ownerClass` is the CA or
 * struct class whose properties name `bag`'s entries, when resolved. */
function bagToNodes(bag: JsonObject, className: string, ownerClass: SchemaView.Class | undefined, context: CustomAttributeConversionContext): CustomAttributeXmlNode[] | undefined {
  const nodes: CustomAttributeXmlNode[] = [];
  for (const [name, value] of Object.entries(bag)) {
    const node = valueToNode(name, value, ownerClass?.getProperty(name), className, context);
    if (node === undefined)
      return undefined;
    nodes.push(node);
  }
  return nodes;
}

function valueToNode(name: string, value: unknown, property: SchemaView.Property | undefined, className: string, context: CustomAttributeConversionContext): CustomAttributeXmlNode | undefined {
  if (Array.isArray(value)) {
    if (value.length === 0)
      return { name, text: "", children: [] };
    if (isObjectValue(value[0])) {
      // Struct array: each entry is an element named for the struct class, which canonical JSON does
      // not carry. Only a resolved struct-array property supplies it; otherwise the CA cannot be
      // written and is dropped.
      const structClass = property !== undefined && property.isStruct() && property.isArray() ? property.structClass : undefined;
      if (structClass === undefined) {
        context.issues.addError("SchemaCA-0001",
          `The custom attribute "${className}" has a struct-array property "${name}" whose entry struct class cannot be determined without the custom attribute class; provide a SchemaView to write it. The custom attribute was skipped.`,
          { location: context.location });
        return undefined;
      }
      const children: CustomAttributeXmlNode[] = [];
      for (const entry of value) {
        const memberNodes = bagToNodes(entry as JsonObject, className, structClass, context);
        if (memberNodes === undefined)
          return undefined;
        children.push({ name: structClass.name, text: "", children: memberNodes });
      }
      return { name, text: "", children };
    }
    // Primitive array: the entry element name carries the type (string/int/double/boolean).
    return { name, text: "", children: value.map((entry) => primitiveEntryNode(entry)) };
  }

  if (isObjectValue(value)) {
    const structClass = property !== undefined && property.isStruct() && !property.isArray() ? property.structClass : undefined;
    const memberNodes = bagToNodes(value, className, structClass, context);
    if (memberNodes === undefined)
      return undefined;
    return { name, text: "", children: memberNodes };
  }

  return { name, text: scalarToXmlText(value), children: [] };
}

/** A primitive array entry: a leaf element whose name is the EC primitive keyword for the JS type. */
function primitiveEntryNode(value: unknown): CustomAttributeXmlNode {
  if (typeof value === "boolean")
    return { name: "boolean", text: value ? "True" : "False", children: [] };
  if (typeof value === "number")
    return { name: Number.isInteger(value) ? "int" : "double", text: String(value), children: [] };
  return { name: "string", text: typeof value === "string" ? value : String(value), children: [] };
}

/** Serializes a scalar to its EC-canonical XML text: `True`/`False` for booleans (capitalized, not
 * `String(value)`'s lowercase), the plain string form otherwise. */
function scalarToXmlText(value: unknown): string {
  if (typeof value === "boolean")
    return value ? "True" : "False";
  return String(value);
}

// ===== JSON <- XML (nodes -> json object) =====

function nodesToBag(nodes: ReadonlyArray<CustomAttributeXmlNode>, ownerClass: SchemaView.Class | undefined, context: CustomAttributeConversionContext): JsonObject {
  const bag: JsonObject = {};
  for (const node of nodes)
    bag[node.name] = nodeToValue(node, ownerClass?.getProperty(node.name), context);
  return bag;
}

function nodeToValue(node: CustomAttributeXmlNode, property: SchemaView.Property | undefined, context: CustomAttributeConversionContext): unknown {
  if (node.children.length === 0)
    return promoteScalar(node.text.trim());

  const firstName = node.children[0].name;
  const allSameName = node.children.every((child) => child.name === firstName);

  // Repeated primitive-keyword children are a primitive array; entries stay strings (the keyword
  // carries the type, but typing array entries is left to the compiler, as before).
  if (allSameName && parsePrimitiveType(firstName) !== undefined)
    return node.children.map((child) => child.text.trim());

  // With the resolved property, the struct-vs-struct-array question is answered directly.
  if (property !== undefined && property.isStruct()) {
    if (property.isArray())
      return node.children.map((entry) => nodesToBag(entry.children, property.structClass, context));
    return nodesToBag(node.children, property.structClass, context);
  }

  // Without the class: two or more same-named children are unambiguously a struct array, so the entry
  // element name is dropped and a canonical array is produced. A single nested element (or a mix) is
  // read as a struct - lexically identical to a one-entry struct array, which a SchemaView would
  // disambiguate; this is the documented residual gap.
  if (allSameName && node.children.length >= 2)
    return node.children.map((entry) => nodesToBag(entry.children, undefined, context));
  return nodesToBag(node.children, undefined, context);
}

/** Promotes a class-blind scalar text value to a typed value when, and only when, the typed value
 * re-serializes to the byte-identical text - so promotion can never change a round-trip through XML.
 * Boolean: exact EC-canonical `True`/`False`. Number: `String(Number(x)) === x`, which rejects
 * `"007"`, `"1.0"`, `"1e3"`, `"NaN"`, `"Infinity"`, and anything with stray whitespace. Everything
 * else stays a string. */
export function promoteScalar(text: string): string | boolean | number {
  if (text === "True")
    return true;
  if (text === "False")
    return false;
  if (text.length > 0) {
    const value = Number(text);
    if (Number.isFinite(value) && String(value) === text)
      return value;
  }
  return text;
}

// ===== Shared: class resolution, node serialization, fragment parsing =====

/** Resolves the CA (or struct) class through the optional {@link SchemaView}, qualifying a bare
 * own-schema name first. Returns `undefined` when no view is supplied or the class is not found - the
 * conversion then proceeds class-blind. */
function resolveClass(className: string, context: CustomAttributeConversionContext): SchemaView.Class | undefined {
  if (context.schemaView === undefined)
    return undefined;
  const qualified = /[.:]/.test(className) ? className : `${context.ownerSchemaName}:${className}`;
  return context.schemaView.findClass(qualified);
}

/** Whether the JS value is a struct (a plain object), as opposed to a scalar or array. */
function isObjectValue(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      lines.push(`${pad}<${node.name}>${escapeText(node.text.trim())}</${node.name}>`);
    }
  }
  return lines;
}

/** Escapes element text - mirrors the schema writers so CA bodies escape identically. */
function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Parses a raw CA body (a sequence of sibling value elements) into nodes. Synchronous - CA bodies are
 * tiny. Returns `undefined` on malformed XML. */
function parseCustomAttributeBody(body: Authoring.XmlString): CustomAttributeXmlNode[] | undefined {
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
