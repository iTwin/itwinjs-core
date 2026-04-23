/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";
import { assert, expect } from "chai";
import { DrawingCategory } from "../../Category";
import { _nativeDb, BriefcaseDb, ChannelControl } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { ChangesetReader } from "../../ChangesetReader";
import * as path from "node:path";
import * as fs from "fs";
import { HubWrappers, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { ChangeUnifierCache, PartialChangeUnifier } from "../../PartialChangeUnifier";
import { ChangeInstance, PropertyFilter, RowFormatOptions } from "../../ChangesetReaderTypes";
import { EditTxn } from "../../EditTxn";

/* eslint-disable @typescript-eslint/naming-convention */ // disabling it because the property names are not in camelcase, and we want to test them as-is

/** Open a txn, drive the unifier, log and return all merged instances. */
function readTxn(
  db: BriefcaseDb,
  txnId: string,
  propFilter?: PropertyFilter,
  rowOptions?: RowFormatOptions,
  invert?: boolean,
  useInMemoryUnifierCache?: boolean,
): ChangeInstance[] {
  using reader = ChangesetReader.openTxn({ db, txnId, propFilter, rowOptions, invert });
  const inMemCache = useInMemoryUnifierCache ?? true;
  using pcu = new PartialChangeUnifier(inMemCache ? ChangeUnifierCache.createInMemoryCache() : ChangeUnifierCache.createSqliteBackedCache());
  while (reader.step())
    pcu.appendFrom(reader);
  const instances = Array.from(pcu.instances);
  return instances;
}

function startTestTxn(iModel: BriefcaseDb, description = "changeset reader"): EditTxn {
  const txn = new EditTxn(iModel, description);
  txn.start();
  return txn;
}

async function importSchemaStrings(txn: EditTxn, schemas: string[]): Promise<void> {
  if (txn.isActive)
    txn.saveChanges();
  await txn.iModel.importSchemaStrings(schemas);
}

describe("ChangesetReader insert-full", () => {
  let rwIModel: BriefcaseDb;
  let fullElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;
  let txn: EditTxn;

  before(async () => {
    HubMock.startup("ECChangesetInsertFull", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "insertFull", description: "insertFull", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "ChangesetReader insert-full setup");
    // Txn 1: import schema + drawing model setup, then push
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <!-- Rich struct: scalar fields + nested point2d/3d sub-properties -->
      <ECStructClass typeName="RichPoint" modifier="Sealed">
          <ECProperty propertyName="X"     typeName="double"/>
          <ECProperty propertyName="Y"     typeName="double"/>
          <ECProperty propertyName="Z"     typeName="double"/>
          <ECProperty propertyName="Label" typeName="string"/>
          <ECProperty propertyName="Pt2d"  typeName="point2d"/>
          <ECProperty propertyName="Pt3d"  typeName="point3d"/>
      </ECStructClass>
      <!-- Relationship used by the RelatedElem navigation property -->
      <ECRelationshipClass typeName="Test2dUsesElement" strength="referencing" modifier="None">
          <Source multiplicity="(0..*)" roleLabel="uses" polymorphic="true"><Class class="Test2dElement"/></Source>
          <Target multiplicity="(0..1)" roleLabel="is used by" polymorphic="true"><Class class="bis:Element"/></Target>
      </ECRelationshipClass>
      <ECEntityClass typeName="Test2dElement">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <!-- Primitives -->
          <ECProperty propertyName="StrProp"        typeName="string"/>
          <ECProperty propertyName="IntProp"        typeName="int"/>
          <ECProperty propertyName="LongProp"       typeName="long"/>
          <ECProperty propertyName="DblProp"        typeName="double"/>
          <ECProperty propertyName="BoolProp"       typeName="boolean"/>
          <ECProperty propertyName="DtProp"         typeName="dateTime"/>
          <ECProperty propertyName="BinProp"        typeName="binary"/>
          <!-- Geometric primitives -->
          <ECProperty propertyName="Pt2dProp"       typeName="point2d"/>
          <ECProperty propertyName="Pt3dProp"       typeName="point3d"/>
          <!-- Struct, arrays -->
          <ECStructProperty      propertyName="StructProp"    typeName="RichPoint"/>
          <ECArrayProperty       propertyName="IntArrProp"    typeName="int"       minOccurs="0" maxOccurs="unbounded"/>
          <ECArrayProperty       propertyName="StrArrProp"    typeName="string"    minOccurs="0" maxOccurs="unbounded"/>
          <ECStructArrayProperty propertyName="StructArrProp" typeName="RichPoint" minOccurs="0" maxOccurs="unbounded"/>
          <!-- Navigation property -->
          <ECNavigationProperty propertyName="RelatedElem" relationshipName="Test2dUsesElement" direction="forward"/>
      </ECEntityClass>
  </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(txn, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    txn.saveChanges("setup");

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Txn 2: insert FULL element  every EC primitive type populated
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const geom: GeometryStreamProps = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ].map((a) => IModelJson.Writer.toIModelJson(a));

    fullElementId = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom,
      StrProp: "hello",
      IntProp: 42,
      LongProp: 9_007_199_254_740_991,   // Number.MAX_SAFE_INTEGER
      DblProp: 3.14159265358979,
      BoolProp: true,
      DtProp: "2024-01-15T12:00:00.000",
      BinProp: new Uint8Array([1, 2, 3, 4]),
      Pt2dProp: { x: 1.5, y: 2.5 },
      Pt3dProp: { x: 3.0, y: 4.0, z: 5.0 },
      StructProp: {
        X: 1.0, Y: 2.0, Z: 3.0, Label: "origin",
        Pt2d: { x: 0.5, y: 0.5 },
        Pt3d: { x: 1.0, y: 2.0, z: 3.0 },
      },
      IntArrProp: [10, 20, 30],
      StrArrProp: ["alpha", "beta", "gamma"],
      StructArrProp: [
        { X: 0.0, Y: 1.0, Z: 2.0, Label: "a", Pt2d: { x: 0.0, y: 0.0 }, Pt3d: { x: 0.0, y: 0.0, z: 0.0 } },
        { X: 3.0, Y: 4.0, Z: 5.0, Label: "b", Pt2d: { x: 1.0, y: 1.0 }, Pt3d: { x: 1.0, y: 1.0, z: 1.0 } },
      ],
      RelatedElem: { id: drawingCategoryId, relClassName: "TestDomain:Test2dUsesElement" },
    } as any);
    txn.saveChanges("insert full element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("txn1 insert-full | All_Properties | default rowOptions", () => {
    const instances = readTxn(rwIModel, txnId);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    // Object.keys
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.deepEqual([...modelNew!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.deepEqual([...modelNew!.$meta.changeIndexes].sort(), [3].sort());
    assert.isString(modelNew!.$meta.instanceKey);
    assert.equal(modelNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    // Object.keys
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.deepEqual([...modelOld!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isString(elem!.LastMod);
    assert.equal(elem!.CodeSpec.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeSpec.RelECClassId), "BisCore:CodeSpecSpecifiesCode");

    assert.equal(elem!.CodeScope.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeScope.RelECClassId), "BisCore:ElementScopesCode");
    assert.isString(elem!.FederationGuid);

    assert.equal(elem!.Category.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Category.RelECClassId), "BisCore:GeometricElement2dIsInCategory");
    assert.deepEqual(elem!.Origin, { X: 0, Y: 0 });
    assert.equal(elem!.Rotation, 0);
    assert.deepEqual(elem!.BBoxLow, { X: -25, Y: -25 });
    assert.deepEqual(elem!.BBoxHigh, { X: 15, Y: 15 });
    assert.include(String(elem!.GeometryStream), "\"bytes\"");
    assert.include(String(elem!.BinProp), "\"bytes\"");
    assert.equal(elem!.StrProp, "hello");
    assert.equal(elem!.IntProp, 42);
    assert.equal(elem!.LongProp, 9007199254740991);
    assert.closeTo(elem!.DblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elem!.BoolProp, true);
    assert.equal(elem!.DtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elem!.Pt2dProp, { X: 1.5, Y: 2.5 });
    assert.deepEqual(elem!.Pt3dProp, { X: 3, Y: 4, Z: 5 });
    assert.deepEqual(elem!.StructProp, { X: 1, Y: 2, Z: 3, Label: "origin", Pt2d: { X: 0.5, Y: 0.5 }, Pt3d: { X: 1, Y: 2, Z: 3 } });
    assert.deepEqual(elem!.IntArrProp, [10, 20, 30]);
    assert.deepEqual(elem!.StrArrProp, ["alpha", "beta", "gamma"]);
    assert.deepEqual(elem!.StructArrProp, [
      { X: 0, Y: 1, Z: 2, Label: "a", Pt2d: { X: 0, Y: 0 }, Pt3d: { X: 0, Y: 0, Z: 0 } },
      { X: 3, Y: 4, Z: 5, Label: "b", Pt2d: { X: 1, Y: 1 }, Pt3d: { X: 1, Y: 1, Z: 1 } },
    ]);
    assert.equal(elem!.RelatedElem.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.RelatedElem.RelECClassId), "TestDomain:Test2dUsesElement");
    // Object.keys
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem", "BinProp"
    ].sort());
    // $meta keys
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), [
      'BBoxHigh', 'BBoxLow', 'BinProp', 'BoolProp', 'Category.Id', 'CodeScope.Id',
      'CodeSpec.Id', 'CodeValue', 'DblProp', 'DtProp', 'ECClassId', 'ECInstanceId',
      'FederationGuid', 'GeometryStream', 'IntArrProp', 'IntProp', 'JsonProperties',
      'LastMod', 'LongProp', 'Model.Id', 'Origin', 'Parent', 'Pt2dProp', 'Pt3dProp',
      'RelatedElem', 'Rotation', 'StrArrProp', 'StrProp', 'StructArrProp', 'StructProp.Label',
      'StructProp.Pt2d', 'StructProp.Pt3d', 'StructProp.X', 'StructProp.Y', 'StructProp.Z',
      'TypeDefinition', 'UserLabel'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 insert-full | All_Properties | default rowOptions | invert", () => {
    const instances = readTxn(rwIModel, txnId, undefined, undefined, true);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.isUndefined(modelNew!.LastMod);
    assert.isUndefined(modelNew!.GeometryGuid);
    // Object.keys
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.deepEqual([...modelNew!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.deepEqual([...modelNew!.$meta.changeIndexes].sort(), [3].sort());
    assert.isString(modelNew!.$meta.instanceKey);
    assert.equal(modelNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.isString(modelOld!.LastMod);
    assert.isString(modelOld!.GeometryGuid);
    // Object.keys
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta", "LastMod", "GeometryGuid"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.deepEqual([...modelOld!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isString(elem!.LastMod);
    assert.equal(elem!.CodeSpec.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeSpec.RelECClassId), "BisCore:CodeSpecSpecifiesCode");

    assert.equal(elem!.CodeScope.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeScope.RelECClassId), "BisCore:ElementScopesCode");
    assert.isString(elem!.FederationGuid);

    assert.equal(elem!.Category.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Category.RelECClassId), "BisCore:GeometricElement2dIsInCategory");
    assert.deepEqual(elem!.Origin, { X: 0, Y: 0 });
    assert.equal(elem!.Rotation, 0);
    assert.deepEqual(elem!.BBoxLow, { X: -25, Y: -25 });
    assert.deepEqual(elem!.BBoxHigh, { X: 15, Y: 15 });
    assert.include(String(elem!.GeometryStream), "\"bytes\"");
    assert.include(String(elem!.BinProp), "\"bytes\"");
    assert.equal(elem!.StrProp, "hello");
    assert.equal(elem!.IntProp, 42);
    assert.equal(elem!.LongProp, 9007199254740991);
    assert.closeTo(elem!.DblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elem!.BoolProp, true);
    assert.equal(elem!.DtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elem!.Pt2dProp, { X: 1.5, Y: 2.5 });
    assert.deepEqual(elem!.Pt3dProp, { X: 3, Y: 4, Z: 5 });
    assert.deepEqual(elem!.StructProp, { X: 1, Y: 2, Z: 3, Label: "origin", Pt2d: { X: 0.5, Y: 0.5 }, Pt3d: { X: 1, Y: 2, Z: 3 } });
    assert.deepEqual(elem!.IntArrProp, [10, 20, 30]);
    assert.deepEqual(elem!.StrArrProp, ["alpha", "beta", "gamma"]);
    assert.deepEqual(elem!.StructArrProp, [
      { X: 0, Y: 1, Z: 2, Label: "a", Pt2d: { X: 0, Y: 0 }, Pt3d: { X: 0, Y: 0, Z: 0 } },
      { X: 3, Y: 4, Z: 5, Label: "b", Pt2d: { X: 1, Y: 1 }, Pt3d: { X: 1, Y: 1, Z: 1 } },
    ]);
    assert.equal(elem!.RelatedElem.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.RelatedElem.RelECClassId), "TestDomain:Test2dUsesElement");
    // Object.keys
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem", "BinProp"
    ].sort());
    // $meta keys
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), [
      'BBoxHigh', 'BBoxLow', 'BinProp', 'BoolProp', 'Category.Id', 'CodeScope.Id',
      'CodeSpec.Id', 'CodeValue', 'DblProp', 'DtProp', 'ECClassId', 'ECInstanceId',
      'FederationGuid', 'GeometryStream', 'IntArrProp', 'IntProp', 'JsonProperties',
      'LastMod', 'LongProp', 'Model.Id', 'Origin', 'Parent', 'Pt2dProp', 'Pt3dProp',
      'RelatedElem', 'Rotation', 'StrArrProp', 'StrProp', 'StructArrProp', 'StructProp.Label',
      'StructProp.Pt2d', 'StructProp.Pt3d', 'StructProp.X', 'StructProp.Y', 'StructProp.Z',
      'TypeDefinition', 'UserLabel'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 insert-full | Bis_Element_Properties", () => {
    const instances = readTxn(rwIModel, txnId, PropertyFilter.BisCoreElement, { classIdsToClassNames: true });
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "BisCore.DrawingModel");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Inserted New (Bis_Element_Properties: no custom props) ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal(elem!.ECClassId, "TestDomain.Test2dElement");
    // No custom domain props
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.IntProp);
    assert.isUndefined(elem!.LongProp);
    assert.isUndefined(elem!.DblProp);
    assert.isUndefined(elem!.BoolProp);
    assert.isUndefined(elem!.DtProp);
    assert.isUndefined(elem!.Pt2dProp);
    assert.isUndefined(elem!.Pt3dProp);
    assert.isUndefined(elem!.StructProp);
    assert.isUndefined(elem!.IntArrProp);
    assert.isUndefined(elem!.StrArrProp);
    assert.isUndefined(elem!.StructArrProp);
    assert.isUndefined(elem!.RelatedElem);
    expect(elem!.Model).to.exist;
    expect(elem!.CodeScope).to.exist;
    expect(elem!.CodeSpec).to.exist;
    expect(elem!.FederationGuid).to.exist;
    expect(elem!.LastMod).to.exist;
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta", "CodeScope", "CodeSpec", "FederationGuid", "LastMod", "Model"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "ECClassId", "CodeScope.Id", "CodeSpec.Id",
      "CodeValue", "FederationGuid", "JsonProperties", "LastMod", "Model.Id", "Parent", "UserLabel"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 insert-full | Instance_Key", () => {
    const instances = readTxn(rwIModel, txnId, PropertyFilter.InstanceKey);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.deepEqual([...modelNew!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.deepEqual([...modelNew!.$meta.changeIndexes].sort(), [3].sort());
    assert.isString(modelNew!.$meta.instanceKey);
    assert.equal(modelNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Inserted New (only ECInstanceId + ECClassId) ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.Model);
    assert.isUndefined(elem!.Category);
    assert.isUndefined(elem!.LastMod);
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "ECClassId"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 | rowOptions: classIdsToClassNames", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true });
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New (ECClassId is now class name) ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "BisCore.DrawingModel");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelOld!.$meta.isIndirectChange, true);


    // --- instances[2]: Test2dElement Inserted New (ECClassId + all RelECClassId = class names) ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal("TestDomain.Test2dElement", elem!.ECClassId);
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "BisCore.ModelContainsElements" });
    assert.isString(elem!.LastMod);
    assert.deepEqual(elem!.CodeSpec, { Id: "0x1", RelECClassId: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.CodeScope, { Id: "0x1", RelECClassId: "BisCore.ElementScopesCode" });
    assert.isString(elem!.FederationGuid);
    assert.deepEqual(elem!.Category, { Id: drawingCategoryId, RelECClassId: "BisCore.GeometricElement2dIsInCategory" });
    assert.deepEqual(elem!.Origin, { X: 0, Y: 0 });
    assert.equal(elem!.Rotation, 0);
    assert.deepEqual(elem!.BBoxLow, { X: -25, Y: -25 });
    assert.deepEqual(elem!.BBoxHigh, { X: 15, Y: 15 });
    assert.include(String(elem!.GeometryStream), "\"bytes\"");
    assert.include(String(elem!.BinProp), "\"bytes\"");
    assert.equal(elem!.StrProp, "hello");
    assert.equal(elem!.IntProp, 42);
    assert.equal(elem!.LongProp, 9007199254740991);
    assert.closeTo(elem!.DblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elem!.BoolProp, true);
    assert.equal(elem!.DtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elem!.Pt2dProp, { X: 1.5, Y: 2.5 });
    assert.deepEqual(elem!.Pt3dProp, { X: 3, Y: 4, Z: 5 });
    assert.deepEqual(elem!.StructProp, { X: 1, Y: 2, Z: 3, Label: "origin", Pt2d: { X: 0.5, Y: 0.5 }, Pt3d: { X: 1, Y: 2, Z: 3 } });
    assert.deepEqual(elem!.IntArrProp, [10, 20, 30]);
    assert.deepEqual(elem!.StrArrProp, ["alpha", "beta", "gamma"]);
    assert.equal(elem!.StructArrProp.length, 2);
    assert.deepEqual(elem!.RelatedElem, { Id: drawingCategoryId, RelECClassId: "TestDomain.Test2dUsesElement" });
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem", "BinProp"
    ].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(),
      ["ECInstanceId", "ECClassId", "Model.Id", "LastMod", "CodeSpec.Id", "CodeScope.Id",
        "CodeValue", "UserLabel", "Parent", "FederationGuid", "JsonProperties", "Category.Id",
        "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream", "TypeDefinition", "StrProp",
        "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp", "BinProp", "Pt2dProp", "Pt3dProp",
        "StructProp.X", "StructProp.Y", "StructProp.Z", "StructProp.Label", "StructProp.Pt2d",
        "StructProp.Pt3d", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem"].sort());
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 | rowOptions: useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { useJsName: true });
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New (all keys camelCase) ---
    const modelNew = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.id, drawingModelId);
    assert.equal(modelNew!.className, "BisCore.DrawingModel");
    assert.isString(modelNew!.lastMod);
    assert.isString(modelNew!.geometryGuid);
    assert.isUndefined(modelNew!.ECInstanceId);
    assert.isUndefined(modelNew!.ECClassId);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["id", "className", "lastMod", "geometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { useJsName: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.id, drawingModelId);
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelOld!.ECInstanceId);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["id", "className", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { useJsName: true });
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Inserted New (camelCase keys + class names for nav) ---
    const elem = instances.find((i) => i.id === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.id, fullElementId);
    assert.equal(elem!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elem!.ECInstanceId);
    assert.isUndefined(elem!.ECClassId);
    assert.isUndefined(elem!.StrProp);
    assert.deepEqual(elem!.model, { id: drawingModelId, relClassName: "BisCore.ModelContainsElements" });
    assert.isString(elem!.lastMod);
    assert.deepEqual(elem!.codeSpec, { id: "0x1", relClassName: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.codeScope, { id: "0x1", relClassName: "BisCore.ElementScopesCode" });
    assert.isString(elem!.federationGuid);
    assert.deepEqual(elem!.category, { id: drawingCategoryId, relClassName: "BisCore.GeometricElement2dIsInCategory" });
    assert.deepEqual(elem!.origin, { x: 0, y: 0 });
    assert.equal(elem!.rotation, 0);
    assert.deepEqual(elem!.bBoxLow, { x: -25, y: -25 });
    assert.deepEqual(elem!.bBoxHigh, { x: 15, y: 15 });
    assert.include(String(elem!.geometryStream), "\"bytes\"");
    assert.include(String(elem!.binProp), "\"bytes\"");
    assert.equal(elem!.strProp, "hello");
    assert.equal(elem!.intProp, 42);
    assert.equal(elem!.longProp, 9007199254740991);
    assert.closeTo(elem!.dblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elem!.boolProp, true);
    assert.equal(elem!.dtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elem!.pt2dProp, { x: 1.5, y: 2.5 });
    assert.deepEqual(elem!.pt3dProp, { x: 3, y: 4, z: 5 });
    assert.deepEqual(elem!.structProp, { x: 1, y: 2, z: 3, label: "origin", pt2d: { x: 0.5, y: 0.5 }, pt3d: { x: 1, y: 2, z: 3 } });
    assert.deepEqual(elem!.intArrProp, [10, 20, 30]);
    assert.deepEqual(elem!.strArrProp, ["alpha", "beta", "gamma"]);
    assert.equal(elem!.structArrProp.length, 2);
    assert.deepEqual(elem!.structArrProp[0], { x: 0, y: 1, z: 2, label: "a", pt2d: { x: 0, y: 0 }, pt3d: { x: 0, y: 0, z: 0 } });
    assert.deepEqual(elem!.relatedElem, { id: drawingCategoryId, relClassName: "TestDomain.Test2dUsesElement" });
    assert.deepEqual(Object.keys(elem!).sort(), [
      "id", "className", "model", "lastMod", "codeSpec", "codeScope", "federationGuid", "$meta",
      "category", "origin", "rotation", "bBoxLow", "bBoxHigh", "geometryStream",
      "strProp", "intProp", "longProp", "dblProp", "boolProp", "dtProp",
      "pt2dProp", "pt3dProp", "structProp", "intArrProp", "strArrProp", "structArrProp", "relatedElem", "binProp"
    ].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), [
      'BBoxHigh', 'BBoxLow', 'BinProp', 'BoolProp', 'Category.Id', 'CodeScope.Id',
      'CodeSpec.Id', 'CodeValue', 'DblProp', 'DtProp', 'ECClassId',
      'ECInstanceId', 'FederationGuid', 'GeometryStream', 'IntArrProp', 'IntProp',
      'JsonProperties', 'LastMod', 'LongProp', 'Model.Id', 'Origin', 'Parent', 'Pt2dProp',
      'Pt3dProp', 'RelatedElem', 'Rotation', 'StrArrProp', 'StrProp', 'StructArrProp', 'StructProp.Label',
      'StructProp.Pt2d', 'StructProp.Pt3d', 'StructProp.X', 'StructProp.Y',
      'StructProp.Z', 'TypeDefinition', 'UserLabel'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, { useJsName: true });
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 | rowOptions: abbreviateBlobs", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: true });
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId)); // still raw hex
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: true });
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId)); // still raw hex (no classIdsToClassNames)
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isString(elem!.LastMod);
    assert.equal(elem!.CodeSpec.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeSpec.RelECClassId), "BisCore:CodeSpecSpecifiesCode");

    assert.equal(elem!.CodeScope.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeScope.RelECClassId), "BisCore:ElementScopesCode");
    assert.isString(elem!.FederationGuid);
    assert.equal(elem!.Category.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Category.RelECClassId), "BisCore:GeometricElement2dIsInCategory");
    assert.deepEqual(elem!.Origin, { X: 0, Y: 0 });
    assert.equal(elem!.Rotation, 0);
    assert.deepEqual(elem!.BBoxLow, { X: -25, Y: -25 });
    assert.deepEqual(elem!.BBoxHigh, { X: 15, Y: 15 });
    // GeometryStream is a blob — abbreviated to {"bytes": N}
    assert.include(String(elem!.GeometryStream), "\"bytes\"");
    assert.include(String(elem!.BinProp), "\"bytes\"");
    assert.equal(elem!.StrProp, "hello");
    assert.equal(elem!.IntProp, 42);
    assert.equal(elem!.LongProp, 9007199254740991);
    assert.closeTo(elem!.DblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elem!.BoolProp, true);
    assert.equal(elem!.DtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elem!.Pt2dProp, { X: 1.5, Y: 2.5 });
    assert.deepEqual(elem!.Pt3dProp, { X: 3, Y: 4, Z: 5 });
    assert.deepEqual(elem!.StructProp, { X: 1, Y: 2, Z: 3, Label: "origin", Pt2d: { X: 0.5, Y: 0.5 }, Pt3d: { X: 1, Y: 2, Z: 3 } });
    assert.deepEqual(elem!.IntArrProp, [10, 20, 30]);
    assert.deepEqual(elem!.StrArrProp, ["alpha", "beta", "gamma"]);
    assert.equal(elem!.StructArrProp.length, 2);
    assert.equal(elem!.RelatedElem.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.RelatedElem.RelECClassId), "TestDomain:Test2dUsesElement");
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem", "BinProp"
    ].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { abbreviateBlobs: true });
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 | rowOptions: abbreviateBlobs: false", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: false }, undefined, false);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId)); // still raw hex
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: false });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: false });
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId)); // still raw hex (no classIdsToClassNames)
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isString(elem!.LastMod);
    assert.equal(elem!.CodeSpec.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeSpec.RelECClassId), "BisCore:CodeSpecSpecifiesCode");

    assert.equal(elem!.CodeScope.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeScope.RelECClassId), "BisCore:ElementScopesCode");
    assert.isString(elem!.FederationGuid);
    assert.equal(elem!.Category.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Category.RelECClassId), "BisCore:GeometricElement2dIsInCategory");
    assert.deepEqual(elem!.Origin, { X: 0, Y: 0 });
    assert.equal(elem!.Rotation, 0);
    assert.deepEqual(elem!.BBoxLow, { X: -25, Y: -25 });
    assert.deepEqual(elem!.BBoxHigh, { X: 15, Y: 15 });
    // GeometryStream is a blob — abbreviated to {"bytes": N}
    assert.deepEqual(elem!.GeometryStream, new Uint8Array([
      1, 0, 0, 0, 8, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
      7, 0, 0, 0, 112, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0,
      16, 0, 88, 0, 8, 0, 32, 0, 56, 0, 0, 0, 80, 0, 7, 0,
      16, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 20, 64, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 20, 64, 0, 0, 0, 0, 0, 0, 0, 0,
      24, 45, 68, 84, 251, 33, 25, 64, 7, 0, 0, 0, 112, 0, 0, 0,
      24, 0, 0, 0, 0, 0, 0, 0, 16, 0, 88, 0, 8, 0, 32, 0,
      56, 0, 0, 0, 80, 0, 7, 0, 16, 0, 0, 0, 0, 0, 0, 1,
      0, 0, 0, 0, 0, 0, 20, 64, 0, 0, 0, 0, 0, 0, 20, 64,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64,
      0, 0, 0, 0, 0, 0, 0, 0, 24, 45, 68, 84, 251, 33, 25, 64,
      7, 0, 0, 0, 112, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0,
      16, 0, 88, 0, 8, 0, 32, 0, 56, 0, 0, 0, 80, 0, 7, 0,
      16, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 20, 192,
      0, 0, 0, 0, 0, 0, 20, 192, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 52, 64, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 52, 64, 0, 0, 0, 0, 0, 0, 0, 0,
      24, 45, 68, 84, 251, 33, 25, 64
    ]));
    assert.deepEqual(elem!.BinProp, new Uint8Array([1, 2, 3, 4]));
    assert.equal(elem!.StrProp, "hello");
    assert.equal(elem!.IntProp, 42);
    assert.equal(elem!.LongProp, 9007199254740991);
    assert.closeTo(elem!.DblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elem!.BoolProp, true);
    assert.equal(elem!.DtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elem!.Pt2dProp, { X: 1.5, Y: 2.5 });
    assert.deepEqual(elem!.Pt3dProp, { X: 3, Y: 4, Z: 5 });
    assert.deepEqual(elem!.StructProp, { X: 1, Y: 2, Z: 3, Label: "origin", Pt2d: { X: 0.5, Y: 0.5 }, Pt3d: { X: 1, Y: 2, Z: 3 } });
    assert.deepEqual(elem!.IntArrProp, [10, 20, 30]);
    assert.deepEqual(elem!.StrArrProp, ["alpha", "beta", "gamma"]);
    assert.equal(elem!.StructArrProp.length, 2);
    assert.equal(elem!.RelatedElem.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.RelatedElem.RelECClassId), "TestDomain:Test2dUsesElement");
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem", "BinProp"
    ].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { abbreviateBlobs: false });
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 | rowOptions: classIdsToClassNames + useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true, useJsName: true }, undefined, false);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.id, drawingModelId);
    assert.equal(modelNew!.className, "BisCore.DrawingModel");
    assert.isString(modelNew!.lastMod);
    assert.isString(modelNew!.geometryGuid);
    assert.isUndefined(modelNew!.ECInstanceId);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["id", "className", "lastMod", "geometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.id, drawingModelId);
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelOld!.ECInstanceId);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["id", "className", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Inserted New (camelCase + class names) ---
    const elem = instances.find((i) => i.id === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.id, fullElementId);
    assert.equal(elem!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elem!.ECInstanceId);
    assert.isUndefined(elem!.ECClassId);
    assert.isUndefined(elem!.StrProp);
    assert.deepEqual(elem!.model, { id: drawingModelId, relClassName: "BisCore.ModelContainsElements" });
    assert.isString(elem!.lastMod);
    assert.deepEqual(elem!.codeSpec, { id: "0x1", relClassName: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.codeScope, { id: "0x1", relClassName: "BisCore.ElementScopesCode" });
    assert.isString(elem!.federationGuid);
    assert.deepEqual(elem!.category, { id: drawingCategoryId, relClassName: "BisCore.GeometricElement2dIsInCategory" });
    assert.deepEqual(elem!.origin, { x: 0, y: 0 });
    assert.equal(elem!.rotation, 0);
    assert.deepEqual(elem!.bBoxLow, { x: -25, y: -25 });
    assert.deepEqual(elem!.bBoxHigh, { x: 15, y: 15 });
    assert.include(String(elem!.geometryStream), "\"bytes\"");
    assert.include(String(elem!.binProp), "\"bytes\"");
    assert.equal(elem!.strProp, "hello");
    assert.equal(elem!.intProp, 42);
    assert.equal(elem!.longProp, 9007199254740991);
    assert.closeTo(elem!.dblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elem!.boolProp, true);
    assert.equal(elem!.dtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elem!.pt2dProp, { x: 1.5, y: 2.5 });
    assert.deepEqual(elem!.pt3dProp, { x: 3, y: 4, z: 5 });
    assert.deepEqual(elem!.structProp, { x: 1, y: 2, z: 3, label: "origin", pt2d: { x: 0.5, y: 0.5 }, pt3d: { x: 1, y: 2, z: 3 } });
    assert.deepEqual(elem!.intArrProp, [10, 20, 30]);
    assert.deepEqual(elem!.strArrProp, ["alpha", "beta", "gamma"]);
    assert.equal(elem!.structArrProp.length, 2);
    assert.deepEqual(elem!.relatedElem, { id: drawingCategoryId, relClassName: "TestDomain.Test2dUsesElement" });
    assert.deepEqual(Object.keys(elem!).sort(), [
      "id", "className", "model", "lastMod", "codeSpec", "codeScope", "federationGuid", "$meta",
      "category", "origin", "rotation", "bBoxLow", "bBoxHigh", "geometryStream",
      "strProp", "intProp", "longProp", "dblProp", "boolProp", "dtProp",
      "pt2dProp", "pt3dProp", "structProp", "intArrProp", "strArrProp", "structArrProp", "relatedElem", "binProp"
    ].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), [
      'BBoxHigh', 'BBoxLow', 'BinProp', 'BoolProp', 'Category.Id',
      'CodeScope.Id', 'CodeSpec.Id',
      'CodeValue', 'DblProp', 'DtProp',
      'ECClassId', 'ECInstanceId', 'FederationGuid',
      'GeometryStream', 'IntArrProp', 'IntProp',
      'JsonProperties', 'LastMod', 'LongProp',
      'Model.Id', 'Origin', 'Parent', 'Pt2dProp', 'Pt3dProp', 'RelatedElem', 'Rotation', 'StrArrProp',
      'StrProp', 'StructArrProp', 'StructProp.Label', 'StructProp.Pt2d', 'StructProp.Pt3d',
      'StructProp.X', 'StructProp.Y', 'StructProp.Z', 'TypeDefinition', 'UserLabel'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 insert-full | All_Properties | inMemoryCache vs sqliteBackedCache", () => {
    const inMemoryInstances = readTxn(rwIModel, txnId);
    const sqliteBackedInstances = readTxn(rwIModel, txnId, undefined, undefined, undefined, false);
    assert.equal(inMemoryInstances.length, 3);
    assert.equal(sqliteBackedInstances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const inMemoryModelNew = inMemoryInstances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    const sqliteBackedModelNew = sqliteBackedInstances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(inMemoryModelNew).to.exist;
    expect(sqliteBackedModelNew).to.exist;
    assert.equal(inMemoryModelNew!.ECInstanceId, sqliteBackedModelNew!.ECInstanceId);
    assert.equal(sqliteBackedModelNew!.ECClassId, inMemoryModelNew!.ECClassId);
    assert.equal(inMemoryModelNew!.LastMod, sqliteBackedModelNew!.LastMod);
    assert.equal(inMemoryModelNew!.GeometryGuid, sqliteBackedModelNew!.GeometryGuid);
    // Object.keys
    assert.deepEqual(Object.keys(inMemoryModelNew!).sort(), Object.keys(sqliteBackedModelNew!).sort());
    // $meta keys
    assert.deepEqual(Object.keys(inMemoryModelNew!.$meta).sort(), Object.keys(sqliteBackedModelNew!.$meta).sort());
    assert.equal(inMemoryModelNew!.$meta.op, sqliteBackedModelNew!.$meta.op);
    assert.equal(inMemoryModelNew!.$meta.stage, sqliteBackedModelNew!.$meta.stage);
    assert.deepEqual([...inMemoryModelNew!.$meta.tables].sort(), [...sqliteBackedModelNew!.$meta.tables].sort());
    assert.deepEqual([...inMemoryModelNew!.$meta.changeIndexes].sort(), [...sqliteBackedModelNew!.$meta.changeIndexes].sort());
    assert.isString(inMemoryModelNew!.$meta.instanceKey);
    assert.equal(inMemoryModelNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(inMemoryModelNew!.$meta.propFilter, sqliteBackedModelNew!.$meta.propFilter);
    assert.deepEqual([...inMemoryModelNew!.$meta.changeFetchedPropNames].sort(), [...sqliteBackedModelNew!.$meta.changeFetchedPropNames].sort());
    assert.deepEqual(inMemoryModelNew!.$meta.rowOptions, sqliteBackedModelNew!.$meta.rowOptions);
    assert.equal(inMemoryModelNew!.$meta.isIndirectChange, sqliteBackedModelNew!.$meta.isIndirectChange);

    // --- instances[1]: DrawingModel Updated Old ---
    const inMemoryModelOld = inMemoryInstances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    const sqliteBackedModelOld = sqliteBackedInstances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(inMemoryModelOld).to.exist;
    expect(sqliteBackedModelOld).to.exist;
    assert.equal(inMemoryModelOld!.ECInstanceId, sqliteBackedModelOld!.ECInstanceId);
    assert.equal(sqliteBackedModelOld!.ECClassId, inMemoryModelOld!.ECClassId);
    // Object.keys
    assert.deepEqual(Object.keys(inMemoryModelOld!).sort(), Object.keys(sqliteBackedModelOld!).sort());
    // $meta keys
    assert.deepEqual(Object.keys(inMemoryModelOld!.$meta).sort(), Object.keys(sqliteBackedModelOld!.$meta).sort());
    assert.equal(inMemoryModelOld!.$meta.op, sqliteBackedModelOld!.$meta.op);
    assert.equal(inMemoryModelOld!.$meta.stage, sqliteBackedModelOld!.$meta.stage);
    assert.deepEqual([...inMemoryModelOld!.$meta.tables].sort(), [...sqliteBackedModelOld!.$meta.tables].sort());
    assert.equal(inMemoryModelOld!.$meta.propFilter, sqliteBackedModelOld!.$meta.propFilter);
    assert.deepEqual([...inMemoryModelOld!.$meta.changeFetchedPropNames].sort(), [...sqliteBackedModelOld!.$meta.changeFetchedPropNames].sort());
    assert.deepEqual(inMemoryModelOld!.$meta.rowOptions, sqliteBackedModelOld!.$meta.rowOptions);
    assert.equal(inMemoryModelOld!.$meta.isIndirectChange, sqliteBackedModelOld!.$meta.isIndirectChange);

    // --- instances[2]: Test2dElement Inserted New ---
    const inMemoryElem = inMemoryInstances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    const sqliteBackedElem = sqliteBackedInstances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(inMemoryElem).to.exist;
    expect(sqliteBackedElem).to.exist;
    assert.equal(inMemoryElem!.ECInstanceId, sqliteBackedElem!.ECInstanceId);
    assert.equal(sqliteBackedElem!.ECClassId, inMemoryElem!.ECClassId);
    assert.equal(inMemoryElem!.Model.Id, sqliteBackedElem!.Model.Id);
    assert.equal(inMemoryElem!.Model.RelECClassId, sqliteBackedElem!.Model.RelECClassId);
    assert.equal(inMemoryElem!.LastMod, sqliteBackedElem!.LastMod);
    assert.equal(inMemoryElem!.CodeSpec.Id, sqliteBackedElem!.CodeSpec.Id);
    assert.equal(inMemoryElem!.CodeSpec.RelECClassId, sqliteBackedElem!.CodeSpec.RelECClassId);

    assert.equal(inMemoryElem!.CodeScope.Id, sqliteBackedElem!.CodeScope.Id);
    assert.equal(inMemoryElem!.CodeScope.RelECClassId, sqliteBackedElem!.CodeScope.RelECClassId);
    assert.equal(inMemoryElem!.FederationGuid, sqliteBackedElem!.FederationGuid);

    assert.equal(inMemoryElem!.Category.Id, sqliteBackedElem!.Category.Id);
    assert.equal(inMemoryElem!.Category.RelECClassId, sqliteBackedElem!.Category.RelECClassId);
    assert.deepEqual(inMemoryElem!.Origin, sqliteBackedElem!.Origin);
    assert.equal(inMemoryElem!.Rotation, sqliteBackedElem!.Rotation);
    assert.deepEqual(inMemoryElem!.BBoxLow, sqliteBackedElem!.BBoxLow);
    assert.deepEqual(inMemoryElem!.BBoxHigh, sqliteBackedElem!.BBoxHigh);
    assert.equal(inMemoryElem!.GeometryStream, sqliteBackedElem!.GeometryStream);
    assert.equal(inMemoryElem!.BinProp, sqliteBackedElem!.BinProp);
    assert.equal(inMemoryElem!.StrProp, sqliteBackedElem!.StrProp);
    assert.equal(inMemoryElem!.IntProp, sqliteBackedElem!.IntProp);
    assert.equal(inMemoryElem!.LongProp, sqliteBackedElem!.LongProp);
    assert.closeTo(inMemoryElem!.DblProp as number, sqliteBackedElem!.DblProp as number, 1e-10);
    assert.equal(inMemoryElem!.BoolProp, sqliteBackedElem!.BoolProp);
    assert.equal(inMemoryElem!.DtProp, sqliteBackedElem!.DtProp);
    assert.deepEqual(inMemoryElem!.Pt2dProp, sqliteBackedElem!.Pt2dProp);
    assert.deepEqual(inMemoryElem!.Pt3dProp, sqliteBackedElem!.Pt3dProp);
    assert.deepEqual(inMemoryElem!.StructProp, sqliteBackedElem!.StructProp);
    assert.deepEqual(inMemoryElem!.IntArrProp, sqliteBackedElem!.IntArrProp);
    assert.deepEqual(inMemoryElem!.StrArrProp, sqliteBackedElem!.StrArrProp);
    assert.deepEqual(inMemoryElem!.StructArrProp, sqliteBackedElem!.StructArrProp);
    assert.equal(inMemoryElem!.RelatedElem.Id, sqliteBackedElem!.RelatedElem.Id);
    assert.equal(inMemoryElem!.RelatedElem.RelECClassId, sqliteBackedElem!.RelatedElem.RelECClassId);
    // Object.keys
    assert.deepEqual(Object.keys(inMemoryElem!).sort(), Object.keys(sqliteBackedElem!).sort());
    // $meta keys
    assert.deepEqual(Object.keys(inMemoryElem!.$meta).sort(), Object.keys(sqliteBackedElem!.$meta).sort());
    assert.equal(inMemoryElem!.$meta.op, sqliteBackedElem!.$meta.op);
    assert.equal(inMemoryElem!.$meta.stage, sqliteBackedElem!.$meta.stage);
    assert.deepEqual([...inMemoryElem!.$meta.tables].sort(), [...sqliteBackedElem!.$meta.tables].sort());
    assert.deepEqual([...inMemoryElem!.$meta.changeIndexes].sort(), [...sqliteBackedElem!.$meta.changeIndexes].sort());
    assert.equal(inMemoryElem!.$meta.instanceKey, sqliteBackedElem!.$meta.instanceKey);
    assert.deepEqual([...inMemoryElem!.$meta.changeFetchedPropNames].sort(), [...sqliteBackedElem!.$meta.changeFetchedPropNames].sort());
    assert.deepEqual(inMemoryElem!.$meta.rowOptions, sqliteBackedElem!.$meta.rowOptions);
    assert.equal(inMemoryElem!.$meta.isIndirectChange, sqliteBackedElem!.$meta.isIndirectChange);
  });
  it("should throw error if tried to fetch changeset metadata values before stepping", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    expect(() => reader.isECTable).to.throw();
    expect(() => reader.isIndirectChange).to.throw();
    expect(() => reader.tableName).to.throw();
    expect(() => reader.op).to.throw();
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    reader.close();
  });
  it("should throw error if tried to fetch changeset metadata values after stepping past the end", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    while (reader.step()) { }
    assert.equal(reader.step(), false);
    expect(() => reader.isECTable).to.throw();
    expect(() => reader.isIndirectChange).to.throw();
    expect(() => reader.tableName).to.throw();
    expect(() => reader.op).to.throw();
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    reader.close();
  });

  it("Checking non unified values", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });

    assert.isTrue(reader.step());
    assert.isTrue(reader.isECTable);
    assert.isFalse(reader.isIndirectChange);
    assert.equal(reader.tableName, "bis_Element");
    assert.equal(reader.op, "Inserted");
    assert.isDefined(reader.inserted);
    assert.isUndefined(reader.deleted);

    assert.isTrue(reader.step());
    assert.isTrue(reader.isECTable);
    assert.isFalse(reader.isIndirectChange);
    assert.equal(reader.tableName, "bis_GeometricElement2d");
    assert.equal(reader.op, "Inserted");
    assert.isDefined(reader.inserted);
    assert.isUndefined(reader.deleted);

    assert.isTrue(reader.step());
    assert.isTrue(reader.isECTable);
    assert.isTrue(reader.isIndirectChange);
    assert.equal(reader.tableName, "bis_Model");
    assert.equal(reader.op, "Updated");
    assert.isDefined(reader.inserted);
    assert.isDefined(reader.deleted);

    assert.isFalse(reader.step());
  });
});

