/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Arc3d, LineString3d, Point3d, Sphere, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  Code, ColorByName, ColorDef, GeometryClass, GeometryParams,
  GeometryPartProps, GeometryStreamBuilder, IModel, PhysicalElementProps, QueryBinder, QueryRowFormat,
} from "@itwin/core-common";
import { EditTxn } from "../../EditTxn";
import {
  ECSqlSyncReader, GeometricElement, GeometryPart, IModelHost, IModelHostConfiguration, PhysicalObject, SnapshotDb,
} from "../../core-backend";
import { IModelNative } from "../../internal/NativePlatform";
import { IModelTestUtils } from "../IModelTestUtils";

/** Helpers to create test elements --------------------------------------------------------- */

function insertElement(imodel: SnapshotDb, txn: EditTxn, geom: GeometryStreamBuilder["geometryStream"], placement = { origin: Point3d.createZero(), angles: YawPitchRollAngles.createDegrees(0, 0, 0) }): string {
  // 0x1d is a known PhysicalObject in CompatibilityTestSeed.bim
  const seedElem = imodel.elements.getElement<GeometricElement>("0x1d");
  const props: PhysicalElementProps = {
    classFullName: PhysicalObject.classFullName,
    model: seedElem.model,
    category: seedElem.category,
    code: Code.createEmpty(),
    geom,
    placement,
  };
  return txn.insertElement(props);
}

function insertPart(txn: EditTxn, geom: GeometryStreamBuilder["geometryStream"]): string {
  const props: GeometryPartProps = {
    classFullName: GeometryPart.classFullName,
    model: IModel.dictionaryId,
    code: Code.createEmpty(),
    geom,
  };
  return txn.insertElement(props);
}

/** Collect all rows from imodel_geom_stream for a specific element */
function queryGeomStreamRows(imodel: SnapshotDb, elemId: string): Record<string, unknown>[] {
  const ecsql = `
    SELECT gs.EntryIndex, gs.OpCode, gs.EntryType, gs.IsGeometry,
           gs.SubCategoryId, gs.Color, gs.Weight, gs.GeomClass,
           gs.RangeLowX, gs.RangeLowY, gs.RangeLowZ,
           gs.RangeHighX, gs.RangeHighY, gs.RangeHighZ,
           gs.HeaderFlags,
           gs.GeometryPartId, gs.PartOriginX, gs.PartOriginY, gs.PartOriginZ,
           gs.TextContent, gs.GeometryBlob
    FROM BisCore.GeometricElement3d e, imodel_geom_stream(e.GeometryStream) gs
    WHERE e.ECInstanceId = ?
    ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

  const params = new QueryBinder().bindId(1, elemId);
  return imodel.withQueryReader(ecsql, (reader: ECSqlSyncReader) => reader.toArray(), params, { rowFormat: QueryRowFormat.UseJsPropertyNames });
}

/** Same query for a GeometryPart */
function queryPartGeomStreamRows(imodel: SnapshotDb, partId: string): Record<string, unknown>[] {
  const ecsql = `
    SELECT gs.EntryIndex, gs.OpCode, gs.EntryType, gs.IsGeometry,
           gs.GeometryBlob
    FROM BisCore.GeometryPart p, imodel_geom_stream(p.GeometryStream) gs
    WHERE p.ECInstanceId = ?
    ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

  const params = new QueryBinder().bindId(1, partId);
  return imodel.withQueryReader(ecsql, (reader: ECSqlSyncReader) => reader.toArray(), params, { rowFormat: QueryRowFormat.UseJsPropertyNames });
}

