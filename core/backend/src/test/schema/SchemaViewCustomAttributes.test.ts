/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import type { CustomAttribute, IModelSchemaView } from "@itwin/ecschema-metadata";
import { IModelHost, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";

/**
 * Tests for the custom attribute access within iModels `IModelSchemaView.customAttributes`.
 *
 * The central guarantee under test: the API returns custom attributes in the **canonical
 * ECJSON form** found in the published `*.ecschema.json` packages (`{ className, ...values }` with
 * a dot-separated full class name), NOT the internal envelope shape that the native `XmlCAToJson`
 * ECSql function emits (which wraps the values under a class-name key and adds `ecClass` / `ecSchema`
 * fields).
 *
 * Expected values are a small set of inlined anchor custom attributes (see `EXPECTED_*` below).
 * These are long-stable BisCore custom attributes, so the expectations rarely need touching; this
 * keeps the tests mostly robust against BisCore changes.
 */
describe("SchemaView custom attributes (iModel sidecar)", () => {
  let iModel: SnapshotDb;
  let view: IModelSchemaView;

  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
    // An empty iModel already imports BisCore (the source of every custom attribute exercised here)
    const fileName = IModelTestUtils.prepareOutputFile("SchemaViewCustomAttributes", "SchemaViewCustomAttributes.bim");
    iModel = SnapshotDb.createEmpty(fileName, { rootSubject: { name: "SchemaView custom attributes" } });
    view = await iModel.getSchemaView();
  });

  after(() => {
    iModel?.close();
  });

  it("returns canonical CA JSON, not the native XmlCAToJson envelope", async () => {
    const bisCore = view.getSchema("BisCore");
    assert.isDefined(bisCore, "BisCore schema not found in view");

    const cas = await view.customAttributes.getSchemaCustomAttributes(bisCore!);
    expect(cas.length, "BisCore should carry schema-level custom attributes").to.be.greaterThan(0);

    for (const ca of cas) {
      // Canonical form: a dot-separated full class name and no envelope fields.
      expect(ca.className, "className must be a string").to.be.a("string");
      expect(ca.className, "className must be a full name with a dot separator").to.contain(".");
      expect(ca, "envelope field 'ecClass' must be stripped").to.not.have.property("ecClass");
      expect(ca, "envelope field 'ecSchema' must be stripped").to.not.have.property("ecSchema");
      // The class-name key wrapper must be gone (values are flattened onto the CA object).
      const shortName = ca.className.split(".").pop()!;
      expect(ca, `class-name wrapper key '${shortName}' must be flattened away`).to.not.have.property(shortName);
    }
  });

  it("matches expected canonical JSON for schema-level custom attributes", async () => {
    const bisCore = view.getSchema("BisCore")!;
    const sidecar = await view.customAttributes.getSchemaCustomAttributes(bisCore);

    // ProductionStatus carries a scalar string value; SchemaHasBehavior is an empty marker CA.
    assertAnchorsMatch(sidecar, EXPECTED_SCHEMA_CAS);
  });

  it("matches expected canonical JSON for a class with a typed struct-array CA", async () => {
    // ExternalSourceAspect carries ECDbMap.DbIndexList - a struct array whose entries include a
    // boolean (IsUnique) and a string array (Properties). This exercises the native typed
    // conversion: booleans must come back as real booleans and the array as a real array, matching
    // the canonical JSON exactly rather than the raw XML text.
    const cls = view.findClass("BisCore:ExternalSourceAspect");
    assert.isDefined(cls, "ExternalSourceAspect class not found");

    const sidecar = await view.customAttributes.getClassCustomAttributes(cls!);

    assertAnchorsMatch(sidecar, EXPECTED_EXTERNAL_SOURCE_ASPECT_CAS);

    // Spot-check the typed values directly to lock the contract.
    const dbIndexList = findCa(sidecar, "ECDbMap.DbIndexList")!;
    const indexes = dbIndexList.Indexes as Array<Record<string, unknown>>;
    expect(indexes, "DbIndexList.Indexes should be an array").to.be.an("array");
    expect(indexes.length).to.be.greaterThan(0);
    expect(indexes[0].IsUnique, "IsUnique should be a real boolean, not text").to.be.a("boolean");
    expect(indexes[0].Properties, "Properties should be a real array").to.be.an("array");
  });

  it("matches expected canonical JSON for a property-level CA", async () => {
    // GeometricElement3d declares GeometryStream with a HiddenProperty CA (an empty marker).
    const cls = view.findClass("BisCore:GeometricElement3d");
    assert.isDefined(cls, "GeometricElement3d class not found");
    const prop = cls!.getProperty("GeometryStream");
    assert.isDefined(prop, "GeometryStream property not found");

    const propertyCAs = await view.customAttributes.getPropertyCustomAttributes(prop!);

    assertAnchorsMatch(propertyCAs, EXPECTED_GEOMETRY_STREAM_CAS);
  });

  it("returns an empty array for a container with no custom attributes", async () => {
    const cls = view.findClass("BisCore:Subject");
    assert.isDefined(cls, "Subject class not found");
    const prop = cls!.getProperty("Description");
    assert.isDefined(prop, "Subject.Description property not found");

    const cas = await view.customAttributes.getPropertyCustomAttributes(prop!);
    expect(cas).to.deep.equal([]);
  });

  describe("single named custom attribute", () => {
    it("returns a flag (empty) custom attribute as `{ className }`, not undefined", async () => {
      // GeometryStream carries HiddenProperty, a content-less flag CA. Present-but-empty must be
      // distinguishable from absent.
      const prop = view.findClass("BisCore:GeometricElement3d")!.getProperty("GeometryStream")!;
      const ca = await view.customAttributes.getPropertyCustomAttribute(prop, "CoreCustomAttributes.HiddenProperty");
      expect(ca).to.deep.equal({ className: "CoreCustomAttributes.HiddenProperty" });
    });

    it("returns a custom attribute with values", async () => {
      const cls = view.findClass("BisCore:ExternalSourceAspect")!;
      // Accepts either separator for the CA class full name.
      const ca = await view.customAttributes.getClassCustomAttribute(cls, "ECDbMap:DbIndexList");
      assert.isDefined(ca, "DbIndexList should be applied to ExternalSourceAspect");
      expect(normalizeClassName(ca!.className)).to.equal("ecdbmap.dbindexlist");
      expect(ca!.Indexes, "DbIndexList.Indexes should be a resolved array").to.be.an("array");
    });

    it("returns undefined for a custom attribute that is not applied", async () => {
      const cls = view.findClass("BisCore:ExternalSourceAspect")!;
      // ProductionStatus is a schema-level CA; it is not applied to this class.
      const ca = await view.customAttributes.getClassCustomAttribute(cls, "CoreCustomAttributes.ProductionStatus");
      expect(ca).to.be.undefined;
    });
  });

  describe("find containers with a custom attribute", () => {
    it("finds all properties carrying a custom attribute, with values", async () => {
      const matches = await collect(view.customAttributes.findPropertiesWithCustomAttribute("CoreCustomAttributes.HiddenProperty"));
      expect(matches.length, "HiddenProperty should be applied to several properties").to.be.greaterThan(0);

      // Each match carries the resolved CA value...
      for (const m of matches)
        expect(normalizeClassName(m.customAttribute!.className)).to.equal("corecustomattributes.hiddenproperty");

      // ...and a known anchor property is among the results.
      expect(matches.some((m) => m.schemaName === "BisCore" && m.className === "GeometricElement3d" && m.propertyName === "GeometryStream"))
        .to.equal(true, "expected BisCore:GeometricElement3d.GeometryStream among HiddenProperty matches");
    });

    it("identifiersOnly skips CA resolution but returns the same containers", async () => {
      const full = await collect(view.customAttributes.findPropertiesWithCustomAttribute("CoreCustomAttributes.HiddenProperty"));
      const idsOnly = await collect(view.customAttributes.findPropertiesWithCustomAttribute("CoreCustomAttributes.HiddenProperty", { identifiersOnly: true }));

      // No CA data resolved in identifiers-only mode.
      expect(idsOnly.every((m) => m.customAttribute === undefined)).to.equal(true);

      // Same set of container identifiers, regardless of mode.
      const key = (m: { schemaName: string, className: string, propertyName: string }) => `${m.schemaName}:${m.className}.${m.propertyName}`;
      expect(idsOnly.map(key).sort()).to.deep.equal(full.map(key).sort());
    });

    it("finds classes carrying a custom attribute", async () => {
      const matches = await collect(view.customAttributes.findClassesWithCustomAttribute("CoreCustomAttributes.HiddenClass"));
      expect(matches.some((m) => m.schemaName === "BisCore" && m.className === "ExternalSourceAspect"))
        .to.equal(true, "expected BisCore:ExternalSourceAspect among HiddenClass matches");
    });

    it("finds schemas carrying a custom attribute, resolvable against the view", async () => {
      const matches = await collect(view.customAttributes.findSchemasWithCustomAttribute("CoreCustomAttributes.ProductionStatus"));
      const bis = matches.find((m) => m.schemaName === "BisCore");
      assert.isDefined(bis, "BisCore should carry ProductionStatus");
      // eslint-disable-next-line @typescript-eslint/naming-convention
      expect(bis!.customAttribute).to.deep.equal({ className: "CoreCustomAttributes.ProductionStatus", SupportedUse: "Production" });

      // The returned name resolves directly against the SchemaView.
      assert.isDefined(view.getSchema(bis!.schemaName), "match.schemaName must resolve via view.getSchema");
    });

    it("returns nothing for a custom attribute that is applied nowhere", async () => {
      // HiddenProperty is a property-level CA; no class carries it, so the class walk is empty.
      const matches = await collect(view.customAttributes.findClassesWithCustomAttribute("CoreCustomAttributes.HiddenProperty"));
      expect(matches).to.deep.equal([]);
    });
  });
});

