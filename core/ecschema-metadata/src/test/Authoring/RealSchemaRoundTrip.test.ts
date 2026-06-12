/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { readFile } from "fs/promises";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { compareSchemaDocuments, formatSchemaComparison } from "../../Authoring/SchemaComparison";
import { SchemaDocument } from "../../Authoring/SchemaDocument";
import { SchemaJsonReader } from "../../Authoring/SchemaJsonReader";
import { SchemaJsonWriter } from "../../Authoring/SchemaJsonWriter";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";

// Round-trips real, released schemas from the @bentley schema npm packages. Each package ships
// the same schema as ECXML and ECJSON, both produced by the established (non-Authoring) pipeline -
// an oracle that is independent of the code under test. Three layers of assertion:
//  1. Stability: write -> read -> write is byte-identical per format.
//  2. Cross-format agreement: the XML-read and JSON-read documents compare equal.
//  3. Fidelity against the oracle: our re-emitted output matches the published file semantically
//     (modulo comments/formatting). This is the check the others cannot make - if the Authoring
//     layer dropped or mangled a field consistently, 1 and 2 would still pass, but the published
//     file would disagree.

// A small representative set: BisCore (the central domain schema - classes, relationships,
// mixins, CAs), Units and Formats (the units/formats item family at scale), and
// CoreCustomAttributes (CA definitions). The exhaustive walk across all of bis-schemas is a
// standalone script's job, not this suite's.
const SCHEMA_PACKAGES: Array<{ packageName: string, schemaName: string }> = [
  { packageName: "bis-core-schema", schemaName: "BisCore" },
  { packageName: "core-custom-attributes-schema", schemaName: "CoreCustomAttributes" },
  { packageName: "formats-schema", schemaName: "Formats" },
  { packageName: "units-schema", schemaName: "Units" },
];

function assetPath(packageName: string, fileName: string): string {
  return join(process.cwd(), "node_modules", "@bentley", packageName, fileName);
}

async function readDocumentFromXml(xml: string, source: string): Promise<SchemaDocument> {
  const result = await new SchemaXmlReader().readDocument(xml, { source });
  expect(result.issues.hasErrors, JSON.stringify(result.issues.errors)).to.be.false;
  return result.document!;
}

async function readDocumentFromJson(json: string, source: string): Promise<SchemaDocument> {
  const result = await new SchemaJsonReader().readDocument(json, { source });
  expect(result.issues.hasErrors, JSON.stringify(result.issues.errors)).to.be.false;
  return result.document!;
}

// ===== Scalar comparison shared by both oracles =====

/** Lenient scalar equality: exact, case-insensitive (boolean/enum casing), delimiter-whitespace
 * insensitive (`"A, B"` vs `"A,B"`), or numeric ("0.00001" vs "1e-5"). */
function scalarsMatch(left: string, right: string): boolean {
  if (left === right)
    return true;
  const normalize = (value: string): string => value.toLowerCase().replace(/,\s+/g, ",");
  if (normalize(left) === normalize(right))
    return true;
  if (left.trim() === "" || right.trim() === "")
    return false;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return !isNaN(leftNumber) && !isNaN(rightNumber) && leftNumber === rightNumber;
}

// ===== JSON oracle: deep diff of parsed trees =====

function diffJson(path: string, left: unknown, right: unknown, out: string[]): void {
  if (left === undefined && right === undefined)
    return;
  // maxOccurs: ECJSON spells unbounded as INT32_MAX; our writer omits the field. Same meaning.
  if (path.endsWith(".maxOccurs") && (left === 2147483647 || left === undefined) && (right === 2147483647 || right === undefined))
    return;
  if (left === undefined || right === undefined) {
    out.push(`${path}: ${JSON.stringify(left)} vs ${JSON.stringify(right)}`);
    return;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; ++i)
      diffJson(`${path}[${i}]`, left[i], right[i], out);
    return;
  }
  if (typeof left === "object" && left !== null && typeof right === "object" && right !== null && !Array.isArray(left) && !Array.isArray(right)) {
    const leftObject = left as Record<string, unknown>;
    const rightObject = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftObject), ...Object.keys(rightObject)]);
    for (const key of keys)
      diffJson(`${path}.${key}`, leftObject[key], rightObject[key], out);
    return;
  }
  // Only scalars reach this point (arrays and objects are handled above).
  if (!scalarsMatch(String(left), String(right))) // eslint-disable-line @typescript-eslint/no-base-to-string
    out.push(`${path}: ${JSON.stringify(left)} vs ${JSON.stringify(right)}`);
}