describe("ChangesetReader insert-partial", () => {
  let rwIModel: BriefcaseDb;
  let partialElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;
  let txn: EditTxn;

  before(async () => {
    HubMock.startup("ECChangesetInsertPartial", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "insertPartial", description: "insertPartial", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "ChangesetReader insert-partial");
    // Txn 1: import schema + drawing model setup, then push
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <!-- Rich struct: scalar fields + nested point2d/3d sub-properties -->
      <ECStructClass typeName="RichPoint" modifier="Sealed">
          <ECProperty propertyName="X"     typeName="double"/>
          <ECProperty propertyName="Y"     typeName="double"/>
          <ECProperty propertyName="Z"     typeName="double"/>
          <ECProperty propertyName="Label" typeName="string"/>
          <ECProperty propertyName="Pt2d"  typeName="point2d"/>
          <ECProperty propertyName="Pt3d"  typeName="point3d"/>
      </ECStructClass>
      <!-- Relationship used by the RelatedElem navigation property -->
      <ECRelationshipClass typeName="Test2dUsesElement" strength="referencing" modifier="None">
          <Source multiplicity="(0..*)" roleLabel="uses" polymorphic="true"><Class class="Test2dElement"/></Source>
          <Target multiplicity="(0..1)" roleLabel="is used by" polymorphic="true"><Class class="bis:Element"/></Target>
      </ECRelationshipClass>
      <ECEntityClass typeName="Test2dElement">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <!-- Primitives -->
          <ECProperty propertyName="StrProp"        typeName="string"/>
          <ECProperty propertyName="IntProp"        typeName="int"/>
          <ECProperty propertyName="LongProp"       typeName="long"/>
          <ECProperty propertyName="DblProp"        typeName="double"/>
          <ECProperty propertyName="BoolProp"       typeName="boolean"/>
          <ECProperty propertyName="DtProp"         typeName="dateTime"/>
          <ECProperty propertyName="BinProp"        typeName="binary"/>
          <!-- Geometric primitives -->
          <ECProperty propertyName="Pt2dProp"       typeName="point2d"/>
          <ECProperty propertyName="Pt3dProp"       typeName="point3d"/>
          <!-- Struct, arrays -->
          <ECStructProperty      propertyName="StructProp"    typeName="RichPoint"/>
          <ECArrayProperty       propertyName="IntArrProp"    typeName="int"       minOccurs="0" maxOccurs="unbounded"/>
          <ECArrayProperty       propertyName="StrArrProp"    typeName="string"    minOccurs="0" maxOccurs="unbounded"/>
          <ECStructArrayProperty propertyName="StructArrProp" typeName="RichPoint" minOccurs="0" maxOccurs="unbounded"/>
          <!-- Navigation property -->
          <ECNavigationProperty propertyName="RelatedElem" relationshipName="Test2dUsesElement" direction="forward"/>
      </ECEntityClass>
  </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(txn, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    txn.saveChanges("setup");

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Txn 2: insert PARTIAL element  only mandatory props
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    partialElementId = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      // StrProp, IntProp, LongProp, DblProp, BoolProp, DtProp, BinProp intentionally absent
    } as any);
    txn.saveChanges("insert partial element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("txn2 insert-partial | All_Properties | default rowOptions", () => {
    const instances = readTxn(rwIModel, txnId);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    // Model Old has LastMod and GeometryGuid when previous txn's model New values survive
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement (partial) Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isString(elem!.LastMod);
    assert.equal(elem!.CodeSpec.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeSpec.RelECClassId), "BisCore:CodeSpecSpecifiesCode");

    assert.equal(elem!.CodeScope.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeScope.RelECClassId), "BisCore:ElementScopesCode");
    assert.isString(elem!.FederationGuid);
    assert.equal(elem!.Category.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Category.RelECClassId), "BisCore:GeometricElement2dIsInCategory");
    // No custom props on the partial element
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.IntProp);
    assert.isUndefined(elem!.LongProp);
    assert.isUndefined(elem!.DblProp);
    assert.isUndefined(elem!.BoolProp);
    assert.isUndefined(elem!.DtProp);
    assert.isUndefined(elem!.Pt2dProp);
    assert.isUndefined(elem!.Pt3dProp);
    assert.isUndefined(elem!.StructProp);
    assert.isUndefined(elem!.IntArrProp);
    assert.isUndefined(elem!.StrArrProp);
    assert.isUndefined(elem!.StructArrProp);
    assert.isUndefined(elem!.RelatedElem);
    assert.isUndefined(elem!.BinProp);
    // Object.keys — partial insert: only BIS columns present (no 2d geometry columns either)
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category",
    ].sort());
    // $meta keys
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), [
      'ECInstanceId', 'ECClassId', 'Model.Id', 'LastMod', 'CodeSpec.Id',
      'CodeScope.Id', 'CodeValue', 'UserLabel', 'Parent', 'FederationGuid',
      'JsonProperties', 'Category.Id', 'Origin', 'Rotation', 'BBoxLow', 'BBoxHigh',
      'GeometryStream', 'TypeDefinition', 'StrProp', 'IntProp', 'LongProp',
      'DblProp', 'BoolProp', 'DtProp', 'BinProp', 'Pt2dProp', 'Pt3dProp',
      'StructProp.X', 'StructProp.Y', 'StructProp.Z', 'StructProp.Label',
      'StructProp.Pt2d', 'StructProp.Pt3d', 'IntArrProp', 'StrArrProp',
      'StructArrProp', 'RelatedElem'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.isUndefined(elem!.BinProp);
    assert.equal(elem!.$meta.isIndirectChange, false);

  });

  it("txn2 insert-partial | All_Properties | default rowOptions | invert", () => {
    const instances = readTxn(rwIModel, txnId, undefined, undefined, true);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.isUndefined(modelNew!.LastMod);
    assert.isUndefined(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.isString(modelOld!.LastMod);
    assert.isString(modelOld!.GeometryGuid);
    // Model Old has LastMod and GeometryGuid when previous txn's model New values survive
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isString(elem!.LastMod);
    assert.equal(elem!.CodeSpec.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeSpec.RelECClassId), "BisCore:CodeSpecSpecifiesCode");

    assert.equal(elem!.CodeScope.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeScope.RelECClassId), "BisCore:ElementScopesCode");
    assert.isString(elem!.FederationGuid);
    assert.equal(elem!.Category.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Category.RelECClassId), "BisCore:GeometricElement2dIsInCategory");
    // No custom props on the partial element
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.IntProp);
    assert.isUndefined(elem!.LongProp);
    assert.isUndefined(elem!.DblProp);
    assert.isUndefined(elem!.BoolProp);
    assert.isUndefined(elem!.DtProp);
    assert.isUndefined(elem!.Pt2dProp);
    assert.isUndefined(elem!.Pt3dProp);
    assert.isUndefined(elem!.StructProp);
    assert.isUndefined(elem!.IntArrProp);
    assert.isUndefined(elem!.StrArrProp);
    assert.isUndefined(elem!.StructArrProp);
    assert.isUndefined(elem!.RelatedElem);
    assert.isUndefined(elem!.BinProp);
    // Object.keys — partial insert: only BIS columns present (no 2d geometry columns either)
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category",
    ].sort());
    // $meta keys
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), [
      'ECInstanceId', 'ECClassId', 'Model.Id', 'LastMod', 'CodeSpec.Id',
      'CodeScope.Id', 'CodeValue', 'UserLabel', 'Parent', 'FederationGuid',
      'JsonProperties', 'Category.Id', 'Origin', 'Rotation', 'BBoxLow', 'BBoxHigh',
      'GeometryStream', 'TypeDefinition', 'StrProp', 'IntProp', 'LongProp',
      'DblProp', 'BoolProp', 'DtProp', 'BinProp', 'Pt2dProp', 'Pt3dProp',
      'StructProp.X', 'StructProp.Y', 'StructProp.Z', 'StructProp.Label',
      'StructProp.Pt2d', 'StructProp.Pt3d', 'IntArrProp', 'StrArrProp',
      'StructArrProp', 'RelatedElem'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.isUndefined(elem!.BinProp);
    assert.equal(elem!.$meta.isIndirectChange, false);

  });

  it("txn2 insert-partial | Bis_Element_Properties", () => {
    const instances = readTxn(rwIModel, txnId, PropertyFilter.BisCoreElement, { classIdsToClassNames: true });
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "BisCore.DrawingModel");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore.DrawingModel", modelOld!.ECClassId);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement (partial) Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal(elem!.ECClassId, "TestDomain.Test2dElement");
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.IntProp);
    expect(elem!.Model).to.exist;
    expect(elem!.LastMod).to.exist;
    expect(elem!.CodeSpec).to.exist;
    expect(elem!.CodeScope).to.exist;
    expect(elem!.FederationGuid).to.exist;
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "ECClassId", "CodeScope.Id",
      "CodeSpec.Id", "CodeValue", "FederationGuid", "JsonProperties", "LastMod", "Model.Id", "Parent", "UserLabel"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn2 insert-partial | Instance_Key", () => {
    const instances = readTxn(rwIModel, txnId, PropertyFilter.InstanceKey);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement (partial) Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.Model);
    assert.isUndefined(elem!.LastMod);
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "ECClassId"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn2 insert-partial | rowOptions: classIdsToClassNames", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });

    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECClassId, "TestDomain.Test2dElement");
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "BisCore.ModelContainsElements" });
    assert.deepEqual(elem!.CodeSpec, { Id: "0x1", RelECClassId: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.CodeScope, { Id: "0x1", RelECClassId: "BisCore.ElementScopesCode" });
    assert.deepEqual(elem!.Category, { Id: drawingCategoryId, RelECClassId: "BisCore.GeometricElement2dIsInCategory" });
    assert.isUndefined(elem!.StrProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta", "Category",
    ].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true });
  });

  it("txn2 insert-partial | rowOptions: useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { useJsName: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelNew!.ECInstanceId);
    assert.deepEqual(modelNew!.$meta.rowOptions, { useJsName: true });

    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { useJsName: true });

    const elem = instances.find((i) => i.id === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elem!.ECInstanceId);
    assert.isUndefined(elem!.ECClassId);
    assert.deepEqual(elem!.model, { id: drawingModelId, relClassName: "BisCore.ModelContainsElements" });
    assert.deepEqual(elem!.codeSpec, { id: "0x1", relClassName: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.codeScope, { id: "0x1", relClassName: "BisCore.ElementScopesCode" });
    assert.deepEqual(elem!.category, { id: drawingCategoryId, relClassName: "BisCore.GeometricElement2dIsInCategory" });
    assert.isUndefined(elem!.strProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "id", "className", "model", "lastMod", "codeSpec", "codeScope", "federationGuid", "$meta", "category",
    ].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { useJsName: true });
  });

  it("txn2 insert-partial | rowOptions: abbreviateBlobs", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: true });

    // Partial element has no blob props; ECClassId stays as raw hex
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isUndefined(elem!.StrProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta", "Category",
    ].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { abbreviateBlobs: true });
  });

  it("txn2 insert-partial | rowOptions: classIdsToClassNames + useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true, useJsName: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelNew!.ECInstanceId);
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });

    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });

    const elem = instances.find((i) => i.id === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elem!.ECInstanceId);
    assert.deepEqual(elem!.model, { id: drawingModelId, relClassName: "BisCore.ModelContainsElements" });
    assert.deepEqual(elem!.codeSpec, { id: "0x1", relClassName: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.codeScope, { id: "0x1", relClassName: "BisCore.ElementScopesCode" });
    assert.deepEqual(elem!.category, { id: drawingCategoryId, relClassName: "BisCore.GeometricElement2dIsInCategory" });
    assert.isUndefined(elem!.strProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "id", "className", "model", "lastMod", "codeSpec", "codeScope", "federationGuid", "$meta", "category",
    ].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
  });
  it("should throw error if tried to fetch changeset metadata values before stepping", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    expect(() => reader.isECTable).to.throw();
    expect(() => reader.isIndirectChange).to.throw();
    expect(() => reader.tableName).to.throw();
    expect(() => reader.op).to.throw();
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    reader.close();
  });
  it("should throw error if tried to fetch changeset metadata values after stepping past the end", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    while (reader.step()) { }
    assert.equal(reader.step(), false);
    expect(() => reader.isECTable).to.throw();
    expect(() => reader.isIndirectChange).to.throw();
    expect(() => reader.tableName).to.throw();
    expect(() => reader.op).to.throw();
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    reader.close();
  });

});


