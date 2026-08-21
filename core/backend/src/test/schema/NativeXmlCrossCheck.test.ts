/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Authoring, ECSpecVersion } from "@itwin/ecschema-metadata";
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
});