// ===== Expected anchor custom attributes (inlined; long-stable BisCore CAs) =====
//
// Canonical ECJSON form: `{ className: "Schema.Class", ...values }`. These mirror what the published
// BisCore.ecschema.json carries. They change only when BisCore deliberately changes these specific
// attributes, which is rare. If one drifts, update the literal here.
//
// CA property names mirror real ECSchema identifiers (PascalCase), so the EC naming is intentional.
/* eslint-disable @typescript-eslint/naming-convention */

const EXPECTED_SCHEMA_CAS: CustomAttribute[] = [
  { className: "CoreCustomAttributes.ProductionStatus", SupportedUse: "Production" },
  { className: "BisCore.SchemaHasBehavior" },
];

const EXPECTED_EXTERNAL_SOURCE_ASPECT_CAS: CustomAttribute[] = [
  {
    className: "ECDbMap.DbIndexList",
    Indexes: [
      {
        Name: "ix_bis_ExternalSourceAspect_Source",
        IsUnique: false,
        Properties: ["Scope.Id", "Identifier", "Kind"],
      },
      {
        Name: "ix_bis_ExternalSourceAspect_Identifier",
        IsUnique: false,
        Properties: ["Identifier"],
      },
    ],
  },
  { className: "CoreCustomAttributes.HiddenClass" },
];