describe("ChangesetReader update-full", () => {
  let rwIModel: BriefcaseDb;
  let fullElementId: Id64String;
  let partialElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;
  let txn: EditTxn;

  before(async () => {
    HubMock.startup("ECChangesetUpdateFull", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "updateFull", description: "updateFull", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "ChangesetReader update-full setup");
    // Txn 1: import schema + drawing model setup, then push
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <!-- Rich struct: scalar fields + nested point2d/3d sub-properties -->
      <ECStructClass typeName="RichPoint" modifier="Sealed">
          <ECProperty propertyName="X"     typeName="double"/>
          <ECProperty propertyName="Y"     typeName="double"/>
          <ECProperty propertyName="Z"     typeName="double"/>
          <ECProperty propertyName="Label" typeName="string"/>
          <ECProperty propertyName="Pt2d"  typeName="point2d"/>
          <ECProperty propertyName="Pt3d"  typeName="point3d"/>
      </ECStructClass>
      <!-- Relationship used by the RelatedElem navigation property -->
      <ECRelationshipClass typeName="Test2dUsesElement" strength="referencing" modifier="None">
          <Source multiplicity="(0..*)" roleLabel="uses" polymorphic="true"><Class class="Test2dElement"/></Source>
          <Target multiplicity="(0..1)" roleLabel="is used by" polymorphic="true"><Class class="bis:Element"/></Target>
      </ECRelationshipClass>
      <ECEntityClass typeName="Test2dElement">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <!-- Primitives -->
          <ECProperty propertyName="StrProp"        typeName="string"/>
          <ECProperty propertyName="IntProp"        typeName="int"/>
          <ECProperty propertyName="LongProp"       typeName="long"/>
          <ECProperty propertyName="DblProp"        typeName="double"/>
          <ECProperty propertyName="BoolProp"       typeName="boolean"/>
          <ECProperty propertyName="DtProp"         typeName="dateTime"/>
          <ECProperty propertyName="BinProp"        typeName="binary"/>
          <!-- Geometric primitives -->
          <ECProperty propertyName="Pt2dProp"       typeName="point2d"/>
          <ECProperty propertyName="Pt3dProp"       typeName="point3d"/>
          <!-- Struct, arrays -->
          <ECStructProperty      propertyName="StructProp"    typeName="RichPoint"/>
          <ECArrayProperty       propertyName="IntArrProp"    typeName="int"       minOccurs="0" maxOccurs="unbounded"/>
          <ECArrayProperty       propertyName="StrArrProp"    typeName="string"    minOccurs="0" maxOccurs="unbounded"/>
          <ECStructArrayProperty propertyName="StructArrProp" typeName="RichPoint" minOccurs="0" maxOccurs="unbounded"/>
          <!-- Navigation property -->
          <ECNavigationProperty propertyName="RelatedElem" relationshipName="Test2dUsesElement" direction="forward"/>
      </ECEntityClass>
  </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(txn, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    txn.saveChanges("setup");

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the full insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Txn 2: insert FULL element (needed as update target)
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const geom: GeometryStreamProps = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ].map((a) => IModelJson.Writer.toIModelJson(a));

    fullElementId = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom,
      StrProp: "hello",
      IntProp: 42,
      LongProp: 9_007_199_254_740_991,   // Number.MAX_SAFE_INTEGER
      DblProp: 3.14159265358979,
      BoolProp: true,
      DtProp: "2024-01-15T12:00:00.000",
      BinProp: new Uint8Array([1, 2, 3, 5]),
      Pt2dProp: { x: 1.5, y: 2.5 },
      Pt3dProp: { x: 3.0, y: 4.0, z: 5.0 },
      StructProp: {
        X: 1.0, Y: 2.0, Z: 3.0, Label: "origin",
        Pt2d: { x: 0.5, y: 0.5 },
        Pt3d: { x: 1.0, y: 2.0, z: 3.0 },
      },
      IntArrProp: [10, 20, 30],
      StrArrProp: ["alpha", "beta", "gamma"],
      StructArrProp: [
        { X: 0.0, Y: 1.0, Z: 2.0, Label: "a", Pt2d: { x: 0.0, y: 0.0 }, Pt3d: { x: 0.0, y: 0.0, z: 0.0 } },
        { X: 3.0, Y: 4.0, Z: 5.0, Label: "b", Pt2d: { x: 1.0, y: 1.0 }, Pt3d: { x: 1.0, y: 1.0, z: 1.0 } },
      ],
      RelatedElem: { id: drawingCategoryId, relClassName: "TestDomain:Test2dUsesElement" },
    } as any);
    txn.saveChanges("insert full element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the partial insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Txn 3: insert PARTIAL element (needed as RelatedElem target in the update)
    partialElementId = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      // StrProp, IntProp, LongProp, DblProp, BoolProp, DtProp, BinProp intentionally absent
    } as any);
    txn.saveChanges("insert partial element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the update txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Txn 4: update FULL element  this is the txn under test
    // Txn 3: update FULL element — change several property types
    await rwIModel.locks.acquireLocks({ exclusive: fullElementId });
    txn.updateElement({
      ...rwIModel.elements.getElementProps(fullElementId),
      StrProp: "updated",
      IntProp: 99,
      LongProp: 0,
      DblProp: 2.71828182845904,
      BoolProp: false,
      DtProp: "2025-06-01T08:30:00.000",
      BinProp: new Uint8Array([10, 20, 30, 40, 50]),
      Pt2dProp: { x: 9.0, y: 8.0 },
      Pt3dProp: { x: 7.0, y: 6.0, z: 5.0 },
      StructProp: {
        X: 9.0, Y: 8.0, Z: 7.0, Label: "updated-origin",
        Pt2d: { x: 9.5, y: 8.5 },
        Pt3d: { x: 9.0, y: 8.0, z: 7.0 },
      },
      IntArrProp: [100, 200],
      StrArrProp: ["delta", "epsilon"],
      StructArrProp: [
        { X: 5.0, Y: 6.0, Z: 7.0, Label: "c", Pt2d: { x: 5.0, y: 5.0 }, Pt3d: { x: 5.0, y: 5.0, z: 5.0 } },
        { X: 7.0, Y: 8.0, Z: 9.0, Label: "d", Pt2d: { x: 7.0, y: 7.0 }, Pt3d: { x: 7.0, y: 7.0, z: 7.0 } },
        { X: 9.0, Y: 10.0, Z: 11.0, Label: "e", Pt2d: { x: 9.0, y: 9.0 }, Pt3d: { x: 9.0, y: 9.0, z: 9.0 } },
      ],
      RelatedElem: { id: partialElementId, relClassName: "TestDomain:Test2dUsesElement" },
    });
    txn.saveChanges("update full element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("txn3 update-full | All_Properties | default rowOptions", () => {
    const instances = readTxn(rwIModel, txnId, undefined, undefined, undefined, false);
    assert.equal(instances.length, 4);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.isString(modelNew!.LastMod);
    assert.isUndefined(modelNew!.GeometryGuid); // no GeometryGuid in update txn model row
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.isString(modelOld!.LastMod);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Updated New ---
    const elemNew = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.ECInstanceId, fullElementId);
    assert.equal(elemNew!.ECClassId, "0x176");
    assert.equal(elemNew!.StrProp, "updated");
    assert.equal(elemNew!.IntProp, 99);
    assert.equal(elemNew!.LongProp, 0);
    assert.include(String(elemNew!.BinProp), "\"bytes\"");
    assert.closeTo(elemNew!.DblProp as number, 2.71828182845904, 1e-10);
    assert.equal(elemNew!.BoolProp, false);
    assert.equal(elemNew!.DtProp, "2025-06-01T08:30:00.000");
    assert.deepEqual(elemNew!.Pt2dProp, { X: 9, Y: 8 });
    assert.deepEqual(elemNew!.Pt3dProp, { X: 7, Y: 6, Z: 5 });
    assert.deepEqual(elemNew!.StructProp, { X: 9, Y: 8, Z: 7, Label: "updated-origin", Pt2d: { X: 9.5, Y: 8.5 }, Pt3d: { X: 9, Y: 8, Z: 7 } });
    assert.deepEqual(elemNew!.IntArrProp, [100, 200]);
    assert.deepEqual(elemNew!.StrArrProp, ["delta", "epsilon"]);
    assert.deepEqual(elemNew!.StructArrProp, [
      { X: 5, Y: 6, Z: 7, Label: "c", Pt2d: { X: 5, Y: 5 }, Pt3d: { X: 5, Y: 5, Z: 5 } },
      { X: 7, Y: 8, Z: 9, Label: "d", Pt2d: { X: 7, Y: 7 }, Pt3d: { X: 7, Y: 7, Z: 7 } },
      { X: 9, Y: 10, Z: 11, Label: "e", Pt2d: { X: 9, Y: 9 }, Pt3d: { X: 9, Y: 9, Z: 9 } },
    ]);
    assert.equal(elemNew!.RelatedElem.Id, partialElementId);
    assert.equal(rwIModel.getClassNameFromId(elemNew!.RelatedElem.RelECClassId), "TestDomain:Test2dUsesElement");
    assert.isString(elemNew!.LastMod);
    // Object.keys — update row: custom-prop columns first, then $meta and LastMod at the end
    assert.deepEqual(Object.keys(elemNew!).sort(), [
      "ECInstanceId", "ECClassId",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem",
      "$meta", "LastMod", "BinProp"
    ].sort());
    assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.stage, "New");
    assert.deepEqual([...elemNew!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.deepEqual([...elemNew!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elemNew!.$meta.instanceKey);
    assert.equal(elemNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elemNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), [
      "BoolProp", "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp",
      "StrProp", "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z", "BinProp"
    ].sort());
    assert.deepEqual(elemNew!.$meta.rowOptions, {});
    assert.equal(elemNew!.$meta.isIndirectChange, false);

    // --- instances[3]: Test2dElement Updated Old ---
    const elemOld = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.ECInstanceId, fullElementId);
    assert.equal(elemOld!.ECClassId, "0x176");
    assert.equal(elemOld!.StrProp, "hello");
    assert.equal(elemOld!.IntProp, 42);
    assert.equal(elemOld!.LongProp, 9007199254740991);
    assert.closeTo(elemOld!.DblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elemOld!.BoolProp, true);
    assert.include(String(elemOld!.BinProp), "\"bytes\"");
    assert.equal(elemOld!.DtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elemOld!.Pt2dProp, { X: 1.5, Y: 2.5 });
    assert.deepEqual(elemOld!.Pt3dProp, { X: 3, Y: 4, Z: 5 });
    assert.deepEqual(elemOld!.StructProp, { X: 1, Y: 2, Z: 3, Label: "origin", Pt2d: { X: 0.5, Y: 0.5 }, Pt3d: { X: 1, Y: 2, Z: 3 } });
    assert.deepEqual(elemOld!.IntArrProp, [10, 20, 30]);
    assert.deepEqual(elemOld!.StrArrProp, ["alpha", "beta", "gamma"]);
    assert.deepEqual(elemOld!.StructArrProp, [
      { X: 0, Y: 1, Z: 2, Label: "a", Pt2d: { X: 0, Y: 0 }, Pt3d: { X: 0, Y: 0, Z: 0 } },
      { X: 3, Y: 4, Z: 5, Label: "b", Pt2d: { X: 1, Y: 1 }, Pt3d: { X: 1, Y: 1, Z: 1 } },
    ]);
    assert.equal(elemOld!.RelatedElem.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elemOld!.RelatedElem.RelECClassId), "TestDomain:Test2dUsesElement");
    assert.isString(elemOld!.LastMod);
    assert.deepEqual(Object.keys(elemOld!).sort(), [
      "ECInstanceId", "ECClassId",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem",
      "$meta", "LastMod", "BinProp"
    ].sort());
    assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elemOld!.$meta.op, "Updated");
    assert.equal(elemOld!.$meta.stage, "Old");
    assert.deepEqual([...elemOld!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.equal(elemOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), [
      "BoolProp", "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp",
      "StrProp", "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z", "BinProp"
    ].sort());
    assert.deepEqual(elemOld!.$meta.rowOptions, {});
    assert.equal(elemOld!.$meta.isIndirectChange, false);
  });

  it("txn3 update-full | Bis_Element_Properties", () => {
    const instances = readTxn(rwIModel, txnId, PropertyFilter.BisCoreElement, { classIdsToClassNames: true }, undefined, false);
    assert.equal(instances.length, 4);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "BisCore.DrawingModel");
    assert.isString(modelNew!.LastMod);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "BisCore.DrawingModel");
    assert.isString(modelOld!.LastMod);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Updated New (no custom props) ---
    const elemNew = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.ECInstanceId, fullElementId);
    assert.equal(elemNew!.ECClassId, "TestDomain.Test2dElement");
    assert.isUndefined(elemNew!.StrProp);
    assert.isUndefined(elemNew!.IntProp);
    assert.isUndefined(elemNew!.Model);
    assert.isUndefined(elemNew!.Category);
    expect(elemNew!.LastMod).to.exist;
    assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "$meta", "LastMod"].sort());
    assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.stage, "New");
    assert.deepEqual([...elemNew!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.deepEqual([...elemNew!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elemNew!.$meta.instanceKey);
    assert.equal(elemNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elemNew!.$meta.propFilter, PropertyFilter.BisCoreElement);

    assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(elemNew!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(elemNew!.$meta.isIndirectChange, false);

    // --- instances[3]: Test2dElement Updated Old ---
    const elemOld = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.ECInstanceId, fullElementId);
    assert.equal(elemOld!.ECClassId, "TestDomain.Test2dElement");
    assert.isUndefined(elemOld!.StrProp);
    assert.isUndefined(elemOld!.IntProp);
    assert.isUndefined(elemOld!.Model);
    assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "$meta", "LastMod"].sort());
    assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elemOld!.$meta.op, "Updated");
    assert.equal(elemOld!.$meta.stage, "Old");
    assert.deepEqual([...elemOld!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.equal(elemOld!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(elemOld!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(elemOld!.$meta.isIndirectChange, false);
  });

  it("txn3 update-full | Instance_Key", () => {
    const instances = readTxn(rwIModel, txnId, PropertyFilter.InstanceKey, undefined, undefined, false);
    assert.equal(instances.length, 4);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement Updated New ---
    const elemNew = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.ECInstanceId, fullElementId);
    assert.equal(elemNew!.ECClassId, "0x176");
    assert.isUndefined(elemNew!.StrProp);
    assert.isUndefined(elemNew!.Model);
    assert.isUndefined(elemNew!.LastMod);
    assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.stage, "New");
    assert.deepEqual([...elemNew!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.deepEqual([...elemNew!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elemNew!.$meta.instanceKey);
    assert.equal(elemNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elemNew!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(elemNew!.$meta.rowOptions, {});
    assert.equal(elemNew!.$meta.isIndirectChange, false);

    // --- instances[3]: Test2dElement Updated Old ---
    const elemOld = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.ECInstanceId, fullElementId);
    assert.equal(elemOld!.ECClassId, "0x176");
    assert.isUndefined(elemOld!.StrProp);
    assert.isUndefined(elemOld!.Model);
    assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elemOld!.$meta.op, "Updated");
    assert.equal(elemOld!.$meta.stage, "Old");
    assert.deepEqual([...elemOld!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.equal(elemOld!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(elemOld!.$meta.rowOptions, {});
    assert.equal(elemOld!.$meta.isIndirectChange, false);
  });

  it("txn3 update-full | rowOptions: useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { useJsName: true }, undefined, false);
    assert.equal(instances.length, 4);

    const modelNew = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelNew!.ECInstanceId);
    assert.deepEqual(modelNew!.$meta.rowOptions, { useJsName: true });

    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { useJsName: true });

    const elemNew = instances.find((i) => i.id === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elemNew!.ECInstanceId);
    assert.equal(elemNew!.strProp, "updated");
    assert.equal(elemNew!.intProp, 99);
    assert.include(String(elemNew!.binProp), "\"bytes\"");
    assert.deepEqual(elemNew!.pt2dProp, { x: 9, y: 8 });
    assert.deepEqual(elemNew!.pt3dProp, { x: 7, y: 6, z: 5 });
    assert.deepEqual(elemNew!.relatedElem, { id: partialElementId, relClassName: "TestDomain.Test2dUsesElement" });
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elemNew!.$meta.rowOptions, { useJsName: true });
    assert.deepEqual(Object.keys(elemNew!).sort(), ["$meta", "binProp", "boolProp", "className",
      "dblProp", "dtProp", "id", "intArrProp", "intProp", "lastMod", "longProp", "pt2dProp",
      "pt3dProp", "relatedElem", "strArrProp", "strProp", "structArrProp", "structProp"].sort());
    assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());

    const elemOld = instances.find((i) => i.id === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elemOld!.ECInstanceId);
    assert.equal(elemOld!.strProp, "hello");
    assert.include(String(elemOld!.binProp), "\"bytes\"");
    assert.equal(elemOld!.intProp, 42);
    assert.deepEqual(elemOld!.relatedElem, { id: drawingCategoryId, relClassName: "TestDomain.Test2dUsesElement" });
    assert.deepEqual(elemOld!.$meta.rowOptions, { useJsName: true });
    assert.deepEqual(Object.keys(elemOld!).sort(), ["$meta", "binProp", "boolProp", "className",
      "dblProp", "dtProp", "id", "intArrProp", "intProp", "lastMod", "longProp", "pt2dProp",
      "pt3dProp", "relatedElem", "strArrProp", "strProp", "structArrProp", "structProp"].sort());
    assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());
  });

  it("txn3 update-full | rowOptions: abbreviateBlobs", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: true }, undefined, false);
    assert.equal(instances.length, 4);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: true });

    const elemNew = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elemNew!.ECClassId));
    assert.equal(elemNew!.StrProp, "updated");
    // BinProp is a blob  should be abbreviated to { bytes: N }
    assert.include(String(elemNew!.BinProp), "bytes");
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: true });
    assert.deepEqual(Object.keys(elemNew!).sort(), ["$meta", "BinProp", "BoolProp",
      "DblProp", "DtProp", "IntArrProp", "IntProp", "LastMod", "LongProp",
      "Pt2dProp", "Pt3dProp", "RelatedElem", "StrArrProp", "StrProp", "StructArrProp", "StructProp", "ECClassId", "ECInstanceId"].sort());
    assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());

    const elemOld = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.ECClassId, "0x176");
    assert.equal(elemOld!.StrProp, "hello");
    assert.include(String(elemOld!.BinProp), "bytes");
    assert.deepEqual(elemOld!.$meta.rowOptions, { abbreviateBlobs: true });
    assert.deepEqual(Object.keys(elemOld!).sort(), ["$meta", "BinProp", "BoolProp",
      "DblProp", "DtProp", "IntArrProp", "IntProp", "LastMod", "LongProp",
      "Pt2dProp", "Pt3dProp", "RelatedElem", "StrArrProp", "StrProp", "StructArrProp", "StructProp", "ECClassId", "ECInstanceId"].sort());
    assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());
  });

  it("txn3 update-full | rowOptions: classIdsToClassNames + useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true, useJsName: true }, undefined, false);
    assert.equal(instances.length, 4);

    const modelNew = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelNew!.ECInstanceId);
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });

    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });

    const elemNew = instances.find((i) => i.id === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elemNew!.ECInstanceId);
    assert.equal(elemNew!.strProp, "updated");
    assert.equal(elemNew!.intProp, 99);
    assert.include(String(elemNew!.binProp), "\"bytes\"");
    assert.deepEqual(elemNew!.relatedElem, { id: partialElementId, relClassName: "TestDomain.Test2dUsesElement" });
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.deepEqual(elemNew!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
    assert.deepEqual(Object.keys(elemNew!).sort(), ["$meta", "binProp", "boolProp", "className",
      "dblProp", "dtProp", "id", "intArrProp", "intProp", "lastMod", "longProp", "pt2dProp",
      "pt3dProp", "relatedElem", "strArrProp", "strProp", "structArrProp", "structProp"].sort());
    assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());

    const elemOld = instances.find((i) => i.id === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elemOld!.ECInstanceId);
    assert.equal(elemOld!.strProp, "hello");
    assert.include(String(elemOld!.binProp), "\"bytes\"");
    assert.deepEqual(elemOld!.relatedElem, { id: drawingCategoryId, relClassName: "TestDomain.Test2dUsesElement" });
    assert.deepEqual(elemOld!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
    assert.deepEqual(Object.keys(elemOld!).sort(), ["$meta", "binProp", "boolProp", "className",
      "dblProp", "dtProp", "id", "intArrProp", "intProp", "lastMod", "longProp", "pt2dProp",
      "pt3dProp", "relatedElem", "strArrProp", "strProp", "structArrProp", "structProp"].sort());
    assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());
  });

  it("txn3 update-full | rowOptions: classIdsToClassNames", () => {

    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true }, undefined, false);
    assert.equal(instances.length, 4);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });

    const elemNew = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.ECClassId, "TestDomain.Test2dElement");
    assert.equal(elemNew!.StrProp, "updated");
    assert.equal(elemNew!.IntProp, 99);
    assert.include(String(elemNew!.BinProp), "\"bytes\"");
    assert.deepEqual(elemNew!.RelatedElem, { Id: partialElementId, RelECClassId: "TestDomain.Test2dUsesElement" });
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elemNew!.$meta.rowOptions, { classIdsToClassNames: true });

    assert.deepEqual(Object.keys(elemNew!).sort(), ["$meta", "BinProp", "BoolProp",
      "DblProp", "DtProp", "IntArrProp", "IntProp", "LastMod", "LongProp",
      "Pt2dProp", "Pt3dProp", "RelatedElem", "StrArrProp", "StrProp", "StructArrProp", "StructProp", "ECClassId", "ECInstanceId"].sort());
    assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());

    const elemOld = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.ECClassId, "TestDomain.Test2dElement");
    assert.equal(elemOld!.StrProp, "hello");
    assert.equal(elemOld!.IntProp, 42);
    assert.include(String(elemOld!.BinProp), "\"bytes\"");
    assert.deepEqual(elemOld!.RelatedElem, { Id: drawingCategoryId, RelECClassId: "TestDomain.Test2dUsesElement" });
    assert.equal(elemOld!.$meta.op, "Updated");
    assert.deepEqual(elemOld!.$meta.rowOptions, { classIdsToClassNames: true });

    assert.deepEqual(Object.keys(elemOld!).sort(), ["$meta", "BinProp", "BoolProp",
      "DblProp", "DtProp", "IntArrProp", "IntProp", "LastMod", "LongProp",
      "Pt2dProp", "Pt3dProp", "RelatedElem", "StrArrProp", "StrProp", "StructArrProp", "StructProp", "ECClassId", "ECInstanceId"].sort());
    assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());
  });
  it("should throw error if tried to fetch changeset metadata values before stepping", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    expect(() => reader.isECTable).to.throw();
    expect(() => reader.isIndirectChange).to.throw();
    expect(() => reader.tableName).to.throw();
    expect(() => reader.op).to.throw();
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    reader.close();
  });
  it("should throw error if tried to fetch changeset metadata values after stepping past the end", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    while (reader.step()) { }
    assert.equal(reader.step(), false);
    assert.equal(reader.step(), false); // trying multiple steps past the end should still return false and not throw, but metadata access should throw
    assert.equal(reader.step(), false);
    expect(() => reader.isECTable).to.throw();
    expect(() => reader.isIndirectChange).to.throw();
    expect(() => reader.tableName).to.throw();
    expect(() => reader.op).to.throw();
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    reader.close();
  });
});