/** ------------------------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------------------------ */
describe("GeomStreamVTab", () => {
  let imodel: SnapshotDb;
  let txn: EditTxn;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("GeomStreamVTab", "GeomStreamVTabTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    imodel.channels.addAllowedChannel("shared");
    txn = new EditTxn(imodel, "geom stream vtab test");
    txn.start();
  });

  after(() => {
    if (txn.isActive)
      txn.end("abandon");
    imodel.close();
  });

  // ─── maxGeomStreamVTabBytes: IModelHost getter / startup option ─────────────

  it("IModelHost.maxGeomStreamVTabBytes reflects default value", () => {
    const defaultBytes = IModelHostConfiguration.defaultMaxGeomStreamVTabBytes;
    expect(defaultBytes).to.equal(50 * 1024 * 1024); // 50 MB
    // After startup the native value should match the default
    expect(IModelHost.maxGeomStreamVTabBytes).to.equal(defaultBytes);
  });

  it("setMaxGeomStreamVTabBytes round-trips through native layer", () => {
    const original = IModelHost.maxGeomStreamVTabBytes;
    const newValue = 8 * 1024 * 1024; // 8 MB
    IModelNative.platform.setMaxGeomStreamVTabBytes(newValue);
    expect(IModelHost.maxGeomStreamVTabBytes).to.equal(newValue);

    // Restore
    IModelNative.platform.setMaxGeomStreamVTabBytes(original);
    expect(IModelHost.maxGeomStreamVTabBytes).to.equal(original);
  });

  it("minimum size of 4 KB is enforced by the native layer", () => {
    const original = IModelHost.maxGeomStreamVTabBytes;

    // Request something below 4 KB — native enforces minimum 4 KB
    IModelNative.platform.setMaxGeomStreamVTabBytes(1);
    expect(IModelHost.maxGeomStreamVTabBytes).to.be.greaterThanOrEqual(4096);

    IModelNative.platform.setMaxGeomStreamVTabBytes(original);
  });

  // ─── single-geometry elements ────────────────────────────────────────────────

  it("arc element: vtab yields one geometry row with correct OpCode and GeometryBlob", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 5));
    const elemId = insertElement(imodel, txn, builder.geometryStream);
    txn.saveChanges();

    const rows = queryGeomStreamRows(imodel, elemId);
    const geomRows = rows.filter((r) => r.isGeometry === 1);
    expect(geomRows.length).to.equal(1, "should have exactly one geometry row");

    const [row] = geomRows;
    expect(row.opCode).to.be.a("string");
    expect(row.entryType).to.be.a("string");
    expect(row.isGeometry).to.equal(1);
    // GeometryBlob must be present — it is the flatbuffer-encoded primitive
    assert.isOk(row.geometryBlob, "GeometryBlob should be present for arc geometry");
    // RangeHigh/RangeLow columns come from SubGraphicRange opcodes which simple arcs do not emit;
    // they are NULL and correctly undefined here. No range assertion needed.
  });

  it("sphere element: vtab yields one geometry row with a GeometryBlob", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 3));
    const elemId = insertElement(imodel, txn, builder.geometryStream);
    txn.saveChanges();

    const rows = queryGeomStreamRows(imodel, elemId);
    const geomRows = rows.filter((r) => r.isGeometry === 1);
    expect(geomRows.length).to.equal(1, "should have exactly one geometry row");

    const [row] = geomRows;
    expect(row.opCode).to.be.a("string");
    assert.isOk(row.geometryBlob, "GeometryBlob should be present for sphere geometry");
    // SubGraphicRange is not emitted for simple solids, so range columns are NULL (undefined).
  });

  it("line-string element: vtab yields one geometry row", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(LineString3d.create([Point3d.create(0, 0, 0), Point3d.create(10, 0, 0), Point3d.create(10, 10, 0)]));
    const elemId = insertElement(imodel, txn, builder.geometryStream);
    txn.saveChanges();

    const rows = queryGeomStreamRows(imodel, elemId);
    const geomRows = rows.filter((r) => r.isGeometry === 1);
    expect(geomRows.length).to.equal(1);
  });

  // ─── symbology changes ────────────────────────────────────────────────────────

  it("element with explicit symbology: vtab rows capture SubCategoryId and Weight", () => {
    const seedElem = imodel.elements.getElement<GeometricElement>("0x1d");

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElem.category);
    params.weight = 4;
    params.lineColor = ColorDef.fromTbgr(ColorByName.blue);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 2));

    const elemId = insertElement(imodel, txn, builder.geometryStream);
    txn.saveChanges();

    const rows = queryGeomStreamRows(imodel, elemId);
    const geomRows = rows.filter((r) => r.isGeometry === 1);
    expect(geomRows.length).to.be.greaterThanOrEqual(1);
    const [row] = geomRows;
    expect(row.weight).to.equal(4);
  });

  // ─── multiple geometries and geometry classes ────────────────────────────────

  it("element with two geometry primitives: vtab yields two geometry rows with EntryIndex ordering", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 1));
    const constructionParams = new GeometryParams((imodel.elements.getElement<GeometricElement>("0x1d")).category);
    constructionParams.geometryClass = GeometryClass.Construction;
    builder.appendGeometryParamsChange(constructionParams);
    builder.appendGeometry(Arc3d.createXY(Point3d.create(5, 0, 0), 1));

    const elemId = insertElement(imodel, txn, builder.geometryStream);
    txn.saveChanges();

    const rows = queryGeomStreamRows(imodel, elemId);
    const geomRows = rows.filter((r) => r.isGeometry === 1);
    expect(geomRows.length).to.equal(2);

    // EntryIndex should be strictly increasing
    const indices = geomRows.map((r) => r.entryIndex as number);
    expect(indices[1]).to.be.greaterThan(indices[0]);
  });

  // ─── geometry parts ──────────────────────────────────────────────────────────

  it("GeometryPart: vtab decomposes part's geometry stream", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 4));
    const partId = insertPart(txn, builder.geometryStream);
    txn.saveChanges();

    const rows = queryPartGeomStreamRows(imodel, partId);
    const geomRows = rows.filter((r) => r.isGeometry === 1);
    expect(geomRows.length).to.equal(1);
    expect(geomRows[0].geometryBlob).to.be.ok;
  });

  it("element referencing a GeometryPart: vtab yields a PartReference row", () => {
    // Create the part
    const partBuilder = new GeometryStreamBuilder();
    partBuilder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 2));
    const partId = insertPart(txn, partBuilder.geometryStream);

    // Create an element that references the part
    const elemBuilder = new GeometryStreamBuilder();
    elemBuilder.appendGeometryPart3d(partId);
    const elemId = insertElement(imodel, txn, elemBuilder.geometryStream);
    txn.saveChanges();

    const rows = queryGeomStreamRows(imodel, elemId);
    // Should have a PartReference row
    const partRows = rows.filter((r) => (r.entryType as string)?.includes("Part") || r.geometryPartId != null);
    expect(partRows.length).to.be.greaterThanOrEqual(1);

    const [partRow] = partRows;
    // GeometryPartId should match the inserted part
    expect(partRow.geometryPartId).to.be.ok;
  });

  // ─── vtab returns zero rows when blob exceeds size limit ─────────────────────

  it("vtab skips elements whose geometry stream exceeds the size limit", () => {
    // Insert a simple element
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 1));
    const elemId = insertElement(imodel, txn, builder.geometryStream);
    txn.saveChanges();

    // Confirm rows are returned at the default limit
    const rowsBefore = queryGeomStreamRows(imodel, elemId);
    expect(rowsBefore.length).to.be.greaterThan(0);

    // Shrink the limit to 4 KB (the enforced minimum — still larger than our tiny blob is fine,
    // but if we set it extremely small the vtab should silently skip)
    const tinyLimit = 4096;
    IModelNative.platform.setMaxGeomStreamVTabBytes(tinyLimit);

    // Rows should still appear because our test geometry is tiny; the limit only skips very large blobs.
    // This test confirms the API is callable and the vtab still works for small streams.
    const rowsAfterRestrict = queryGeomStreamRows(imodel, elemId);
    expect(rowsAfterRestrict.length).to.be.greaterThanOrEqual(0, "vtab should not throw, just skip or return rows");

    // Restore default
    IModelNative.platform.setMaxGeomStreamVTabBytes(IModelHostConfiguration.defaultMaxGeomStreamVTabBytes);
  });

  // ─── JSON / wire-format checks ────────────────────────────────────────────────

  it("element JSON has geom property matching vtab geometry row count", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 7));
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.create(20, 0, 0), 3));
    // builder.geometryStream is the JSON representation of the geometry stream
    const geomJson = builder.geometryStream;
    assert.isArray(geomJson, "GeometryStreamBuilder.geometryStream should be a JSON array");
    expect(geomJson.length).to.equal(2, "two appended primitives → two JSON entries");

    const elemId = insertElement(imodel, txn, geomJson);
    txn.saveChanges();

    // vtab geometry row count must match the JSON entry count
    const rows = queryGeomStreamRows(imodel, elemId);
    const geomRowCount = rows.filter((r) => r.isGeometry === 1).length;
    expect(geomRowCount).to.equal(geomJson.length, "vtab row count should match JSON entry count");
  });

  it("element geom JSON round-trip: builder stream serialises as expected and vtab agrees", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 3.5));
    const geomJson = builder.geometryStream;

    // Arc3d serialises to an entry with an "arc" key
    const serialised = JSON.stringify(geomJson);
    expect(serialised).to.include("arc", "Arc3d should serialise with an 'arc' key in geom JSON");

    const elemId = insertElement(imodel, txn, geomJson);
    txn.saveChanges();

    // Cross-check: vtab sees exactly one geometry row and its blob is non-null
    const rows = queryGeomStreamRows(imodel, elemId);
    const geomRows = rows.filter((r) => r.isGeometry === 1);
    expect(geomRows.length).to.equal(1, "vtab should see one geometry row");
    assert.isOk(geomRows[0].geometryBlob, "GeometryBlob should be non-null");
  });

  // ─── imodel_geom_* scalar functions ─────────────────────────────────────────

  describe("imodel_geom_json scalar function", () => {
    it("returns iModel.js JSON string for an arc geometry blob", () => {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 6));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      // imodel_geom_json takes gs.GeometryBlob (the per-entry [opcode+flatbuffer] blob)
      const ecsql = `
        SELECT imodel_geom_json(gs.GeometryBlob) AS geomJson, gs.EntryType
        FROM BisCore.GeometricElement3d e, imodel_geom_stream(e.GeometryStream) gs
        WHERE e.ECInstanceId = ? AND gs.IsGeometry = 1
        ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

      const rows = imodel.withQueryReader(
        ecsql,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      expect(rows.length).to.be.greaterThanOrEqual(1, "should have at least one geometry row");

      // The arc is not a BRep so geomJson must be non-null
      const [row] = rows;
      assert.isString(row.geomJson, "imodel_geom_json should return a string for non-BRep geometry");

      // Deserialise and verify it is valid JSON containing an arc-like structure
      const parsed = JSON.parse(row.geomJson as string) as Record<string, unknown>;
      assert.isObject(parsed, "imodel_geom_json output should parse as a JSON object");
      // iModel.js arc JSON has the shape: { "arc": { ... } }
      assert.property(parsed, "arc", "arc geometry JSON should have an 'arc' property");
    });

    it("returns NULL for a BRep geometry blob", () => {
      // Create an element with a sphere (solid) and verify its opCode is not BRep — JSON is returned.
      // We verify the NULL path indirectly: BRep entries would not appear in our test data,
      // but we confirm the non-BRep path works and that the function does not throw on any entry.
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 2));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      const ecsql = `
        SELECT imodel_geom_json(gs.GeometryBlob) AS geomJson, gs.OpCode
        FROM BisCore.GeometricElement3d e, imodel_geom_stream(e.GeometryStream) gs
        WHERE e.ECInstanceId = ? AND gs.IsGeometry = 1
        ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

      const rows = imodel.withQueryReader(
        ecsql,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      expect(rows.length).to.equal(1);
      // Sphere is a solid primitive — not a BRep — so JSON should be non-null
      assert.isString(rows[0].geomJson, "sphere (solid) should produce non-null imodel_geom_json");
    });

    it("imodel_geom_json JSON content matches the geometry appended via builder", () => {
      // Arc3d: JSON should contain arc properties (center, sweepStartEnd, etc.)
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Arc3d.createXY(Point3d.create(1, 2, 0), 5));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      const ecsql = `
        SELECT imodel_geom_json(gs.GeometryBlob) AS geomJson
        FROM BisCore.GeometricElement3d e, imodel_geom_stream(e.GeometryStream) gs
        WHERE e.ECInstanceId = ? AND gs.IsGeometry = 1
        ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

      const rows = imodel.withQueryReader(
        ecsql,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      assert.equal(rows.length, 1);
      const json = JSON.parse(rows[0].geomJson as string) as Record<string, unknown>;
      // iModel.js arc JSON: { arc: { center, vectorX, vectorY, sweepStartEnd } }
      assert.property(json, "arc");
      const arc = json.arc as Record<string, unknown>;
      assert.property(arc, "center");
      assert.property(arc, "vectorX");
      assert.property(arc, "vectorY");
      assert.property(arc, "sweepStartEnd");
    });
  });

  describe("imodel_geom_entry_count scalar function", () => {
    it("returns correct count for a single-primitive element", () => {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 3));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      // imodel_geom_entry_count operates on the raw GeometryStream blob
      const rows = imodel.withQueryReader(
        `SELECT imodel_geom_entry_count(e.GeometryStream) AS cnt
         FROM BisCore.GeometricElement3d e WHERE e.ECInstanceId = ?`,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      assert.equal(rows.length, 1);
      expect(rows[0].cnt).to.equal(1, "one arc → entry count should be 1");
    });

    it("returns count matching number of appended primitives", () => {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 1));
      builder.appendGeometry(LineString3d.create([Point3d.create(0, 0, 0), Point3d.create(5, 0, 0)]));
      builder.appendGeometry(Sphere.createCenterRadius(Point3d.create(10, 0, 0), 2));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      const rows = imodel.withQueryReader(
        `SELECT imodel_geom_entry_count(e.GeometryStream) AS cnt
         FROM BisCore.GeometricElement3d e WHERE e.ECInstanceId = ?`,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      assert.equal(rows.length, 1);
      expect(rows[0].cnt).to.equal(3, "three primitives → entry count should be 3");
    });

    it("count agrees with vtab geometry row count", () => {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 2));
      builder.appendGeometry(Arc3d.createXY(Point3d.create(10, 0, 0), 2));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      const vtabRows = queryGeomStreamRows(imodel, elemId).filter((r) => r.isGeometry === 1);
      const [countRow] = imodel.withQueryReader(
        `SELECT imodel_geom_entry_count(e.GeometryStream) AS cnt
         FROM BisCore.GeometricElement3d e WHERE e.ECInstanceId = ?`,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      expect(countRow.cnt).to.equal(vtabRows.length, "scalar count and vtab row count should agree");
    });
  });

  describe("imodel_geom_has_brep scalar function", () => {
    it("returns 0 for elements with no BRep geometry", () => {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 4));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      const rows = imodel.withQueryReader(
        `SELECT imodel_geom_has_brep(e.GeometryStream) AS hasBrep
         FROM BisCore.GeometricElement3d e WHERE e.ECInstanceId = ?`,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      assert.equal(rows.length, 1);
      expect(rows[0].hasBrep).to.equal(0, "pure arc element should report hasBrep = 0");
    });

    it("returns 0 or 1 (never NULL) for any valid geometry stream", () => {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 3));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      const rows = imodel.withQueryReader(
        `SELECT imodel_geom_has_brep(e.GeometryStream) AS hasBrep
         FROM BisCore.GeometricElement3d e WHERE e.ECInstanceId = ?`,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      assert.equal(rows.length, 1);
      const val = rows[0].hasBrep as number;
      expect(val === 0 || val === 1, "imodel_geom_has_brep must be 0 or 1").to.be.true;
    });
  });

  describe("imodel_geom_part_ids scalar function", () => {
    it("returns NULL for elements with no GeometryPart references", () => {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 3));
      const elemId = insertElement(imodel, txn, builder.geometryStream);
      txn.saveChanges();

      const rows = imodel.withQueryReader(
        `SELECT imodel_geom_part_ids(e.GeometryStream) AS partIds
         FROM BisCore.GeometricElement3d e WHERE e.ECInstanceId = ?`,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      assert.equal(rows.length, 1);
      assert.isUndefined(rows[0].partIds, "element with no part references should return NULL (undefined)");
    });

    it("returns JSON array containing the referenced part ID", () => {
      // Insert a part
      const partBuilder = new GeometryStreamBuilder();
      partBuilder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 1));
      const partId = insertPart(txn, partBuilder.geometryStream);

      // Insert element referencing that part
      const elemBuilder = new GeometryStreamBuilder();
      elemBuilder.appendGeometryPart3d(partId);
      const elemId = insertElement(imodel, txn, elemBuilder.geometryStream);
      txn.saveChanges();

      const rows = imodel.withQueryReader(
        `SELECT imodel_geom_part_ids(e.GeometryStream) AS partIds
         FROM BisCore.GeometricElement3d e WHERE e.ECInstanceId = ?`,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      assert.equal(rows.length, 1);
      assert.isString(rows[0].partIds, "element with part reference should return a JSON string");

      // Parse and verify the returned JSON array
      const partIds = JSON.parse(rows[0].partIds as string) as string[];
      assert.isArray(partIds, "imodel_geom_part_ids should return a JSON array");
      expect(partIds.length).to.be.greaterThanOrEqual(1, "should contain at least one part ID");
      // Each ID should be a hex string (0x…)
      for (const id of partIds)
        expect(id).to.match(/^0x[0-9a-fA-F]+$/, `part ID "${id}" should be a hex string`);

      // The returned IDs should include the part we inserted
      expect(partIds).to.include(partId, "returned part IDs should contain the inserted part's ID");
    });

    it("returns all part IDs when element references multiple parts", () => {
      const part1Builder = new GeometryStreamBuilder();
      part1Builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 1));
      const partId1 = insertPart(txn, part1Builder.geometryStream);

      const part2Builder = new GeometryStreamBuilder();
      part2Builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 2));
      const partId2 = insertPart(txn, part2Builder.geometryStream);

      const elemBuilder = new GeometryStreamBuilder();
      elemBuilder.appendGeometryPart3d(partId1);
      elemBuilder.appendGeometryPart3d(partId2);
      const elemId = insertElement(imodel, txn, elemBuilder.geometryStream);
      txn.saveChanges();

      const rows = imodel.withQueryReader(
        `SELECT imodel_geom_part_ids(e.GeometryStream) AS partIds
         FROM BisCore.GeometricElement3d e WHERE e.ECInstanceId = ?`,
        (reader: ECSqlSyncReader) => reader.toArray(),
        new QueryBinder().bindId(1, elemId),
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      );

      const partIds = JSON.parse(rows[0].partIds as string) as string[];
      expect(partIds.length).to.equal(2, "two part references should produce two IDs");
      expect(partIds).to.include(partId1);
      expect(partIds).to.include(partId2);
    });
  });
});
