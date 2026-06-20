/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { SchemaManifest, SchemaManifestReferenceRow, SchemaManifestSchemaRow } from "../SchemaView/SchemaManifest";

/** A small reference graph mirroring a real iModel's shape: standard schemas at the bottom, domain
 * schemas on top. ECInstanceIds are deliberately not equal to manifest indices so the id<->index
 * mapping is exercised.
 *
 *   Units(10)      CoreCustomAttributes(30)
 *     ^                    ^
 *   Formats(20)->Units     |
 *     ^      ^             |
 *      \      \            |
 *       BisCore(40) -> Units, Formats, CoreCustomAttributes
 *         ^      ^
 *   Generic(50)  Functional(60)   (both -> BisCore)
 */
function makeRows(): { schemaRows: SchemaManifestSchemaRow[], referenceRows: SchemaManifestReferenceRow[] } {
  const schemaRows: SchemaManifestSchemaRow[] = [
    { id: 10, name: "Units", versionMajor: 1, versionWrite: 0, versionMinor: 0 },
    { id: 20, name: "Formats", versionMajor: 1, versionWrite: 0, versionMinor: 0 },
    { id: 30, name: "CoreCustomAttributes", versionMajor: 1, versionWrite: 0, versionMinor: 1 },
    { id: 40, name: "BisCore", versionMajor: 1, versionWrite: 0, versionMinor: 15 },
    { id: 50, name: "Generic", versionMajor: 1, versionWrite: 0, versionMinor: 2 },
    { id: 60, name: "Functional", versionMajor: 1, versionWrite: 0, versionMinor: 0 },
  ];
  const referenceRows: SchemaManifestReferenceRow[] = [
    { schemaId: 20, referencedSchemaId: 10 }, // Formats -> Units
    { schemaId: 40, referencedSchemaId: 10 }, // BisCore -> Units
    { schemaId: 40, referencedSchemaId: 20 }, // BisCore -> Formats
    { schemaId: 40, referencedSchemaId: 30 }, // BisCore -> CoreCustomAttributes
    { schemaId: 50, referencedSchemaId: 40 }, // Generic -> BisCore
    { schemaId: 60, referencedSchemaId: 40 }, // Functional -> BisCore
  ];
  return { schemaRows, referenceRows };
}

/** Asserts `before` appears at an earlier position than `after` in a load order. */
function expectOrder(order: readonly { name: string }[], before: string, after: string): void {
  const beforeIndex = order.findIndex((entry) => entry.name === before);
  const afterIndex = order.findIndex((entry) => entry.name === after);
  expect(beforeIndex, `${before} should be present`).to.be.greaterThanOrEqual(0);
  expect(afterIndex, `${after} should be present`).to.be.greaterThanOrEqual(0);
  expect(beforeIndex, `${before} should load before ${after}`).to.be.lessThan(afterIndex);
}

describe("SchemaManifest.fromRows", () => {
  it("assigns dense indices in schema-row order and maps name and ecInstanceId", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);

    expect(manifest.schemaCount).to.equal(6);
    expect(manifest.getAvailableSchemaNames()).to.deep.equal(["Units", "Formats", "CoreCustomAttributes", "BisCore", "Generic", "Functional"]);

    const bisCore = manifest.findByName("BisCore");
    expect(bisCore?.index).to.equal(3);
    expect(bisCore?.ecInstanceId).to.equal(40);
    expect(bisCore?.minorVersion).to.equal(15);
    expect(manifest.findByEcInstanceId(40)).to.equal(bisCore);
    expect(manifest.getEntry(3)).to.equal(bisCore);
  });

  it("looks up schemas case-insensitively", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    expect(manifest.findByName("biscore")?.name).to.equal("BisCore");
    expect(manifest.findByName("BISCORE")?.name).to.equal("BisCore");
  });

  it("resolves references to manifest indices", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    const bisCore = manifest.findByName("BisCore")!;
    const refNames = bisCore.references.map((index) => manifest.getEntry(index)!.name).sort();
    expect(refNames).to.deep.equal(["CoreCustomAttributes", "Formats", "Units"]);
    expect(manifest.findByName("Units")!.references).to.deep.equal([]);
  });

  it("ignores reference rows whose endpoints are unknown or self-referential", () => {
    const schemaRows: SchemaManifestSchemaRow[] = [
      { id: 10, name: "Units", versionMajor: 1, versionWrite: 0, versionMinor: 0 },
    ];
    const referenceRows: SchemaManifestReferenceRow[] = [
      { schemaId: 10, referencedSchemaId: 999 }, // unknown target
      { schemaId: 888, referencedSchemaId: 10 }, // unknown source
      { schemaId: 10, referencedSchemaId: 10 },  // self
    ];
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    expect(manifest.findByName("Units")!.references).to.deep.equal([]);
  });

  it("deduplicates repeated reference rows", () => {
    const schemaRows: SchemaManifestSchemaRow[] = [
      { id: 10, name: "Units", versionMajor: 1, versionWrite: 0, versionMinor: 0 },
      { id: 20, name: "Formats", versionMajor: 1, versionWrite: 0, versionMinor: 0 },
    ];
    const referenceRows: SchemaManifestReferenceRow[] = [
      { schemaId: 20, referencedSchemaId: 10 },
      { schemaId: 20, referencedSchemaId: 10 },
    ];
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    expect(manifest.findByName("Formats")!.references).to.have.length(1);
  });
});