describe("ChangesetReader delete-partial", () => {
  let rwIModel: BriefcaseDb;
  let partialElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;
  let txn: EditTxn;

  before(async () => {
    HubMock.startup("ECChangesetDeletePartial", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "deletePartial", description: "deletePartial", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "ChangesetReader delete-partial");
    // Txn 1: import schema + drawing model setup, then push
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <!-- Rich struct: scalar fields + nested point2d/3d sub-properties -->
      <ECStructClass typeName="RichPoint" modifier="Sealed">
          <ECProperty propertyName="X"     typeName="double"/>
          <ECProperty propertyName="Y"     typeName="double"/>
          <ECProperty propertyName="Z"     typeName="double"/>
          <ECProperty propertyName="Label" typeName="string"/>
          <ECProperty propertyName="Pt2d"  typeName="point2d"/>
          <ECProperty propertyName="Pt3d"  typeName="point3d"/>
      </ECStructClass>
      <!-- Relationship used by the RelatedElem navigation property -->
      <ECRelationshipClass typeName="Test2dUsesElement" strength="referencing" modifier="None">
          <Source multiplicity="(0..*)" roleLabel="uses" polymorphic="true"><Class class="Test2dElement"/></Source>
          <Target multiplicity="(0..1)" roleLabel="is used by" polymorphic="true"><Class class="bis:Element"/></Target>
      </ECRelationshipClass>
      <ECEntityClass typeName="Test2dElement">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <!-- Primitives -->
          <ECProperty propertyName="StrProp"        typeName="string"/>
          <ECProperty propertyName="IntProp"        typeName="int"/>
          <ECProperty propertyName="LongProp"       typeName="long"/>
          <ECProperty propertyName="DblProp"        typeName="double"/>
          <ECProperty propertyName="BoolProp"       typeName="boolean"/>
          <ECProperty propertyName="DtProp"         typeName="dateTime"/>
          <ECProperty propertyName="BinProp"        typeName="binary"/>
          <!-- Geometric primitives -->
          <ECProperty propertyName="Pt2dProp"       typeName="point2d"/>
          <ECProperty propertyName="Pt3dProp"       typeName="point3d"/>
          <!-- Struct, arrays -->
          <ECStructProperty      propertyName="StructProp"    typeName="RichPoint"/>
          <ECArrayProperty       propertyName="IntArrProp"    typeName="int"       minOccurs="0" maxOccurs="unbounded"/>
          <ECArrayProperty       propertyName="StrArrProp"    typeName="string"    minOccurs="0" maxOccurs="unbounded"/>
          <ECStructArrayProperty propertyName="StructArrProp" typeName="RichPoint" minOccurs="0" maxOccurs="unbounded"/>
          <!-- Navigation property -->
          <ECNavigationProperty propertyName="RelatedElem" relationshipName="Test2dUsesElement" direction="forward"/>
      </ECEntityClass>
  </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(txn, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    txn.saveChanges("setup");
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Txn 2: insert PARTIAL element
    partialElementId = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      // StrProp, IntProp, LongProp, DblProp, BoolProp, DtProp, BinProp intentionally absent
    } as any);
    txn.saveChanges("insert partial element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the delete txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rwIModel.locks.acquireLocks({ exclusive: partialElementId });
    txn.deleteElement(partialElementId);
    txn.saveChanges("delete partial element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("txn4 delete-partial | All_Properties | default rowOptions", () => {
    const instances = readTxn(rwIModel, txnId);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.isString(modelOld!.LastMod);
    assert.isString(modelOld!.GeometryGuid);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement (partial) Deleted Old ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isString(elem!.LastMod);
    assert.equal(elem!.CodeSpec.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeSpec.RelECClassId), "BisCore:CodeSpecSpecifiesCode");

    assert.equal(elem!.CodeScope.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeScope.RelECClassId), "BisCore:ElementScopesCode");
    assert.isString(elem!.FederationGuid);
    assert.equal(elem!.Category.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Category.RelECClassId), "BisCore:GeometricElement2dIsInCategory");
    // Partial element had no custom props at time of delete
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.IntProp);
    assert.isUndefined(elem!.Pt2dProp);
    assert.isUndefined(elem!.StructProp);
    assert.isUndefined(elem!.IntArrProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category",
    ].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), ["BBoxHigh", "BBoxLow", "BinProp", "BoolProp",
      "Category.Id", "CodeScope.Id", "CodeSpec.Id", "CodeValue", "DblProp", "DtProp", "ECClassId", "ECInstanceId", "FederationGuid", "GeometryStream",
      "IntArrProp", "IntProp", "JsonProperties", "LastMod", "LongProp", "Model.Id", "Origin", "Parent", "Pt2dProp", "Pt3dProp", "RelatedElem", "Rotation", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X", "StructProp.Y", "StructProp.Z", "TypeDefinition", "UserLabel"
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn4 delete-partial | Bis_Element_Properties", () => {
    const instances = readTxn(rwIModel, txnId, PropertyFilter.BisCoreElement, { classIdsToClassNames: true });
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "BisCore.DrawingModel");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "BisCore.DrawingModel");
    assert.isString(modelOld!.LastMod);
    assert.isString(modelOld!.GeometryGuid);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement (partial) Deleted Old ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal(elem!.ECClassId, "TestDomain.Test2dElement");
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.Category);
    expect(elem!.Model).to.exist;
    expect(elem!.LastMod).to.exist;
    expect(elem!.CodeSpec).to.exist;
    expect(elem!.CodeScope).to.exist;
    expect(elem!.FederationGuid).to.exist;
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.BisCoreElement);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), ["CodeScope.Id", "CodeSpec.Id", "CodeValue", "ECClassId", "ECInstanceId",
      "FederationGuid", "JsonProperties", "LastMod", "Model.Id", "Parent", "UserLabel"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn4 delete-partial | Instance_Key", () => {
    const instances = readTxn(rwIModel, txnId, PropertyFilter.InstanceKey);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // --- instances[2]: Test2dElement (partial) Deleted Old ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.Model);
    assert.isUndefined(elem!.LastMod);
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.InstanceKey);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), ['ECClassId', 'ECInstanceId'].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn4 delete-partial | rowOptions: classIdsToClassNames", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });

    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECClassId, "TestDomain.Test2dElement");
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "BisCore.ModelContainsElements" });
    assert.deepEqual(elem!.CodeSpec, { Id: "0x1", RelECClassId: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.CodeScope, { Id: "0x1", RelECClassId: "BisCore.ElementScopesCode" });
    assert.deepEqual(elem!.Category, { Id: drawingCategoryId, RelECClassId: "BisCore.GeometricElement2dIsInCategory" });
    assert.isUndefined(elem!.StrProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta", "Category",
    ].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true });
  });

  it("txn4 delete-partial | rowOptions: useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { useJsName: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelNew!.ECInstanceId);
    assert.deepEqual(modelNew!.$meta.rowOptions, { useJsName: true });

    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { useJsName: true });

    const elem = instances.find((i) => i.id === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elem!.ECInstanceId);
    assert.isUndefined(elem!.ECClassId);
    assert.deepEqual(elem!.model, { id: drawingModelId, relClassName: "BisCore.ModelContainsElements" });
    assert.deepEqual(elem!.codeSpec, { id: "0x1", relClassName: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.codeScope, { id: "0x1", relClassName: "BisCore.ElementScopesCode" });
    assert.deepEqual(elem!.category, { id: drawingCategoryId, relClassName: "BisCore.GeometricElement2dIsInCategory" });
    assert.isUndefined(elem!.strProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "id", "className", "model", "lastMod", "codeSpec", "codeScope", "federationGuid", "$meta", "category",
    ].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { useJsName: true });
  });

  it("txn4 delete-partial | rowOptions: abbreviateBlobs", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: true });

    // Partial element had no blobs; ECClassId still raw hex
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isUndefined(elem!.StrProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta", "Category",
    ].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { abbreviateBlobs: true });
  });

  it("txn4 delete-partial | rowOptions: classIdsToClassNames + useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true, useJsName: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelNew!.ECInstanceId);
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });

    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });

    const elem = instances.find((i) => i.id === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.className, "TestDomain.Test2dElement");
    assert.isUndefined(elem!.ECInstanceId);
    assert.deepEqual(elem!.model, { id: drawingModelId, relClassName: "BisCore.ModelContainsElements" });
    assert.deepEqual(elem!.codeSpec, { id: "0x1", relClassName: "BisCore.CodeSpecSpecifiesCode" });
    assert.deepEqual(elem!.codeScope, { id: "0x1", relClassName: "BisCore.ElementScopesCode" });
    assert.deepEqual(elem!.category, { id: drawingCategoryId, relClassName: "BisCore.GeometricElement2dIsInCategory" });
    assert.isUndefined(elem!.strProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "id", "className", "model", "lastMod", "codeSpec", "codeScope", "federationGuid", "$meta", "category",
    ].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
  });
  it("should throw error if tried to fetch changeset metadata values before stepping", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    expect(() => reader.isECTable).to.throw();
    expect(() => reader.isIndirectChange).to.throw();
    expect(() => reader.tableName).to.throw();
    expect(() => reader.op).to.throw();
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    reader.close();
  });
  it("should throw error if tried to fetch changeset metadata values after stepping past the end", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    while (reader.step()) { }
    assert.equal(reader.step(), false);
    assert.equal(reader.step(), false); // try stepping again after already stepping past the end
    assert.equal(reader.step(), false);
    expect(() => reader.isECTable).to.throw();
    expect(() => reader.isIndirectChange).to.throw();
    expect(() => reader.tableName).to.throw();
    expect(() => reader.op).to.throw();
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    reader.close();
  });
});