const EXPECTED_GEOMETRY_STREAM_CAS: CustomAttribute[] = [
  { className: "CoreCustomAttributes.HiddenProperty" },
];

/* eslint-enable @typescript-eslint/naming-convention */

// ===== Helpers =====

/** Normalize a full class name for case-insensitive, separator-insensitive matching. */
function normalizeClassName(className: string): string {
  return className.replace(/:/g, ".").toLowerCase();
}

function findCa(cas: CustomAttribute[], className: string): CustomAttribute | undefined {
  const key = normalizeClassName(className);
  return cas.find((ca) => normalizeClassName(ca.className) === key);
}

/** Drain an async iterator into an array. */
async function collect<T>(iter: AsyncIterableIterator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter)
    out.push(item);
  return out;
}

/**
 * Assert that each expected anchor custom attribute is present in the sidecar output and deeply
 * equal to the expected value. Only the named anchors are compared, so unrelated additions or
 * changes elsewhere in BisCore do not make this brittle.
 */
function assertAnchorsMatch(sidecar: CustomAttribute[], expected: CustomAttribute[]): void {
  for (const expectedCa of expected) {
    const sideCa = findCa(sidecar, expectedCa.className);
    assert.isDefined(sideCa, `sidecar is missing expected CA '${expectedCa.className}'`);
    // className separator may differ (sidecar uses dots, but normalize defensively).
    expect({ ...sideCa, className: normalizeClassName(sideCa!.className) })
      .to.deep.equal({ ...expectedCa, className: normalizeClassName(expectedCa.className) }, `CA '${expectedCa.className}' does not match the expected canonical JSON`);
  }
}
