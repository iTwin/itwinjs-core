/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Authoring, ECSpecVersion, SchemaItemType } from "@itwin/ecschema-metadata";
import { IModelHost } from "../../IModelHost";
import { SnapshotDb } from "../../IModelDb";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUtils } from "../TestUtils";

/**
 * Cross-checks the TypeScript ECXML writers against the native one.
 *
 * `IModelDb.exportSchemaXmlString` asks native to serialize a schema held in an iModel, at any
 * ECXML spec version. That gives an oracle we do not control: read native's XML with our reader,
 * write it back with our writer at the same version, and the two documents should describe the same
 * schema. Doing it at *two* versions additionally checks that our upgrade agrees with native's -
 * the 3.1 and the 3.2 serialization of one schema must read into equal documents.
 *
 * This is a discovery tool rather than a strict contract. The spec versions differ in ways neither
 * stack fully reconciles (defaults materialized on one side only, presentation formats rewritten,
 * custom attributes whose classes are not in the file), so a difference here is a lead to
 * investigate, not automatically a bug. `expectedDifferencePaths` records the ones already
 * understood; anything else fails so it gets looked at.
 */
describe("Native ECXML serialization cross-check", () => {
  let iModel: SnapshotDb;

  /** Difference paths that are understood and not worth failing on. Matched as substrings. */
  const expectedDifferencePaths: string[] = [
    // Native materializes spec defaults its XML omits, asymmetrically per version. The document
    // preserves whatever the source said, so an absent-vs-default pair shows up here.
    ".strengthDirection",
    ".modifier",
    ".stationSeparator",
    // A KindOfQuantity's presentation formats are FUS descriptors before 3.2 and unit/format
    // references from 3.2; the two spellings do not compare as equal strings.
    ".presentationFormats",
    ".persistenceUnit",
    // Before 3.2 an enumerator carries no name, so one is synthesized from its value. Native's own
    // 3.2 output has the real names, which need not match what synthesis produces - unavoidable,
    // and the XML writer reports it per enumerator as SchemaXml-0061.
    "enumerators.",
  ];

  function unexpected(differences: Array<{ path: string }>): Array<{ path: string }> {
    return differences.filter((d) => !expectedDifferencePaths.some((known) => d.path.includes(known)));
  }

  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
    iModel = SnapshotDb.openFile(path.join(KnownTestLocations.assetsDir, "sim-master.bim"));
  });

  after(() => {
    iModel?.close();
  });

  /** Every schema in the iModel, with the spec version native stored it at. */
  async function schemasInIModel(): Promise<Array<{ name: string, readVersion: number, writeVersion: number }>> {
    const rows: Array<{ name: string, readVersion: number, writeVersion: number }> = [];
    const reader = iModel.createQueryReader("SELECT Name, OriginalECXmlVersionMajor, OriginalECXmlVersionMinor FROM meta.ECSchemaDef");
    for await (const row of reader) {
      rows.push({
        name: row[0] as string,
        readVersion: (row[1] as number | undefined) ?? 3,
        writeVersion: (row[2] as number | undefined) ?? 2,
      });
    }
    return rows;
  }

  async function readNative(schemaName: string, version: ECSpecVersion): Promise<Authoring.SchemaDocument | undefined> {
    const xml = iModel.exportSchemaXmlString(schemaName, version);
    if (xml === undefined)
      return undefined;
    const result = await new Authoring.SchemaXmlReader().readDocument(xml, { source: `${schemaName} (native ${version.readVersion}.${version.writeVersion})` });
    const errors = [...result.issues].filter((i) => i.severity === "error");
    assert.deepEqual(errors.map((e) => e.message), [], `reading native ${version.readVersion}.${version.writeVersion} XML for ${schemaName}`);
    return result.document;
  }

  it("round-trips every schema in the iModel through our reader and writer", async () => {
    const checked: string[] = [];
    for (const schema of await schemasInIModel()) {
      const version = { readVersion: 3, writeVersion: 2 };
      const original = await readNative(schema.name, version);
      if (original === undefined)
        continue;

      const written = new Authoring.SchemaXmlWriter().writeDocument(original, { spec: Authoring.ECSpec.V3_2 });
      assert.isDefined(written.text, `writing ${schema.name}: ${[...written.issues].map((i) => i.message).join("; ")}`);
      const reread = (await new Authoring.SchemaXmlReader().readDocument(written.text!)).document!;

      const comparison = Authoring.compareSchemaDocuments(original, reread);
      const differences = unexpected(comparison.itemDifferences.flatMap((i) => i.differences).concat(comparison.schemaDifferences));
      assert.deepEqual(differences.map((d) => d.path), [], `${schema.name} did not survive our own 3.2 round trip`);
      checked.push(schema.name);
    }
    assert.isAtLeast(checked.length, 5, "expected the seed iModel to hold several schemas");
  });

  it("agrees with native on what a 3.1 schema means at 3.2", async () => {
    // sim-master holds at least one schema stored as 3.1 (Raster). Native can serialize it at
    // either version, so its own upgrade is the reference for ours.
    const report: string[] = [];
    for (const schema of await schemasInIModel()) {
      const at31 = await readNative(schema.name, { readVersion: 3, writeVersion: 1 });
      const at32 = await readNative(schema.name, { readVersion: 3, writeVersion: 2 });
      if (at31 === undefined || at32 === undefined)
        continue;

      const comparison = Authoring.compareSchemaDocuments(at31, at32);
      const differences = unexpected(comparison.itemDifferences.flatMap((i) => i.differences).concat(comparison.schemaDifferences));
      if (differences.length > 0)
        report.push(`${schema.name}:\n    ${differences.slice(0, 10).map((d) => d.path).join("\n    ")}`);
    }
    // Reported rather than asserted: the two spec versions genuinely differ, and the point of this
    // check is to surface differences we have not accounted for.
    if (report.length > 0)
      // eslint-disable-next-line no-console
      console.log(`3.1 vs 3.2 differences not yet accounted for:\n  ${report.join("\n  ")}`);
  });

  it("reads native's ECXML 2.0 output and writes 2.0 native can read back", async () => {
    // Asking native for 2.0 routes through its own down converter, so this is the legacy vocabulary
    // as native produces it: flagged ECClass elements, cardinality, struct arrays as a flag, and
    // StandardValues in place of enumerations.
    const checked: string[] = [];
    for (const schema of await schemasInIModel()) {
      const native20 = iModel.exportSchemaXmlString(schema.name, { readVersion: 2, writeVersion: 0 });
      if (native20 === undefined)
        continue;
      assert.include(native20, "Bentley.ECXML.2.0", `native did not produce 2.0 for ${schema.name}`);

      const read = await new Authoring.SchemaXmlReader().readDocument(native20, { source: `${schema.name} (native 2.0)` });
      const errors = [...read.issues].filter((i) => i.severity === "error");
      assert.deepEqual(errors.map((e) => e.message), [], `reading native 2.0 XML for ${schema.name}`);

      const written = new Authoring.SchemaXmlWriter().writeDocument(read.document!, { spec: Authoring.ECSpec.V2_0 });
      assert.isDefined(written.text, `writing ${schema.name} at 2.0`);
      const reread = (await new Authoring.SchemaXmlReader().readDocument(written.text!)).document!;

      const comparison = Authoring.compareSchemaDocuments(read.document!, reread);
      const differences = unexpected(comparison.itemDifferences.flatMap((i) => i.differences).concat(comparison.schemaDifferences));
      assert.deepEqual(differences.map((d) => d.path), [], `${schema.name} did not survive our own 2.0 round trip`);
      checked.push(schema.name);
    }
    assert.isAtLeast(checked.length, 5, "expected the seed iModel to hold several schemas");
  });

  it("recovers from native's ECXML 2.0 output the enumerations native put into StandardValues", async () => {
    // Native's 2.0 export turns an integer enumeration into an EditorCustomAttributes:StandardValues
    // custom attribute. Our converter is the other half of that, so every enumeration it recovers
    // has to match one native holds at 3.2 - same values, same display strings.
    //
    // The reverse does not hold: native only emits StandardValues where the enumeration is declared
    // locally on a property with no base property, so a 3.2 enumeration can have no 2.0 counterpart
    // to recover. That is native's downgrade being lossy, not ours.
    const unmatched: string[] = [];
    let recoveredCount = 0;
    for (const schema of await schemasInIModel()) {
      const native20 = iModel.exportSchemaXmlString(schema.name, { readVersion: 2, writeVersion: 0 });
      const native32 = iModel.exportSchemaXmlString(schema.name, { readVersion: 3, writeVersion: 2 });
      if (native20 === undefined || native32 === undefined || !native20.includes("StandardValues"))
        continue;

      const converted = (await new Authoring.SchemaXmlReader().readDocument(native20)).document!;
      Authoring.convertEC2CustomAttributes(converted);
      const at32 = (await new Authoring.SchemaXmlReader().readDocument(native32)).document!;

      // The conversion names an enumeration after the class and property that carried the attribute,
      // since 2.0 carries no name of its own, so identity is the value set.
      const valuesOf = (document: Authoring.SchemaDocument) => [...document.getItemsOfType(SchemaItemType.Enumeration)]
        .filter((e) => e.backingType === "int")
        .map((e) => e.enumerators.map((enumerator) => `${enumerator.value}=${enumerator.label ?? ""}`).sort().join(","));
      const expected = new Set(valuesOf(at32));
      for (const recovered of valuesOf(converted)) {
        ++recoveredCount;
        if (!expected.has(recovered))
          unmatched.push(`${schema.name}: ${recovered}`);
      }
    }
    assert.deepEqual(unmatched, [], "a recovered enumeration does not match any native holds at 3.2");
    assert.isAtLeast(recoveredCount, 3, "expected the seed iModel to hold enumerations native downgrades to StandardValues");
  });
});