describe("ChangesetReader filters", () => {
  let rwIModel: BriefcaseDb;
  let fullElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;
  let txn: EditTxn;

  before(async () => {
    HubMock.startup("ECChangesetInsertFull", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "insertFull", description: "insertFull", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "ChangesetReader filters");
    // Txn 1: import schema + drawing model setup, then push
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <!-- Rich struct: scalar fields + nested point2d/3d sub-properties -->
      <ECStructClass typeName="RichPoint" modifier="Sealed">
          <ECProperty propertyName="X"     typeName="double"/>
          <ECProperty propertyName="Y"     typeName="double"/>
          <ECProperty propertyName="Z"     typeName="double"/>
          <ECProperty propertyName="Label" typeName="string"/>
          <ECProperty propertyName="Pt2d"  typeName="point2d"/>
          <ECProperty propertyName="Pt3d"  typeName="point3d"/>
      </ECStructClass>
      <!-- Relationship used by the RelatedElem navigation property -->
      <ECRelationshipClass typeName="Test2dUsesElement" strength="referencing" modifier="None">
          <Source multiplicity="(0..*)" roleLabel="uses" polymorphic="true"><Class class="Test2dElement"/></Source>
          <Target multiplicity="(0..1)" roleLabel="is used by" polymorphic="true"><Class class="bis:Element"/></Target>
      </ECRelationshipClass>
      <ECEntityClass typeName="Test2dElement">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <!-- Primitives -->
          <ECProperty propertyName="StrProp"        typeName="string"/>
          <ECProperty propertyName="IntProp"        typeName="int"/>
          <ECProperty propertyName="LongProp"       typeName="long"/>
          <ECProperty propertyName="DblProp"        typeName="double"/>
          <ECProperty propertyName="BoolProp"       typeName="boolean"/>
          <ECProperty propertyName="DtProp"         typeName="dateTime"/>
          <ECProperty propertyName="BinProp"        typeName="binary"/>
          <!-- Geometric primitives -->
          <ECProperty propertyName="Pt2dProp"       typeName="point2d"/>
          <ECProperty propertyName="Pt3dProp"       typeName="point3d"/>
          <!-- Struct, arrays -->
          <ECStructProperty      propertyName="StructProp"    typeName="RichPoint"/>
          <ECArrayProperty       propertyName="IntArrProp"    typeName="int"       minOccurs="0" maxOccurs="unbounded"/>
          <ECArrayProperty       propertyName="StrArrProp"    typeName="string"    minOccurs="0" maxOccurs="unbounded"/>
          <ECStructArrayProperty propertyName="StructArrProp" typeName="RichPoint" minOccurs="0" maxOccurs="unbounded"/>
          <!-- Navigation property -->
          <ECNavigationProperty propertyName="RelatedElem" relationshipName="Test2dUsesElement" direction="forward"/>
      </ECEntityClass>
  </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(txn, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    txn.saveChanges("setup");
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Txn 2: insert FULL element  every EC primitive type populated
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const geom: GeometryStreamProps = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ].map((a) => IModelJson.Writer.toIModelJson(a));

    fullElementId = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom,
      StrProp: "hello",
      IntProp: 42,
      LongProp: 9_007_199_254_740_991,   // Number.MAX_SAFE_INTEGER
      DblProp: 3.14159265358979,
      BoolProp: true,
      DtProp: "2024-01-15T12:00:00.000",
      BinProp: new Uint8Array([1, 2, 3, 4]),
      Pt2dProp: { x: 1.5, y: 2.5 },
      Pt3dProp: { x: 3.0, y: 4.0, z: 5.0 },
      StructProp: {
        X: 1.0, Y: 2.0, Z: 3.0, Label: "origin",
        Pt2d: { x: 0.5, y: 0.5 },
        Pt3d: { x: 1.0, y: 2.0, z: 3.0 },
      },
      IntArrProp: [10, 20, 30],
      StrArrProp: ["alpha", "beta", "gamma"],
      StructArrProp: [
        { X: 0.0, Y: 1.0, Z: 2.0, Label: "a", Pt2d: { x: 0.0, y: 0.0 }, Pt3d: { x: 0.0, y: 0.0, z: 0.0 } },
        { X: 3.0, Y: 4.0, Z: 5.0, Label: "b", Pt2d: { x: 1.0, y: 1.0 }, Pt3d: { x: 1.0, y: 1.0, z: 1.0 } },
      ],
      RelatedElem: { id: drawingCategoryId, relClassName: "TestDomain:Test2dUsesElement" },
    } as any);
    txn.saveChanges("insert full element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("txn1 insert-full | filter by table name", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    reader.setTableNameFilters(new Set(["bis_Model"]));
    while (reader.step())
      pcu.appendFrom(reader);
    const instances = Array.from(pcu.instances);
    assert.equal(instances.length, 2);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    // Object.keys
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.deepEqual([...modelNew!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.deepEqual([...modelNew!.$meta.changeIndexes].sort(), [1].sort());
    assert.isString(modelNew!.$meta.instanceKey);
    assert.equal(modelNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    // Object.keys
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.deepEqual([...modelOld!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);
  });

  it("txn1 insert-full | filter by operation name", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    reader.setOpCodeFilters(new Set(["Inserted"]));
    while (reader.step())
      pcu.appendFrom(reader);
    const instances = Array.from(pcu.instances);
    assert.equal(instances.length, 1);

    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal("TestDomain:Test2dElement", rwIModel.getClassNameFromId(elem!.ECClassId));
    assert.equal(elem!.Model.Id, drawingModelId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Model.RelECClassId), "BisCore:ModelContainsElements");
    assert.isString(elem!.LastMod);
    assert.equal(elem!.CodeSpec.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeSpec.RelECClassId), "BisCore:CodeSpecSpecifiesCode");

    assert.equal(elem!.CodeScope.Id, "0x1");
    assert.equal(rwIModel.getClassNameFromId(elem!.CodeScope.RelECClassId), "BisCore:ElementScopesCode");
    assert.isString(elem!.FederationGuid);

    assert.equal(elem!.Category.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.Category.RelECClassId), "BisCore:GeometricElement2dIsInCategory");
    assert.deepEqual(elem!.Origin, { X: 0, Y: 0 });
    assert.equal(elem!.Rotation, 0);
    assert.deepEqual(elem!.BBoxLow, { X: -25, Y: -25 });
    assert.deepEqual(elem!.BBoxHigh, { X: 15, Y: 15 });
    assert.include(String(elem!.GeometryStream), "\"bytes\"");
    assert.include(String(elem!.BinProp), "\"bytes\"");
    assert.equal(elem!.StrProp, "hello");
    assert.equal(elem!.IntProp, 42);
    assert.equal(elem!.LongProp, 9007199254740991);
    assert.closeTo(elem!.DblProp as number, 3.14159265358979, 1e-10);
    assert.equal(elem!.BoolProp, true);
    assert.equal(elem!.DtProp, "2024-01-15T12:00:00.000");
    assert.deepEqual(elem!.Pt2dProp, { X: 1.5, Y: 2.5 });
    assert.deepEqual(elem!.Pt3dProp, { X: 3, Y: 4, Z: 5 });
    assert.deepEqual(elem!.StructProp, { X: 1, Y: 2, Z: 3, Label: "origin", Pt2d: { X: 0.5, Y: 0.5 }, Pt3d: { X: 1, Y: 2, Z: 3 } });
    assert.deepEqual(elem!.IntArrProp, [10, 20, 30]);
    assert.deepEqual(elem!.StrArrProp, ["alpha", "beta", "gamma"]);
    assert.deepEqual(elem!.StructArrProp, [
      { X: 0, Y: 1, Z: 2, Label: "a", Pt2d: { X: 0, Y: 0 }, Pt3d: { X: 0, Y: 0, Z: 0 } },
      { X: 3, Y: 4, Z: 5, Label: "b", Pt2d: { X: 1, Y: 1 }, Pt3d: { X: 1, Y: 1, Z: 1 } },
    ]);
    assert.equal(elem!.RelatedElem.Id, drawingCategoryId);
    assert.equal(rwIModel.getClassNameFromId(elem!.RelatedElem.RelECClassId), "TestDomain:Test2dUsesElement");
    // Object.keys
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem", "BinProp"
    ].sort());
    // $meta keys
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.isString(elem!.$meta.instanceKey);
    assert.equal(elem!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(elem!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...elem!.$meta.changeFetchedPropNames].sort(), [
      'BBoxHigh', 'BBoxLow', 'BinProp', 'BoolProp', 'Category.Id', 'CodeScope.Id',
      'CodeSpec.Id', 'CodeValue', 'DblProp', 'DtProp', 'ECClassId', 'ECInstanceId',
      'FederationGuid', 'GeometryStream', 'IntArrProp', 'IntProp', 'JsonProperties',
      'LastMod', 'LongProp', 'Model.Id', 'Origin', 'Parent', 'Pt2dProp', 'Pt3dProp',
      'RelatedElem', 'Rotation', 'StrArrProp', 'StrProp', 'StructArrProp', 'StructProp.Label',
      'StructProp.Pt2d', 'StructProp.Pt3d', 'StructProp.X', 'StructProp.Y', 'StructProp.Z',
      'TypeDefinition', 'UserLabel'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
    assert.equal(elem!.$meta.isIndirectChange, false);
  });

  it("txn1 insert-full | filter by className", () => {
    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createSqliteBackedCache());
    reader.setClassNameFilters(new Set(["BisCore:DrawingModel"]));
    while (reader.step())
      pcu.appendFrom(reader);
    const instances = Array.from(pcu.instances);
    assert.equal(instances.length, 2);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelNew!.ECClassId));
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    // Object.keys
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.deepEqual([...modelNew!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.deepEqual([...modelNew!.$meta.changeIndexes].sort(), [1].sort());
    assert.isString(modelNew!.$meta.instanceKey);
    assert.equal(modelNew!.$meta.instanceKey.split(`-`).length, 2);
    assert.equal(modelNew!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal("BisCore:DrawingModel", rwIModel.getClassNameFromId(modelOld!.ECClassId));
    // Object.keys
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "instanceKey", "propFilter", "changeFetchedPropNames", "rowOptions", "isIndirectChange"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.deepEqual([...modelOld!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.equal(modelOld!.$meta.propFilter, PropertyFilter.All);
    assert.deepEqual([...modelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});
    assert.equal(modelOld!.$meta.isIndirectChange, true);
  });
});

describe("ChangesetReader — openFile + openGroup", () => {
  let rwIModel: BriefcaseDb;
  let rwIModelId: string;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txn: EditTxn;

  before(async () => {
    HubMock.startup("ECChangesetOpenFileGroup", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "openFileGroup", description: "openFileGroup", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

    txn = startTestTxn(rwIModel, "ChangesetReader setup");

    // Push 1: import schema + drawing model setup
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <ECEntityClass typeName="SimpleElement">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <!-- Simple binary -->
          <ECProperty propertyName="BinProp" typeName="binary"/>
          <!-- Point3d -->
          <ECProperty propertyName="Pt3dProp" typeName="point3d"/>
          <!-- Array of GUIDs stored as strings -->
          <ECArrayProperty propertyName="GuidArrProp" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
      </ECEntityClass>
  </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "OpenFileDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "OpenFileCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(txn, IModel.dictionaryId, "OpenFileCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,128,255)").toJSON() }));

    txn.saveChanges("setup");
    await rwIModel.pushChanges({ description: "setup", accessToken: adminToken });
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("openFile reads insert and update changesets independently; openGroup reads both as a stream", async () => {
    const adminToken = "super manager token";
    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // --- Push 2: insert element — only Y and Z set on Pt3dProp, X omitted (defaults to 0) ---
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const elementId: Id64String = txn.insertElement({
      classFullName: "TestDomain:SimpleElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      Pt3dProp: { y: 2.5, z: 3.7 },
      BinProp: new Uint8Array([1, 2, 3, 4]),
      GuidArrProp: [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ],
    } as any);
    txn.saveChanges("insert element");
    await rwIModel.pushChanges({ description: "insert element", accessToken: adminToken });


    let changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    expect(changesets.length).to.equal(2);
    const insertCs = changesets[1];
    // === openFile: insert changeset ===
    {
      using reader = ChangesetReader.openFile({ db: rwIModel, fileName: insertCs.pathname, rowOptions: { abbreviateBlobs: false } });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      expect(elemNew).to.exist;
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "propFilter", "rowOptions", "changeFetchedPropNames", "instanceKey", "isIndirectChange"].sort());
      assert.equal(elemNew!.$meta.op, "Inserted");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.deepEqual(elemNew!.$meta.tables.sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
      assert.deepEqual(elemNew!.$meta.propFilter, PropertyFilter.All);
      assert.deepEqual(elemNew!.$meta.changeIndexes.sort(), [1, 2].sort());
      assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: false });
      assert.equal(elemNew!.$meta.isIndirectChange, false);

      expect(elemNew!.Category).to.exist;
      expect(elemNew!.CodeScope).to.exist;
      expect(elemNew!.CodeSpec).to.exist;
      expect(elemNew!.LastMod).to.exist;
      expect(elemNew!.Model).to.exist;
      expect(elemNew!.FederationGuid).to.exist;
      assert.isUndefined(elemNew!.Pt3dProp);
      assert.isNotNull(elemNew!.BinProp);
      assert.deepEqual(elemNew!.BinProp, new Uint8Array([1, 2, 3, 4]));
      assert.deepEqual(elemNew!.GuidArrProp, [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ]);
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Model", "CodeSpec",
        "CodeScope", "FederationGuid", "$meta", "Category", "LastMod",
        "BinProp", "GuidArrProp"].sort())
      assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp',
        'Category.Id', 'CodeScope.Id', 'CodeSpec.Id', 'CodeValue',
        'ECClassId', 'ECInstanceId', 'FederationGuid', 'GeometryStream', 'GuidArrProp',
        'JsonProperties', 'LastMod', 'Model.Id', 'Origin', 'Parent', 'Pt3dProp', 'Rotation',
        'TypeDefinition', 'UserLabel'].sort());
    }

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the update txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // --- Push 3: update element — change all custom props ---
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    txn.updateElement({
      ...rwIModel.elements.getElementProps(elementId),
      Pt3dProp: { x: 1.0, y: 9.9, z: 7.7 },
      BinProp: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
      GuidArrProp: [
        "ffffffff-0000-1111-2222-333344445555",
      ],
    });
    txn.saveChanges("update element");
    await rwIModel.pushChanges({ description: "update element", accessToken: adminToken });

    // Download all changesets: [setup(0), insert(1), update(2)]
    changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    expect(changesets.length).to.equal(3);
    const updateCs = changesets[2];

    // === openFile: update changeset ===
    {
      using reader = ChangesetReader.openFile({ db: rwIModel, fileName: updateCs.pathname, rowOptions: { abbreviateBlobs: false } });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      const elemOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
      expect(elemNew).to.exist;
      expect(elemOld).to.exist;
      assert.equal(elemNew!.$meta.op, "Updated");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.equal(elemNew!.$meta.propFilter, PropertyFilter.All);
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "propFilter", "rowOptions", "changeFetchedPropNames", "instanceKey", "isIndirectChange"].sort());
      assert.equal(elemNew!.$meta.isIndirectChange, false);
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Origin",
        "Rotation", "BBoxLow", "BBoxHigh", "Pt3dProp", "BinProp", "GuidArrProp", "$meta", "LastMod"].sort());
      assert.deepEqual(elemNew!.Pt3dProp, { X: 1, Y: 9.9, Z: 7.7 });
      assert.deepEqual(elemNew!.BinProp, new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]));
      assert.deepEqual(elemNew!.GuidArrProp, ["ffffffff-0000-1111-2222-333344445555"]);
      assert.deepEqual(elemNew!.Origin, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.BBoxLow, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.BBoxHigh, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.Rotation, 0);
      expect(elemNew!.LastMod).to.exist;
      assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp', 'ECInstanceId', 'GuidArrProp', 'LastMod', 'Origin', 'Pt3dProp', 'Rotation'].sort());

      assert.equal(elemOld!.$meta.op, "Updated");
      assert.equal(elemOld!.$meta.stage, "Old");
      assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "propFilter", "rowOptions", "changeFetchedPropNames", "instanceKey", "isIndirectChange"].sort());
      assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "BinProp", "GuidArrProp", "$meta",
        "LastMod"].sort());
      assert.deepEqual(elemOld!.BinProp, new Uint8Array([1, 2, 3, 4]));
      assert.deepEqual(elemOld!.GuidArrProp, [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ]);
      assert.equal(elemOld!.$meta.isIndirectChange, false);
      expect(elemOld!.LastMod).to.exist;
      assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp', 'ECInstanceId', 'GuidArrProp', 'LastMod', 'Origin', 'Pt3dProp', 'Rotation'].sort());
    }

    // === openGroup: insert + update as a single stream ===
    // After merging, the elem New key is shared between insert-New and update-New;
    // the update-New wins on overlapping props, so the final New reflects the updated state.
    // elem Old only comes from the update changeset.
    {
      using reader = ChangesetReader.openGroup({ db: rwIModel, changesetFiles: [insertCs.pathname, updateCs.pathname], rowOptions: { abbreviateBlobs: false } });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      const elemOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
      expect(elemNew).to.exist;
      expect(elemOld).to.not.exist;
      // New merges insert + update; final values are from the update
      assert.deepEqual(elemNew!.Pt3dProp, { X: 1, Y: 9.9, Z: 7.7 });
      assert.deepEqual(elemNew!.BinProp, new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]));
      assert.deepEqual(elemNew!.GuidArrProp, ["ffffffff-0000-1111-2222-333344445555"]);
      assert.deepEqual(elemNew!.Origin, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.BBoxLow, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.BBoxHigh, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.Rotation, 0);
      expect(elemNew!.LastMod).to.exist;
      expect(elemNew!.Category).to.exist;
      expect(elemNew!.CodeScope).to.exist;
      expect(elemNew!.CodeSpec).to.exist;
      expect(elemNew!.LastMod).to.exist;
      expect(elemNew!.Model).to.exist;
      expect(elemNew!.FederationGuid).to.exist;
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "propFilter", "rowOptions", "changeFetchedPropNames", "instanceKey", "isIndirectChange"].sort());
      assert.equal(elemNew!.$meta.op, "Inserted");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.deepEqual(elemNew!.$meta.tables.sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
      assert.deepEqual(elemNew!.$meta.propFilter, PropertyFilter.All);
      assert.deepEqual(elemNew!.$meta.changeIndexes.sort(), [1, 2].sort());
      assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: false });
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Model", "CodeSpec",
        "CodeScope", "FederationGuid", "$meta", "Category", "LastMod",
        "BinProp", "GuidArrProp", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "Pt3dProp"].sort());
      assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ['BBoxHigh', 'BBoxLow',
        'BinProp', 'Category.Id', 'CodeScope.Id', 'CodeSpec.Id',
        'CodeValue', 'ECClassId', 'ECInstanceId', 'FederationGuid', 'GeometryStream',
        'GuidArrProp', 'JsonProperties', 'LastMod', 'Model.Id', 'Origin', 'Parent', 'Pt3dProp',
        'Rotation', 'TypeDefinition', 'UserLabel'].sort());
      assert.equal(elemNew!.$meta.isIndirectChange, false);
    }
  });
});