// ===== XML oracle: canonical element trees from a generic parser (xmldom, not our reader) =====

interface CanonicalXmlElement {
  name: string;
  attributes: Array<[name: string, value: string]>;
  text: string;
  children: CanonicalXmlElement[];
}

function canonicalizeXml(xml: string): CanonicalXmlElement {
  const dom = new DOMParser().parseFromString(xml, "text/xml");
  const root = canonicalizeElement(dom.documentElement);
  // The order of the schema's direct children (items, the CA block) varies between emitters and
  // carries no meaning - normalize it. Order below item level stays significant.
  root.children.sort((a, b) => childSortKey(a).localeCompare(childSortKey(b)));
  return root;
}

function childSortKey(element: CanonicalXmlElement): string {
  const name = element.attributes.find(([attribute]) => attribute === "typeName" || attribute === "name")?.[1] ?? "";
  return `${element.name}\u0000${name}`;
}

function canonicalizeElement(element: Element): CanonicalXmlElement {
  const attributes: Array<[string, string]> = [];
  for (let i = 0; i < element.attributes.length; ++i) {
    const attribute = element.attributes.item(i)!;
    attributes.push([attribute.name, attribute.value]);
  }
  attributes.sort(([a], [b]) => a.localeCompare(b));

  let text = "";
  const children: CanonicalXmlElement[] = [];
  for (let i = 0; i < element.childNodes.length; ++i) {
    const node = element.childNodes.item(i);
    if (node.nodeType === 1) // element
      children.push(canonicalizeElement(node as Element));
    else if (node.nodeType === 3 || node.nodeType === 4) // text, cdata - comments (8) are dropped
      text += node.nodeValue ?? "";
  }
  // The position of a container's <ECCustomAttributes> block among its siblings (BaseClass
  // entries, properties) varies between emitters and carries no meaning - hoist it to the front.
  // The same goes for a relationship's <Source>/<Target> relative to its properties - push them
  // to the back. Sibling order otherwise stays significant (BaseClass order, property order).
  const hoisted = [
    ...children.filter((child) => child.name === "ECCustomAttributes"),
    ...children.filter((child) => child.name !== "ECCustomAttributes" && child.name !== "Source" && child.name !== "Target"),
    ...children.filter((child) => child.name === "Source" || child.name === "Target"),
  ];
  return { name: element.nodeName, attributes, text: text.trim(), children: hoisted };
}

function diffCanonicalXml(path: string, left: CanonicalXmlElement | undefined, right: CanonicalXmlElement | undefined, out: string[]): void {
  if (left === undefined || right === undefined || left.name !== right.name) {
    out.push(`${path}: <${left?.name ?? "absent"}> vs <${right?.name ?? "absent"}>`);
    return;
  }
  const attributeNames = new Set([...left.attributes.map(([name]) => name), ...right.attributes.map(([name]) => name)]);
  const isRoot = !path.includes("/");
  for (const name of attributeNames) {
    // Below the root, xmlns appears only on custom attribute instances, where it is derived
    // plumbing: the writer recomputes it from the canonical reference list, while published files
    // often carry a stale version (or omit it for own-schema CAs). Only the root xmlns - the spec
    // version - is semantic.
    if (name === "xmlns" && !isRoot)
      continue;
    const leftValue = left.attributes.find(([n]) => n === name)?.[1];
    const rightValue = right.attributes.find(([n]) => n === name)?.[1];
    // maxOccurs="unbounded" and an absent maxOccurs mean the same thing; the writer canonicalizes
    // to absence. Likewise minOccurs absent means 0.
    if (name === "maxOccurs" && (leftValue ?? "unbounded").toLowerCase() === "unbounded" && (rightValue ?? "unbounded").toLowerCase() === "unbounded")
      continue;
    if (name === "minOccurs" && (leftValue ?? "0") === (rightValue ?? "0"))
      continue;
    // formatTraits is an unordered trait set with case-insensitive spellings.
    if (name === "formatTraits" && leftValue !== undefined && rightValue !== undefined) {
      const traitSet = (value: string): string => value.toLowerCase().split(/[|,;]/).map((t) => t.trim()).sort().join("|");
      if (traitSet(leftValue) === traitSet(rightValue))
        continue;
    }
    if (leftValue === undefined || rightValue === undefined || !scalarsMatch(leftValue, rightValue))
      out.push(`${path}@${name}: ${JSON.stringify(leftValue)} vs ${JSON.stringify(rightValue)}`);
  }
  if (!scalarsMatch(left.text, right.text))
    out.push(`${path} text: ${JSON.stringify(left.text)} vs ${JSON.stringify(right.text)}`);
  const length = Math.max(left.children.length, right.children.length);
  for (let i = 0; i < length; ++i) {
    const leftChild = left.children[i];
    diffCanonicalXml(`${path}/${leftChild?.name ?? right.children[i]?.name ?? "?"}[${i}]`, leftChild, right.children[i], out);
  }
}