describe("SchemaManifest.computeLoadOrder", () => {
  it("returns only the requested schema when it has no references", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    const order = manifest.computeLoadOrder(["Units"]);
    expect(order.map((entry) => entry.name)).to.deep.equal(["Units"]);
  });

  it("returns the transitive closure in dependency order", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    const order = manifest.computeLoadOrder(["Generic"]);
    const names = order.map((entry) => entry.name).sort();
    expect(names).to.deep.equal(["BisCore", "CoreCustomAttributes", "Formats", "Generic", "Units"]);
    expectOrder(order, "Units", "Formats");
    expectOrder(order, "Units", "BisCore");
    expectOrder(order, "Formats", "BisCore");
    expectOrder(order, "CoreCustomAttributes", "BisCore");
    expectOrder(order, "BisCore", "Generic");
  });

  it("merges the closures of multiple requested schemas without duplicates", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    const order = manifest.computeLoadOrder(["Generic", "Functional"]);
    const names = order.map((entry) => entry.name);
    expect(new Set(names).size).to.equal(names.length); // no duplicates
    expect(names.sort()).to.deep.equal(["BisCore", "CoreCustomAttributes", "Formats", "Functional", "Generic", "Units"]);
    expectOrder(order, "BisCore", "Generic");
    expectOrder(order, "BisCore", "Functional");
  });

  it("excludes already-loaded schemas and does not re-walk their closure", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    // Pretend BisCore and its whole closure are already loaded.
    const loaded = new Set([
      manifest.findByName("Units")!.index,
      manifest.findByName("Formats")!.index,
      manifest.findByName("CoreCustomAttributes")!.index,
      manifest.findByName("BisCore")!.index,
    ]);
    const order = manifest.computeLoadOrder(["Generic"], loaded);
    expect(order.map((entry) => entry.name)).to.deep.equal(["Generic"]);
  });

  it("returns nothing when everything requested is already loaded", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    const loaded = new Set([manifest.findByName("Units")!.index]);
    expect(manifest.computeLoadOrder(["Units"], loaded)).to.deep.equal([]);
  });

  it("ignores requested names the iModel does not contain", () => {
    const { schemaRows, referenceRows } = makeRows();
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    const order = manifest.computeLoadOrder(["Generic", "NotASchema"]);
    expect(order.some((entry) => entry.name === "Generic")).to.be.true;
    expect(order.some((entry) => entry.name === "NotASchema")).to.be.false;
  });

  it("terminates on a reference cycle rather than looping", () => {
    // EC prohibits reference cycles, but the walk must still be defensive.
    const schemaRows: SchemaManifestSchemaRow[] = [
      { id: 10, name: "A", versionMajor: 1, versionWrite: 0, versionMinor: 0 },
      { id: 20, name: "B", versionMajor: 1, versionWrite: 0, versionMinor: 0 },
    ];
    const referenceRows: SchemaManifestReferenceRow[] = [
      { schemaId: 10, referencedSchemaId: 20 },
      { schemaId: 20, referencedSchemaId: 10 },
    ];
    const manifest = SchemaManifest.fromRows(schemaRows, referenceRows);
    const order = manifest.computeLoadOrder(["A"]);
    expect(order.map((entry) => entry.name).sort()).to.deep.equal(["A", "B"]);
  });
});