describe("ChangesetReader — openLocalChanges + openInmemoryChanges", () => {
  let rwIModel: BriefcaseDb;
  let rwIModelId: string;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txn: EditTxn;

  before(async () => {
    HubMock.startup("ECChangesetOpenFileGroup", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "openFileGroup", description: "openFileGroup", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "ChangesetReader setup");
    // Push 1: import schema + drawing model setup
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <ECEntityClass typeName="SimpleElement">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <!-- Simple binary -->
          <ECProperty propertyName="BinProp" typeName="binary"/>
          <!-- Point3d -->
          <ECProperty propertyName="Pt3dProp" typeName="point3d"/>
          <!-- Array of GUIDs stored as strings -->
          <ECArrayProperty propertyName="GuidArrProp" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
      </ECEntityClass>
  </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "OpenFileDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "OpenFileCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(txn, IModel.dictionaryId, "OpenFileCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,128,255)").toJSON() }));

    txn.saveChanges("setup");
    await rwIModel.pushChanges({ description: "setup", accessToken: adminToken });
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("opens local and in-memory changes", async () => {
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const elementId: Id64String = txn.insertElement({
      classFullName: "TestDomain:SimpleElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      Pt3dProp: { y: 2.5, z: 3.7 },
      BinProp: new Uint8Array([1, 2, 3, 4]),
      GuidArrProp: [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ],
    } as any);
    txn.saveChanges("insert element");


    // === openFile: insert changeset ===
    {
      using reader = ChangesetReader.openLocalChanges({ db: rwIModel, rowOptions: { abbreviateBlobs: false } });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createSqliteBackedCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      expect(elemNew).to.exist;
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "propFilter", "rowOptions", "changeFetchedPropNames", "instanceKey", "isIndirectChange"].sort());
      assert.equal(elemNew!.$meta.op, "Inserted");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.deepEqual(elemNew!.$meta.tables.sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
      assert.deepEqual(elemNew!.$meta.propFilter, PropertyFilter.All);
      assert.deepEqual(elemNew!.$meta.changeIndexes.sort(), [1, 2].sort());
      assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: false });
      assert.equal(elemNew!.$meta.isIndirectChange, false);

      expect(elemNew!.Category).to.exist;
      expect(elemNew!.CodeScope).to.exist;
      expect(elemNew!.CodeSpec).to.exist;
      expect(elemNew!.LastMod).to.exist;
      expect(elemNew!.Model).to.exist;
      expect(elemNew!.FederationGuid).to.exist;
      assert.isUndefined(elemNew!.Pt3dProp);
      assert.isNotNull(elemNew!.BinProp);
      assert.deepEqual(elemNew!.BinProp, new Uint8Array([1, 2, 3, 4]));
      assert.deepEqual(elemNew!.GuidArrProp, [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ]);
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Model", "CodeSpec",
        "CodeScope", "FederationGuid", "$meta", "Category", "LastMod",
        "BinProp", "GuidArrProp"].sort())
      assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp',
        'Category.Id', 'CodeScope.Id', 'CodeSpec.Id', 'CodeValue',
        'ECClassId', 'ECInstanceId', 'FederationGuid', 'GeometryStream', 'GuidArrProp',
        'JsonProperties', 'LastMod', 'Model.Id', 'Origin', 'Parent', 'Pt3dProp', 'Rotation',
        'TypeDefinition', 'UserLabel'].sort());
    }
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the update txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // --- Push 3: update element — change all custom props ---
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    txn.updateElement({
      ...rwIModel.elements.getElementProps(elementId),
      Pt3dProp: { x: 1.0, y: 9.9, z: 7.7 },
      BinProp: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
      GuidArrProp: [
        "ffffffff-0000-1111-2222-333344445555",
      ],
    });

    // === openFile: update changeset ===
    {
      using reader = ChangesetReader.openInMemoryChanges({ db: rwIModel, rowOptions: { abbreviateBlobs: false } });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createSqliteBackedCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      const elemOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
      expect(elemNew).to.exist;
      expect(elemOld).to.exist;
      assert.equal(elemNew!.$meta.op, "Updated");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.equal(elemNew!.$meta.propFilter, PropertyFilter.All);
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "propFilter", "rowOptions", "changeFetchedPropNames", "instanceKey", "isIndirectChange"].sort());
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Origin",
        "Rotation", "BBoxLow", "BBoxHigh", "Pt3dProp", "BinProp", "GuidArrProp", "$meta", "LastMod"].sort());
      assert.deepEqual(elemNew!.Pt3dProp, { X: 1, Y: 9.9, Z: 7.7 });
      assert.deepEqual(elemNew!.BinProp, new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]));
      assert.deepEqual(elemNew!.GuidArrProp, ["ffffffff-0000-1111-2222-333344445555"]);
      assert.deepEqual(elemNew!.Origin, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.BBoxLow, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.BBoxHigh, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.Rotation, 0);
      expect(elemNew!.LastMod).to.exist;
      assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp', 'ECInstanceId', 'GuidArrProp', 'LastMod', 'Origin', 'Pt3dProp', 'Rotation'].sort());
      assert.equal(elemNew!.$meta.isIndirectChange, false);

      assert.equal(elemOld!.$meta.op, "Updated");
      assert.equal(elemOld!.$meta.stage, "Old");
      assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "propFilter", "rowOptions", "changeFetchedPropNames", "instanceKey", "isIndirectChange"].sort());
      assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "BinProp", "GuidArrProp", "$meta",
        "LastMod"].sort());
      assert.deepEqual(elemOld!.BinProp, new Uint8Array([1, 2, 3, 4]));
      assert.deepEqual(elemOld!.GuidArrProp, [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ]);
      expect(elemOld!.LastMod).to.exist;
      assert.equal(elemOld!.$meta.isIndirectChange, false);
      assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp', 'ECInstanceId', 'GuidArrProp', 'LastMod', 'Origin', 'Pt3dProp', 'Rotation'].sort());
    }

    // === openGroup: insert + update as a single stream ===
    // After merging, the elem New key is shared between insert-New and update-New;
    // the update-New wins on overlapping props, so the final New reflects the updated state.
    // elem Old only comes from the update changeset.
    {
      using reader = ChangesetReader.openLocalChanges({ db: rwIModel, includeInMemoryChanges: true, rowOptions: { abbreviateBlobs: false } });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createSqliteBackedCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      const elemOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
      expect(elemNew).to.exist;
      expect(elemOld).to.not.exist;
      // New merges insert + update; final values are from the update
      assert.deepEqual(elemNew!.Pt3dProp, { X: 1, Y: 9.9, Z: 7.7 });
      assert.deepEqual(elemNew!.BinProp, new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]));
      assert.deepEqual(elemNew!.GuidArrProp, ["ffffffff-0000-1111-2222-333344445555"]);
      assert.deepEqual(elemNew!.Origin, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.BBoxLow, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.BBoxHigh, { X: 0, Y: 0 });
      assert.deepEqual(elemNew!.Rotation, 0);
      expect(elemNew!.LastMod).to.exist;
      expect(elemNew!.Category).to.exist;
      expect(elemNew!.CodeScope).to.exist;
      expect(elemNew!.CodeSpec).to.exist;
      expect(elemNew!.LastMod).to.exist;
      expect(elemNew!.Model).to.exist;
      expect(elemNew!.FederationGuid).to.exist;
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "propFilter", "rowOptions", "changeFetchedPropNames", "instanceKey", "isIndirectChange"].sort());
      assert.equal(elemNew!.$meta.op, "Inserted");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.deepEqual(elemNew!.$meta.tables.sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
      assert.deepEqual(elemNew!.$meta.propFilter, PropertyFilter.All);
      assert.deepEqual(elemNew!.$meta.changeIndexes.sort(), [1, 2].sort());
      assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: false });
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Model", "CodeSpec",
        "CodeScope", "FederationGuid", "$meta", "Category", "LastMod",
        "BinProp", "GuidArrProp", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "Pt3dProp"].sort());
      assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ['BBoxHigh', 'BBoxLow',
        'BinProp', 'Category.Id', 'CodeScope.Id', 'CodeSpec.Id',
        'CodeValue', 'ECClassId', 'ECInstanceId', 'FederationGuid', 'GeometryStream',
        'GuidArrProp', 'JsonProperties', 'LastMod', 'Model.Id', 'Origin', 'Parent', 'Pt3dProp',
        'Rotation', 'TypeDefinition', 'UserLabel'].sort());
      assert.equal(elemNew!.$meta.isIndirectChange, false);
    }
  });
});