function preview(differences: string[], limit = 25): string {
  const lines = differences.slice(0, limit);
  if (differences.length > limit)
    lines.push(`... and ${differences.length - limit} more`);
  return lines.join("\n");
}

// ===== The suite =====

describe("real released schemas (from @bentley schema packages)", () => {
  for (const { packageName, schemaName } of SCHEMA_PACKAGES) {
    describe(schemaName, () => {
      async function loadTexts(): Promise<{ xml: string, json: string }> {
        return {
          xml: await readFile(assetPath(packageName, `${schemaName}.ecschema.xml`), "utf-8"),
          json: await readFile(assetPath(packageName, `${schemaName}.ecschema.json`), "utf-8"),
        };
      }

      it("round-trips the published XML with stable output", async () => {
        const { xml } = await loadTexts();
        const document = await readDocumentFromXml(xml, schemaName);
        const writer = new SchemaXmlWriter();
        const firstWrite = writer.writeDocument(document);
        expect(firstWrite.issues.hasErrors, JSON.stringify(firstWrite.issues.errors)).to.be.false;
        const reread = await readDocumentFromXml(firstWrite.text!, schemaName);
        expect(writer.writeDocument(reread).text).to.equal(firstWrite.text);
      });

      it("round-trips the published JSON with stable output", async () => {
        const { json } = await loadTexts();
        const document = await readDocumentFromJson(json, schemaName);
        const writer = new SchemaJsonWriter();
        const firstWrite = writer.writeDocument(document);
        expect(firstWrite.issues.hasErrors, JSON.stringify(firstWrite.issues.errors)).to.be.false;
        const reread = await readDocumentFromJson(firstWrite.text!, schemaName);
        expect(writer.writeDocument(reread).text).to.equal(firstWrite.text);
      });

      it("XML-read and JSON-read documents compare equal", async () => {
        const { xml, json } = await loadTexts();
        const fromXml = await readDocumentFromXml(xml, schemaName);
        const fromJson = await readDocumentFromJson(json, schemaName);
        // Some packages published their XML and JSON from different source revisions, so the
        // reference versions can genuinely differ (e.g. Formats.ecschema.xml references Units
        // 01.00.00, the .json 01.00.05). Align them - that skew is the package's, not ours.
        for (const reference of fromXml.references)
          fromJson.setSchemaReference(reference);
        const comparison = compareSchemaDocuments(fromXml, fromJson);
        expect(comparison.areEqual, formatSchemaComparison(comparison)).to.be.true;
      });

      it("re-emitted JSON matches the published JSON (independent oracle)", async () => {
        const { json } = await loadTexts();
        const document = await readDocumentFromJson(json, schemaName);
        const emitted = new SchemaJsonWriter().writeDocument(document).text!;
        const differences: string[] = [];
        diffJson(schemaName, JSON.parse(json), JSON.parse(emitted), differences);
        expect(differences, preview(differences)).to.be.empty;
      });

      it("re-emitted XML matches the published XML semantically (independent oracle)", async () => {
        const { xml } = await loadTexts();
        const document = await readDocumentFromXml(xml, schemaName);
        const emitted = new SchemaXmlWriter().writeDocument(document).text!;
        const differences: string[] = [];
        diffCanonicalXml(schemaName, canonicalizeXml(xml), canonicalizeXml(emitted), differences);
        expect(differences, preview(differences)).to.be.empty;
      });
    });
  }
});
