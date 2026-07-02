/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { SchemaManifest, SchemaManifestEntry } from "../SchemaView/SchemaManifest";

/** Spec for one schema in a test manifest: its name, minor version, and the names it references. */
interface EntrySpec {
  name: string;
  minorVersion?: number;
  refs?: string[];
}

/** Builds a {@link SchemaManifest} from name-based specs, wiring each entry's references to the
 * entry objects named in `refs`. Unknown reference names are ignored. */
function makeManifest(specs: EntrySpec[]): SchemaManifest {
  const byName = new Map<string, SchemaManifestEntry & { references: SchemaManifestEntry[] }>();
  const entries = specs.map((spec) => {
    const entry = {
      name: spec.name,
      readVersion: 1,
      writeVersion: 0,
      minorVersion: spec.minorVersion ?? 0,
      references: [] as SchemaManifestEntry[],
    };
    byName.set(spec.name.toLowerCase(), entry);
    return entry;
  });
  for (const spec of specs) {
    const entry = byName.get(spec.name.toLowerCase())!;
    for (const ref of spec.refs ?? []) {
      const target = byName.get(ref.toLowerCase());
      if (target !== undefined)
        entry.references.push(target);
    }
  }
  return new SchemaManifest(entries);
}

/** A small reference graph mirroring a real iModel's shape: standard schemas at the bottom, domain
 * schemas on top.
 *
 *   Units      CoreCustomAttributes
 *     ^                 ^
 *   Formats->Units      |
 *     ^      ^          |
 *      \      \         |
 *       BisCore -> Units, Formats, CoreCustomAttributes
 *         ^      ^
 *   Generic  Functional   (both -> BisCore)
 */
function makeSpecs(): EntrySpec[] {
  return [
    { name: "Units" },
    { name: "Formats", refs: ["Units"] },
    { name: "CoreCustomAttributes", minorVersion: 1 },
    { name: "BisCore", minorVersion: 15, refs: ["Units", "Formats", "CoreCustomAttributes"] },
    { name: "Generic", minorVersion: 2, refs: ["BisCore"] },
    { name: "Functional", refs: ["BisCore"] },
  ];
}

/** Asserts `before` appears at an earlier position than `after` in a load order. */
function expectOrder(order: readonly string[], before: string, after: string): void {
  const beforeIndex = order.indexOf(before);
  const afterIndex = order.indexOf(after);
  expect(beforeIndex, `${before} should be present`).to.be.greaterThanOrEqual(0);
  expect(afterIndex, `${after} should be present`).to.be.greaterThanOrEqual(0);
  expect(beforeIndex, `${before} should load before ${after}`).to.be.lessThan(afterIndex);
}

describe("SchemaManifest", () => {
  it("exposes schema count, names, and per-schema identity", () => {
    const manifest = makeManifest(makeSpecs());

    expect(manifest.schemaCount).to.equal(6);
    expect(manifest.getAvailableSchemaNames()).to.deep.equal(["Units", "Formats", "CoreCustomAttributes", "BisCore", "Generic", "Functional"]);

    const bisCore = manifest.findByName("BisCore");
    expect(bisCore?.name).to.equal("BisCore");
    expect(bisCore?.minorVersion).to.equal(15);
  });

  it("looks up schemas case-insensitively", () => {
    const manifest = makeManifest(makeSpecs());
    expect(manifest.findByName("biscore")?.name).to.equal("BisCore");
    expect(manifest.findByName("BISCORE")?.name).to.equal("BisCore");
    expect(manifest.findByName("NotASchema")).to.be.undefined;
  });

  it("wires references to the referenced entry objects", () => {
    const manifest = makeManifest(makeSpecs());
    const bisCore = manifest.findByName("BisCore")!;
    const refNames = bisCore.references.map((entry) => entry.name).sort();
    expect(refNames).to.deep.equal(["CoreCustomAttributes", "Formats", "Units"]);
    expect(bisCore.references).to.include(manifest.findByName("Units"));
    expect(manifest.findByName("Units")!.references).to.deep.equal([]);
  });
});