describe("ChangesetReader: behaviour in case imodel is not in sync with changeset file being read", async () => {
  let rwIModel: BriefcaseDb;
  let rwIModelId: string;
  let elementId: Id64String;
  let drawingModelId: Id64String;
  let categoryId1: Id64String;
  let categoryId2: Id64String;
  let txn: EditTxn;

  before(async () => {
    HubMock.startup("ChangesetReaderBugsTest", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "bugTest", description: "BugTest", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "ChangesetReaderBugsTest setup");
    // Push 1: import schema + set up drawing model and two categories
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="point2d"/>
        </ECEntityClass>
    </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);

    categoryId1 = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "Category1")
      ?? DrawingCategory.insert(txn, IModel.dictionaryId, "Category1", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    categoryId2 = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "Category2")
      ?? DrawingCategory.insert(txn, IModel.dictionaryId, "Category2", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,0,255)").toJSON() }));

    txn.saveChanges("setup");
    await rwIModel.pushChanges({ description: "setup", accessToken: adminToken });
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("openFile() reads the middle changeset of an insert → update → delete lifecycle", async () => {
    const adminToken = "super manager token";
    // Push 2 (insert): insert element with category1
    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];
    const geometryStream: GeometryStreamProps = [];
    for (const geom of geomArray)
      geometryStream.push(IModelJson.Writer.toIModelJson(geom));

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    elementId = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: categoryId1,
      code: Code.createEmpty(),
      geom: geometryStream,
      s: { x: 1.5, y: 2.5 },
    } as any);
    assert.isTrue(Id64.isValidId64(elementId));
    txn.saveChanges("insert element");
    await rwIModel.pushChanges({ description: "insert element", accessToken: adminToken });

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the update txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Push 3 (update): change category to category2
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    txn.updateElement({
      ...rwIModel.elements.getElementProps(elementId),
      category: categoryId2,
    });
    txn.saveChanges("update element");
    await rwIModel.pushChanges({ description: "update element", accessToken: adminToken });

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the delete txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Push 4 (delete): delete the element
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    txn.deleteElement(elementId);
    txn.saveChanges("delete element");
    await rwIModel.pushChanges({ description: "delete element", accessToken: adminToken });
    // changesets: [setup, insert, update, delete] — 4 total; index 2 = update changeset
    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    expect(changesets.length).to.equal(4);
    const middleChangeset = changesets[Math.floor(changesets.length / 2)]; // index 2 = update

    using reader = ChangesetReader.openFile({ db: rwIModel, fileName: middleChangeset.pathname, propFilter: PropertyFilter.InstanceKey, rowOptions: { classIdsToClassNames: true } });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step())
      pcu.appendFrom(reader);

    const instances = Array.from(pcu.instances);

    const bisElementOld = instances.filter((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
    const bisElementNew = instances.filter((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
    expect(bisElementOld).to.exist;
    expect(bisElementNew).to.exist;
    expect(bisElementOld).to.have.lengthOf(2);
    expect(bisElementNew).to.have.lengthOf(2);
    // Why this is happening?
    // We have deleted the instance from the db when the changeset is opened
    // So we are unable to fetch the correct classId for the instance
    // and it is defaulting to the base class of the deleted instance which is "BisCore.Element" and "BisCore.GeometricElement2d" instead of "TestDomain.Test2dElement"
    // If the instance had not been deleted, we would have been able to fetch the correct classId for the instance and it would have been "TestDomain.Test2dElement"
    // And we would have just two entries for the instance with classId "TestDomain.Test2dElement" , one wioth stage "New" and other with "old"
    expect(bisElementNew.map((i => i.ECClassId)).sort()).to.deep.equal(["BisCore.GeometricElement2d", "BisCore.Element"].sort());
    expect(bisElementOld.map((i => i.ECClassId)).sort()).to.deep.equal(["BisCore.GeometricElement2d", "BisCore.Element"].sort());
  });

  it("openTxn() reads the middle txn of an insert → update → update lifecycle", async () => {
    // Push 2 (insert): insert element with category1
    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];
    const geometryStream: GeometryStreamProps = [];
    for (const geom of geomArray)
      geometryStream.push(IModelJson.Writer.toIModelJson(geom));

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    elementId = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: categoryId1,
      code: Code.createEmpty(),
      geom: geometryStream,
      s: { x: 1.5, y: 2.5 },
    } as any);
    assert.isTrue(Id64.isValidId64(elementId));
    txn.saveChanges("insert element");
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the update txn
    await new Promise((resolve) => setTimeout(resolve, 300));

    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    txn.updateElement({
      ...rwIModel.elements.getElementProps(elementId),
      s: { x: 100.0, y: 2.5 },
    });
    txn.saveChanges("update element");
    const txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
    assert.isTrue(Id64.isValidId64(txnId));

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the update txn
    await new Promise((resolve) => setTimeout(resolve, 300));

    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    txn.updateElement({
      ...rwIModel.elements.getElementProps(elementId),
      s: { x: 100.0, y: 200.0 },
    });
    txn.saveChanges("update element");

    using reader = ChangesetReader.openTxn({ db: rwIModel, txnId });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step())
      pcu.appendFrom(reader);

    const instances = Array.from(pcu.instances);

    const elementOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
    const elementNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
    expect(elementOld).to.exist;
    expect(elementNew).to.exist;
    // Here as we can see that we correctly captured old value of s.X which is 1.5 and new value of s.X which is 100.0
    // But the Y value, though same is a bit different, it is 200
    // Because in liveDB we have done another tyransaction after the one which we have opened
    // In that transaction we have updated the Y value to 200, so when we are fetching the changes for the opened transaction,
    // we are getting the latest value of Y which is 200 instead of 2.5
    assert.deepEqual(elementOld!.s, { X: 1.5, Y: 200 });
    assert.deepEqual(elementNew!.s, { X: 100, Y: 200 });
    // But we can find the exact stuff which actually changed and which we fetched from the changeset and not the live DB
    // using the changeFetchedPropNames, we can find that only s.X was changed in the changeset and s.Y was not changed in the changeset.
    expect(elementNew!.$meta.changeFetchedPropNames).to.include("s.X");
    expect(elementNew!.$meta.changeFetchedPropNames).to.not.include("s.Y");
    expect(elementOld!.$meta.changeFetchedPropNames).to.include("s.X");
    expect(elementOld!.$meta.changeFetchedPropNames).to.not.include("s.Y");
  });
});

describe("ChangesetReader: overflow table graceful recovery when ExclusiveRootClassId is NULL", () => {
  let rwIModel: BriefcaseDb;
  let rwIModelId: string;
  let txn: EditTxn;
  let updateChangesetPathname: string;
  let id: string;

  before(async () => {
    HubMock.startup("ECChangesetOverflowNull", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const nProps = 36; // enough to spill into the overflow table

    rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "overflowNull", description: "OverflowNull", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "overflow null test");

    // Import schema with class that spans the overflow table (36 properties)
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            ${Array(nProps).fill(undefined).map((_, i) => `<ECProperty propertyName="p${i}" typeName="string"/>`).join("\n")}
        </ECEntityClass>
    </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "OverflowNullCat");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(txn, IModel.dictionaryId, "OverflowNullCat", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    const geom: GeometryStreamProps = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ].map((a) => IModelJson.Writer.toIModelJson(a));

    const props = Array(nProps).fill(undefined).map((_, i) => ({ [`p${i}`]: `test_${i}` })).reduce((acc, curr) => ({ ...acc, ...curr }), {});

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Push 1: insert element
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    id = txn.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom,
      ...props,
    } as any);
    assert.isTrue(Id64.isValidId64(id));
    txn.saveChanges();
    await rwIModel.pushChanges({ description: "insert element", accessToken: adminToken });

    // Push 2: update element — this is the changeset we will read against the broken iModel
    const updatedProps = Object.assign(
      rwIModel.elements.getElementProps(id),
      Array(nProps).fill(undefined).map((_, i) => ({ [`p${i}`]: `updated_${i}` })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
    );
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the update txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rwIModel.locks.acquireLocks({ exclusive: id });
    txn.updateElement(updatedProps);
    txn.saveChanges();
    await rwIModel.pushChanges({ description: "update element", accessToken: adminToken });

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the delete txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Push 3: delete element (so the iModel is out of sync when we re-read push 2)
    await rwIModel.locks.acquireLocks({ exclusive: id });
    txn.deleteElement(id);
    txn.saveChanges();
    await rwIModel.pushChanges({ description: "delete element", accessToken: adminToken });

    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    // changesets: [insert, update, delete] — index 1 = update changeset
    updateChangesetPathname = changesets[1].pathname;
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("openFile() recovers gracefully when ExclusiveRootClassId is NULL for overflow table", () => {
    /**
     * Simulate the broken state: clear ExclusiveRootClassId so the reader cannot
     * determine which derived class owns the overflow table rows.
     * The reader should fall back gracefully rather than crashing, and still
     * produce inserted/deleted instances for the overflow table rows.
     */
    expect(
      rwIModel[_nativeDb].executeSql("UPDATE ec_Table SET ExclusiveRootClassId=NULL WHERE Name='bis_GeometricElement2d_Overflow'"),
    ).to.equal(DbResult.BE_SQLITE_OK);

    let assertedOnOverflowTable = false;

    using reader = ChangesetReader.openFile({ db: rwIModel, fileName: updateChangesetPathname });
    while (reader.step()) {
      if (reader.tableName !== "bis_GeometricElement2d_Overflow")
        continue;

      assert.equal(reader.op, "Updated");

      // inserted (New stage)
      expect(reader.inserted).to.exist;
      assert.deepEqual(reader.inserted!.$meta.tables, ["bis_GeometricElement2d_Overflow"]);
      assert.equal(reader.inserted!.$meta.op, "Updated");
      assert.equal(reader.inserted!.$meta.stage, "New");
      assert.equal(reader.inserted!.ECInstanceId, id);
      assert.equal(rwIModel.getClassNameFromId(reader.inserted!.ECClassId), "BisCore:GeometricElement2d");

      // deleted (Old stage)
      expect(reader.deleted).to.exist;
      assert.deepEqual(reader.deleted!.$meta.tables, ["bis_GeometricElement2d_Overflow"]);
      assert.equal(reader.deleted!.$meta.op, "Updated");
      assert.equal(reader.deleted!.$meta.stage, "Old");
      assert.equal(reader.deleted!.ECInstanceId, id);
      assert.equal(rwIModel.getClassNameFromId(reader.deleted!.ECClassId), "BisCore:GeometricElement2d");

      assertedOnOverflowTable = true;
    }

    assert.isTrue(assertedOnOverflowTable, "Expected at least one row from the overflow table");
  });
});

describe("ChangesetReader: instance reused with a different class (class change in Updated row)", () => {
  it("openFile() correctly identifies ECClassId change from T1 to T2 in a buggy changeset", async () => {
    /**
     * Same scenario as ChangesetReader.test.ts: "Instance update to a different class (bug)".
     * Verifies ChangesetReader behaviour when an instance ID is reused with a different class.
     *
     * Steps:
     * 1. Import schema with two classes (T1 and T2) that inherit from GraphicalElement2d.
     *    - T1 has property 'p' of type string
     *    - T2 has property 'p' of type long
     * 2. Insert a T1 element, push changeset #1.
     * 3. Delete the T1 element, reset the ID sequence to force ID reuse, insert T2 with same ID, push changeset #2.
     *
     * ChangesetReader should:
     * - Report op=Updated for bis_Element and bis_GeometricElement2d rows.
     * - inserted.ECClassId resolves to T2, deleted.ECClassId resolves to T1.
     * - Property p: inserted carries the T2 integer value (1111), deleted carries the T1 string value ("wwww").
     */
    HubMock.startup("ChangesetReaderClassChange", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;

    const modelId = await HubMock.createNewIModel({ iTwinId, iModelName: "classChange", description: "ClassChange", accessToken: adminToken });
    assert.isNotEmpty(modelId);

    let b1 = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: modelId, accessToken: adminToken });
    let txn = startTestTxn(b1, "class change test");

    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="T1">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="p" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="T2">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="p" typeName="long"/>
        </ECEntityClass>
    </ECSchema>`;

    await importSchemaStrings(txn, [schema]);
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(b1, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(txn, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    const geom: GeometryStreamProps = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ].map((a) => IModelJson.Writer.toIModelJson(a));

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Push 1: insert T1 element
    await b1.locks.acquireLocks({ shared: drawingModelId });
    const elId = txn.insertElement({
      classFullName: "TestDomain:T1",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom,
      p: "wwww",
    } as any);
    assert.isTrue(Id64.isValidId64(elId));
    txn.saveChanges();
    await b1.pushChanges({ description: "insert element" });

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the delete txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Push 2: delete T1 element, reset ID sequence to force same ID, insert T2
    await b1.locks.acquireLocks({ shared: drawingModelId, exclusive: elId });
    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    txn.deleteElement(elId);
    txn.saveChanges();

    // Force ID sequence so the next insert reuses elId
    const bid = BigInt(elId) - 1n;
    b1[_nativeDb].saveLocalValue("bis_elementidsequence", bid.toString());
    txn.saveChanges();
    const fileName = b1[_nativeDb].getFilePath();
    txn.end();
    b1.close();

    b1 = await BriefcaseDb.open({ fileName });
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    txn = startTestTxn(b1, "class change test reopened");

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the INSERT txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    const elId2 = txn.insertElement({
      classFullName: "TestDomain:T2",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom,
      p: 1111,
    } as any);
    expect(elId2).to.equal(elId);
    txn.saveChanges();
    await b1.pushChanges({ description: "buggy changeset" });

    const targetDir = path.join(KnownTestLocations.outputDir, modelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId: modelId, targetDir });
    expect(changesets.length).to.equal(2);
    expect(changesets[0].description).to.equal("insert element");
    expect(changesets[1].description).to.equal("buggy changeset");

    // ChangesetReader reads ECClassId from the changeset data for each stage,
    // so it correctly sees T2 for the new (inserted) side and T1 for the old (deleted) side.
    let bisElementAsserted = false;
    let bisGeomElement2dAsserted = false;

    using reader = ChangesetReader.openFile({ db: b1, fileName: changesets[1].pathname });
    while (reader.step()) {
      if (reader.tableName === "bis_Element" && reader.op === "Updated") {
        bisElementAsserted = true;
        expect(reader.inserted).to.exist;
        expect(reader.deleted).to.exist;
        // ECInstanceId: PK was not changed in the update — only available on the Old side
        assert.equal(reader.deleted!.ECInstanceId, elId);
        // ECClassId correctly reflects the class change
        assert.equal(b1.getClassNameFromId(reader.inserted!.ECClassId), "TestDomain:T2");
        assert.equal(b1.getClassNameFromId(reader.deleted!.ECClassId), "TestDomain:T1");
      }
      if (reader.tableName === "bis_GeometricElement2d" && reader.op === "Updated") {
        bisGeomElement2dAsserted = true;
        expect(reader.inserted).to.exist;
        expect(reader.deleted).to.exist;
        // ECClassId correctly reflects the class change
        assert.equal(b1.getClassNameFromId(reader.inserted!.ECClassId), "TestDomain:T2");
        assert.equal(b1.getClassNameFromId(reader.deleted!.ECClassId), "TestDomain:T1");
        // Property 'p': T2 declares it as long (integer), T1 as string
        assert.equal(reader.inserted!.p, 1111);
        assert.equal(reader.deleted!.p, "wwww");
      }
    }

    assert.isTrue(bisElementAsserted, "Expected an Updated row in bis_Element");
    assert.isTrue(bisGeomElement2dAsserted, "Expected an Updated row in bis_GeometricElement2d");

    txn.end();
    b1.close();
    HubMock.shutdown();
  });
});

describe("ChangesetReader: overflow table insert and update and delete", () => {
  let rwIModel: BriefcaseDb;
  let elementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let insertTxnId: string;
  let updateTxnId: string;
  let txn: EditTxn;

  const nProps = 36;
  const propName = (i: number) => `p${i}`;
  const insertVal = (i: number) => `insert-${i}`;
  const updateVal = (i: number) => `updated-${i}`;

  before(async () => {
    HubMock.startup("ECChangesetOverflowInsertUpdate", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "overflowInsertUpdate", description: "overflowInsertUpdate", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    txn = startTestTxn(rwIModel, "ChangesetReader overflow insert/update");

    // 36 string properties — enough to spill columns into bis_GeometricElement2d_Overflow
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="OverflowElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            ${Array.from({ length: nProps }, (_, i) => `<ECProperty propertyName="${propName(i)}" typeName="string"/>`).join("\n            ")}
        </ECEntityClass>
    </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "OverflowDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true);
    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "OverflowCat");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(txn, IModel.dictionaryId, "OverflowCat",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,128,0)").toJSON() }));
    txn.saveChanges("setup");

    // Txn 2: insert element with every property populated
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const geom: GeometryStreamProps = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
    ].map((a) => IModelJson.Writer.toIModelJson(a));
    const insertProps = Object.fromEntries(Array.from({ length: nProps }, (_, i) => [propName(i), insertVal(i)]));
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the insert txn
    await new Promise((resolve) => setTimeout(resolve, 300));

    elementId = txn.insertElement({
      classFullName: "TestDomain:OverflowElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom,
      ...insertProps,
    } as any);
    txn.saveChanges("insert overflow element");
    insertTxnId = rwIModel.txns.getLastSavedTxnProps()!.id;

    // Wait so that LastMod on bis_Model gets a distinct timestamp before the UPDATE txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Txn 3: update only the overflow-table properties (p34, p35 — the last two)
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    txn.updateElement({
      ...rwIModel.elements.getElementProps(elementId),
      [propName(34)]: updateVal(34),
      [propName(35)]: updateVal(35),
    });
    txn.saveChanges("update overflow props");
    updateTxnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
    txn.end();
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("txn | bis_GeometricElement2d_Overflow rows merged; overflow props correct in New and Old", async () => {
    // --- update txn ---
    const updateInstances = readTxn(rwIModel, updateTxnId, undefined, { classIdsToClassNames: true });
    assert.equal(updateInstances.length, 4);

    // DrawingModel Updated New (indirect side-effect)
    const updateModelNew = updateInstances.find((i) => i.ECClassId === "BisCore.DrawingModel" && i.$meta.stage === "New");
    expect(updateModelNew).to.exist;
    assert.equal(updateModelNew!.$meta.op, "Updated");
    assert.isString(updateModelNew!.LastMod);
    assert.deepEqual(Object.keys(updateModelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual([...updateModelNew!.$meta.tables], ["bis_Model"]);
    assert.deepEqual([...updateModelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(updateModelNew!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(updateModelNew!.$meta.isIndirectChange, true);

    // DrawingModel Updated Old
    const updateModelOld = updateInstances.find((i) => i.ECClassId === "BisCore.DrawingModel" && i.$meta.stage === "Old");
    expect(updateModelOld).to.exist;
    assert.equal(updateModelOld!.$meta.op, "Updated");
    assert.isString(updateModelOld!.LastMod);
    assert.deepEqual(Object.keys(updateModelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual([...updateModelOld!.$meta.tables], ["bis_Model"]);
    assert.deepEqual([...updateModelOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.equal(updateModelOld!.$meta.isIndirectChange, true);

    // OverflowElement Updated New
    const elemNew = updateInstances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.ECClassId, "TestDomain.OverflowElement");
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.isIndirectChange, false);
    assert.deepEqual(elemNew!.$meta.rowOptions, { classIdsToClassNames: true });
    // Only bis_Element (LastMod) and bis_GeometricElement2d_Overflow (p34, p35) were touched
    assert.deepEqual([...elemNew!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d_Overflow"].sort());
    assert.deepEqual([...elemNew!.$meta.changeIndexes].sort(), [1, 2].sort());
    // changeFetchedPropNames: only the props that changed
    assert.deepEqual([...elemNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "p34", "p35"].sort());
    // New stage has updated values for the two overflow props
    assert.equal(elemNew![propName(34)], updateVal(34));
    assert.equal(elemNew![propName(35)], updateVal(35));
    // Other props (p0–p33) are not present — not part of the delta
    assert.isUndefined(elemNew![propName(0)]);
    assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "p34", "p35", "$meta"].sort());

    // OverflowElement Updated Old
    const elemOld = updateInstances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.ECClassId, "TestDomain.OverflowElement");
    assert.equal(elemOld!.$meta.op, "Updated");
    assert.equal(elemOld!.$meta.isIndirectChange, false);
    assert.deepEqual([...elemOld!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d_Overflow"].sort());
    assert.deepEqual([...elemOld!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "p34", "p35"].sort());
    // Old stage has the pre-update (insert) values for the two overflow props
    assert.equal(elemOld![propName(34)], insertVal(34));
    assert.equal(elemOld![propName(35)], insertVal(35));
    assert.isUndefined(elemOld![propName(0)]);
    assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "p34", "p35", "$meta"].sort());

    // --- insert txn ---
    const insertInstances = readTxn(rwIModel, insertTxnId, undefined, { classIdsToClassNames: true });
    assert.equal(insertInstances.length, 3);

    // DrawingModel Updated New (indirect side-effect of inserting into the model)
    const modelNew = insertInstances.find((i) => i.ECClassId === "BisCore.DrawingModel" && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual([...modelNew!.$meta.tables], ["bis_Model"]);
    assert.deepEqual([...modelNew!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(modelNew!.$meta.isIndirectChange, true);

    // DrawingModel Updated Old
    const modelOld = insertInstances.find((i) => i.ECClassId === "BisCore.DrawingModel" && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual([...modelOld!.$meta.tables], ["bis_Model"]);
    assert.equal(modelOld!.$meta.isIndirectChange, true);

    // OverflowElement Inserted New — key assertions
    const insertElem = insertInstances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
    expect(insertElem).to.exist;
    assert.equal(insertElem!.ECClassId, "TestDomain.OverflowElement");
    assert.equal(insertElem!.$meta.op, "Inserted");
    assert.equal(insertElem!.$meta.stage, "New");
    assert.equal(insertElem!.$meta.isIndirectChange, false);
    assert.deepEqual(insertElem!.$meta.rowOptions, { classIdsToClassNames: true });

    // All three physical tables (including overflow) contributed to this insert
    assert.deepEqual([...insertElem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d", "bis_GeometricElement2d_Overflow"].sort());
    assert.deepEqual([...insertElem!.$meta.changeIndexes].sort(), [1, 2, 3].sort());

    // changeFetchedPropNames includes all 36 domain props
    const fetchedProps = [...insertElem!.$meta.changeFetchedPropNames];
    for (let i = 0; i < nProps; i++) {
      assert.include(fetchedProps, propName(i), `changeFetchedPropNames should contain p${i}`);
    }

    // All 36 domain props carry the insert values
    for (let i = 0; i < nProps; i++) {
      assert.equal(insertElem![propName(i)], insertVal(i), `p${i} should be '${insertVal(i)}'`);
    }

    // Spot-check BIS properties
    assert.equal(insertElem!.Model.Id, drawingModelId);
    assert.equal(insertElem!.Model.RelECClassId, "BisCore.ModelContainsElements");
    assert.equal(insertElem!.Category.Id, drawingCategoryId);
    assert.equal(insertElem!.Category.RelECClassId, "BisCore.GeometricElement2dIsInCategory");
    assert.equal(insertElem!.CodeSpec.Id, "0x1");
    assert.equal(insertElem!.CodeSpec.RelECClassId, "BisCore.CodeSpecSpecifiesCode");
    assert.equal(insertElem!.CodeScope.Id, "0x1");
    assert.equal(insertElem!.CodeScope.RelECClassId, "BisCore.ElementScopesCode");
    assert.isString(insertElem!.FederationGuid);
    assert.isString(insertElem!.LastMod);
    assert.deepEqual(insertElem!.Origin, { X: 0, Y: 0 });
    assert.equal(insertElem!.Rotation, 0);
    assert.deepEqual(insertElem!.BBoxLow, { X: -5, Y: -5 });
    assert.deepEqual(insertElem!.BBoxHigh, { X: 5, Y: 5 });
    assert.include(String(insertElem!.GeometryStream), "\"bytes\"");

    // --- delete txn ---
    // Wait so that LastMod on bis_Model gets a distinct timestamp before the delete txn
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    txn.deleteElement(elementId);
    txn.saveChanges("delete overflow element");
    const deleteTxnId = rwIModel.txns.getLastSavedTxnProps()!.id;

    const deleteInstances = readTxn(rwIModel, deleteTxnId, undefined, { classIdsToClassNames: true });
    // DrawingModel Updated New + Old (indirect) + OverflowElement Deleted Old
    assert.equal(deleteInstances.length, 3);

    // DrawingModel Updated New (indirect side-effect)
    const updateModelNewForDelete = deleteInstances.find((i) => i.ECClassId === "BisCore.DrawingModel" && i.$meta.stage === "New");
    expect(updateModelNewForDelete).to.exist;
    assert.equal(updateModelNewForDelete!.$meta.op, "Updated");
    assert.isString(updateModelNewForDelete!.LastMod);
    assert.isString(updateModelNewForDelete!.GeometryGuid);
    assert.deepEqual(Object.keys(updateModelNewForDelete!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta", "GeometryGuid"].sort());
    assert.deepEqual([...updateModelNewForDelete!.$meta.tables], ["bis_Model"]);
    assert.deepEqual([...updateModelNewForDelete!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(updateModelNewForDelete!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.equal(updateModelNewForDelete!.$meta.isIndirectChange, true);

    // DrawingModel Updated Old
    const updateModelOldForDelete = deleteInstances.find((i) => i.ECClassId === "BisCore.DrawingModel" && i.$meta.stage === "Old");
    expect(updateModelOldForDelete).to.exist;
    assert.equal(updateModelOldForDelete!.$meta.op, "Updated");
    assert.isString(updateModelOldForDelete!.LastMod);
    assert.isString(updateModelNewForDelete!.GeometryGuid);
    assert.deepEqual(Object.keys(updateModelOldForDelete!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta", "GeometryGuid"].sort());
    assert.deepEqual([...updateModelOldForDelete!.$meta.tables], ["bis_Model"]);
    assert.deepEqual([...updateModelOldForDelete!.$meta.changeFetchedPropNames].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.equal(updateModelOldForDelete!.$meta.isIndirectChange, true);

    // OverflowElement Deleted Old
    const deletedElemOld = deleteInstances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
    expect(deletedElemOld).to.exist;
    assert.equal(deletedElemOld!.ECClassId, "TestDomain.OverflowElement");
    assert.equal(deletedElemOld!.$meta.op, "Deleted");
    assert.equal(deletedElemOld!.$meta.stage, "Old");
    assert.equal(deletedElemOld!.$meta.isIndirectChange, false);
    assert.deepEqual(deletedElemOld!.$meta.rowOptions, { classIdsToClassNames: true });

    // All three physical tables contributed to the delete row
    assert.deepEqual([...deletedElemOld!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d", "bis_GeometricElement2d_Overflow"].sort());

    // All 36 domain props are recorded in changeFetchedPropNames
    const deleteFetchedProps = [...deletedElemOld!.$meta.changeFetchedPropNames];
    for (let i = 0; i < nProps; i++) {
      assert.include(deleteFetchedProps, propName(i), `changeFetchedPropNames should contain p${i}`);
    }

    // p0–p33 still carry the original insert values; p34/p35 carry the updated values
    for (let i = 0; i < 34; i++) {
      assert.equal(deletedElemOld![propName(i)], insertVal(i), `p${i} should be '${insertVal(i)}'`);
    }
    assert.equal(deletedElemOld![propName(34)], updateVal(34));
    assert.equal(deletedElemOld![propName(35)], updateVal(35));

    // Spot-check BIS properties
    assert.equal(deletedElemOld!.Model.Id, drawingModelId);
    assert.equal(deletedElemOld!.Model.RelECClassId, "BisCore.ModelContainsElements");
    assert.equal(deletedElemOld!.Category.Id, drawingCategoryId);
    assert.equal(deletedElemOld!.Category.RelECClassId, "BisCore.GeometricElement2dIsInCategory");
    assert.equal(deletedElemOld!.CodeSpec.Id, "0x1");
    assert.equal(deletedElemOld!.CodeSpec.RelECClassId, "BisCore.CodeSpecSpecifiesCode");
    assert.equal(deletedElemOld!.CodeScope.Id, "0x1");
    assert.equal(deletedElemOld!.CodeScope.RelECClassId, "BisCore.ElementScopesCode");
    assert.isString(deletedElemOld!.FederationGuid);
    assert.isString(deletedElemOld!.LastMod);
    assert.deepEqual(deletedElemOld!.Origin, { X: 0, Y: 0 });
    assert.equal(deletedElemOld!.Rotation, 0);
    assert.deepEqual(deletedElemOld!.BBoxLow, { X: -5, Y: -5 });
    assert.deepEqual(deletedElemOld!.BBoxHigh, { X: 5, Y: 5 });
    assert.include(String(deletedElemOld!.GeometryStream), "\"bytes\"");
  });
});

describe("ChangesetReader: invalid inputs", () => {
  let iModel: BriefcaseDb;
  let txn: EditTxn;
  let validChangesetPath: string;

  before(async () => {
    HubMock.startup("ChangesetReaderInvalidInputs", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "invalidInputs", accessToken: adminToken });
    iModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: adminToken });
    txn = startTestTxn(iModel, "ChangesetReader invalid inputs setup");
    iModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Push one changeset so we have a valid .changeset file to reference.
    await iModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, Code.createEmpty(), true);
    txn.saveChanges("setup");
    await iModel.pushChanges({ description: "setup", accessToken: adminToken });

    const targetDir = path.join(KnownTestLocations.outputDir, iModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId, targetDir });
    assert.isAtLeast(changesets.length, 1);
    validChangesetPath = changesets[0].pathname;
  });

  after(() => {
    txn.end();
    iModel?.close();
    HubMock.shutdown();
  });

  // --- openFile ---

  it("openFile: non-existent file path throws", () => {
    expect(() =>
      ChangesetReader.openFile({ db: iModel, fileName: "/does/not/exist.changeset" }),
    ).to.throw();
  });

  it("openFile: empty file name throws", () => {
    expect(() =>
      ChangesetReader.openFile({ db: iModel, fileName: "" }),
    ).to.throw();
  });

  it("openFile: path points to a directory throws", () => {
    expect(() =>
      ChangesetReader.openFile({ db: iModel, fileName: KnownTestLocations.outputDir }),
    ).to.throw();
  });

  it("openFile: path points to a plain text file (not .changeset) throws", () => {
    const txtFile = path.join(KnownTestLocations.outputDir, "not_a_changeset.txt");
    // Write a small non-changeset file and expect the reader to reject it.
    fs.writeFileSync(txtFile, "this is not a changeset");

    using reader = ChangesetReader.openFile({ db: iModel, fileName: txtFile });
    assert.equal(reader.step(), false, "Expected step() to return false for an invalid changeset file");
    assert.equal(reader.step(), false, "Expected step() to return false for an invalid changeset file");
    assert.equal(reader.step(), false, "Expected step() to return false for an invalid changeset file");
    assert.equal(reader.step(), false, "Expected step() to return false for an invalid changeset file");
  });

  // --- openGroup ---

  it("openGroup: empty changesetFiles array throws synchronously", () => {
    expect(() =>
      ChangesetReader.openGroup({ db: iModel, changesetFiles: [] }),
    ).to.throw();
  });

  it("openGroup: single non-existent path throws", () => {
    expect(() =>
      ChangesetReader.openGroup({ db: iModel, changesetFiles: ["/does/not/exist.changeset"] }),
    ).to.throw();
  });

  it("openGroup: first file valid, second file non-existent throws", () => {
    expect(() =>
      ChangesetReader.openGroup({ db: iModel, changesetFiles: [validChangesetPath, "/does/not/exist.changeset"] }),
    ).to.throw();
  });

  it("openGroup: file list containing an empty string throws", () => {
    expect(() =>
      ChangesetReader.openGroup({ db: iModel, changesetFiles: [""] }),
    ).to.throw();
  });

  it("openGroup: duplicate paths reads the same changeset twice without throwing", () => {
    // Passing the same changeset file twice is unusual but not necessarily an error at open time.
    // The reader should open and step without throwing; the caller is responsible for any semantic issues.
    expect(() => {
      using reader = ChangesetReader.openGroup({ db: iModel, changesetFiles: [validChangesetPath, validChangesetPath] });
      while (reader.step()) { /* drain */ }
    }).to.not.throw();
  });

  // --- openTxn ---

  it("openTxn: non-existent txn id throws", () => {
    expect(() =>
      ChangesetReader.openTxn({ db: iModel, txnId: "0xdeadbeef" }),
    ).to.throw();
  });

  it("openTxn: empty string txn id throws", () => {
    expect(() =>
      ChangesetReader.openTxn({ db: iModel, txnId: "" }),
    ).to.throw();
  });

  // --- property accessors before step() ---

  it("accessing tableName before step() throws", () => {
    using reader = ChangesetReader.openFile({ db: iModel, fileName: validChangesetPath });
    expect(() => reader.tableName).to.throw();
  });

  it("accessing isECTable before step() throws", () => {
    using reader = ChangesetReader.openFile({ db: iModel, fileName: validChangesetPath });
    expect(() => reader.isECTable).to.throw();
  });

  it("accessing isIndirectChange before step() throws", () => {
    using reader = ChangesetReader.openFile({ db: iModel, fileName: validChangesetPath });
    expect(() => reader.isIndirectChange).to.throw();
  });
});