describe("SchemaManifest.getSchemaClosure", () => {
  it("returns only the requested schema when it has no references", () => {
    const manifest = makeManifest(makeSpecs());
    expect(manifest.getSchemaClosure(["Units"])).to.deep.equal(["Units"]);
  });

  it("returns the requested schema plus its transitive references", () => {
    const manifest = makeManifest(makeSpecs());
    const names = manifest.getSchemaClosure(["Generic"]).sort();
    expect(names).to.deep.equal(["BisCore", "CoreCustomAttributes", "Formats", "Generic", "Units"]);
  });

  it("merges the closures of multiple requested schemas without duplicates", () => {
    const manifest = makeManifest(makeSpecs());
    const names = manifest.getSchemaClosure(["Generic", "Functional"]);
    expect(new Set(names).size).to.equal(names.length); // no duplicates
    expect([...names].sort()).to.deep.equal(["BisCore", "CoreCustomAttributes", "Formats", "Functional", "Generic", "Units"]);
  });

  it("ignores requested names the iModel does not contain", () => {
    const manifest = makeManifest(makeSpecs());
    const names = manifest.getSchemaClosure(["Generic", "NotASchema"]);
    expect(names).to.include("Generic");
    expect(names).to.not.include("NotASchema");
  });

  it("terminates on a reference cycle rather than looping", () => {
    // EC prohibits reference cycles, but the walk must still be defensive.
    const manifest = makeManifest([
      { name: "A", refs: ["B"] },
      { name: "B", refs: ["A"] },
    ]);
    expect(manifest.getSchemaClosure(["A"]).sort()).to.deep.equal(["A", "B"]);
  });
});

describe("SchemaManifest.sortInDependencyOrder", () => {
  it("orders each schema after the schemas it references", () => {
    const manifest = makeManifest(makeSpecs());
    const order = manifest.sortInDependencyOrder(["Generic", "Units", "Formats", "BisCore", "CoreCustomAttributes"]);
    expect(order.slice().sort()).to.deep.equal(["BisCore", "CoreCustomAttributes", "Formats", "Generic", "Units"]);
    expectOrder(order, "Units", "Formats");
    expectOrder(order, "Units", "BisCore");
    expectOrder(order, "Formats", "BisCore");
    expectOrder(order, "CoreCustomAttributes", "BisCore");
    expectOrder(order, "BisCore", "Generic");
  });

  it("returns only the given names, not their references", () => {
    const manifest = makeManifest(makeSpecs());
    // BisCore's references (Units, Formats, CoreCustomAttributes) are not in the input, so they are
    // not added - only the two requested names come back.
    const order = manifest.sortInDependencyOrder(["Generic", "BisCore"]);
    expect(order.slice().sort()).to.deep.equal(["BisCore", "Generic"]);
    expectOrder(order, "BisCore", "Generic");
  });

  it("honors dependencies that run through a schema left out of the input", () => {
    const manifest = makeManifest(makeSpecs());
    // Generic -> BisCore -> Units. With BisCore excluded, Units must still come before Generic.
    const order = manifest.sortInDependencyOrder(["Generic", "Units"]);
    expect(order.slice().sort()).to.deep.equal(["Generic", "Units"]);
    expectOrder(order, "Units", "Generic");
  });

  it("emits a schema shared through two omitted intermediates once, ahead of both requesters", () => {
    // A -> B -> C and F -> D -> C. With B and D excluded from the input, C is reached along two
    // separate paths but must appear exactly once and before both A and F, giving C, A, F or C, F, A.
    const manifest = makeManifest([
      { name: "C" },
      { name: "B", refs: ["C"] },
      { name: "D", refs: ["C"] },
      { name: "A", refs: ["B"] },
      { name: "F", refs: ["D"] },
    ]);
    const order = manifest.sortInDependencyOrder(["A", "C", "F"]);
    expect(order.slice().sort()).to.deep.equal(["A", "C", "F"]); // no duplicate C
    expectOrder(order, "C", "A");
    expectOrder(order, "C", "F");
  });

  it("ignores names the iModel does not contain", () => {
    const manifest = makeManifest(makeSpecs());
    const order = manifest.sortInDependencyOrder(["Generic", "NotASchema"]);
    expect(order).to.deep.equal(["Generic"]);
  });

  it("terminates on a reference cycle rather than looping", () => {
    const manifest = makeManifest([
      { name: "A", refs: ["B"] },
      { name: "B", refs: ["A"] },
    ]);
    expect(manifest.sortInDependencyOrder(["A", "B"]).slice().sort()).to.deep.equal(["A", "B"]);
  });
});
