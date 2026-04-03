/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString, Id64, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";
import { assert, expect } from "chai";
import { DrawingCategory } from "../../Category";
import { ChannelControl } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { ECChangesetReader, ECNativeChangeInstance, ECNativeChangeUnifierCache, ECNativePartialChangeUnifier } from "../../ECChangesetReader";
import { IModelJsNative } from "../../core-backend";
import * as path from "node:path";
import { HubWrappers, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

// describe("ECChangesetReader API", async () => {
//   let iTwinId: GuidString;

//   before(() => {
//     HubMock.startup("ECChangesetReaderTest", KnownTestLocations.outputDir);
//     iTwinId = HubMock.iTwinId;
//   });

//   after(() => HubMock.shutdown());

//   it("openTxn() reads a saved transaction", async () => {
//     const adminToken = "super manager token";
//     const iModelName = "test";
//     const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
//     assert.isNotEmpty(rwIModelId);
//     const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

//     // Import schema
//     const schema = `<?xml version="1.0" encoding="UTF-8"?>
//     <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
//         <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
//         <ECEntityClass typeName="Test2dElement">
//             <BaseClass>bis:GraphicalElement2d</BaseClass>
//             <ECProperty propertyName="s" typeName="string"/>
//         </ECEntityClass>
//     </ECSchema>`;
//     await rwIModel.importSchemaStrings([schema]);
//     rwIModel.saveChanges("import schema");
//     await rwIModel.pushChanges({ description: "import schema", accessToken: adminToken });
//     rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

//     // Setup drawing partition + category
//     await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
//     const codeProps = Code.createEmpty();
//     codeProps.value = "DrawingModel";
//     const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
//     let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
//     if (undefined === drawingCategoryId)
//       drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

//     rwIModel.saveChanges("setup drawing partition");
//     await rwIModel.pushChanges({ description: "setup drawing partition", accessToken: adminToken });

//     // Build geometry stream
//     const geomArray: Arc3d[] = [
//       Arc3d.createXY(Point3d.create(0, 0), 5),
//       Arc3d.createXY(Point3d.create(5, 5), 2),
//       Arc3d.createXY(Point3d.create(-5, -5), 20),
//     ];
//     const geometryStream: GeometryStreamProps = [];
//     for (const geom of geomArray) {
//       const arcData = IModelJson.Writer.toIModelJson(geom);
//       geometryStream.push(arcData);
//     }

//     // Insert element
//     await rwIModel.locks.acquireLocks({ shared: drawingModelId });
//     const elementId: Id64String = rwIModel.elements.insertElement({
//       classFullName: "TestDomain:Test2dElement",
//       model: drawingModelId,
//       category: drawingCategoryId,
//       code: Code.createEmpty(),
//       geom: geometryStream,
//       s: "hello",
//     } as any);
//     assert.isTrue(Id64.isValidId64(elementId));

//     // Save — do NOT push, so the txn is still local
//     rwIModel.saveChanges("insert element");

//     // Open the last saved txn via ECChangesetReader
//     const txnId = rwIModel.txns.getLastSavedTxnProps()?.id as string;
//     expect(txnId).to.not.be.undefined;

//     using reader = ECChangesetReader.openTxn({ db: rwIModel, txnId });
//     using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
//     while (reader.step()) {
//       pcu.appendFrom(reader);
//     }

//     const instances = Array.from(pcu.instances);
//     // DrawingModel Updated (New + Old) + Test2dElement Inserted = 3 instances
//     assert.equal(instances.length, 3);

//     // --- Inserted Test2dElement ---
//     const inserted = instances.find((i) => i.ECInstanceId === elementId);
//     assert.isDefined(inserted, "inserted element must be present");
//     assert.equal(inserted!.$meta.op, "Inserted");
//     assert.equal(inserted!.$meta.stage, "New");
//     assert.isArray(inserted!.$meta.tables);
//     assert.isNotEmpty(inserted!.$meta.tables);
//     assert.isArray(inserted!.$meta.changeIndexes);
//     assert.isNotEmpty(inserted!.$meta.changeIndexes);
//     assert.isString(inserted!.$meta.nativeKey);
//     assert.equal(inserted!.s, "hello");
//     assert.equal(inserted!.Rotation, 0);
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     assert.deepEqual(inserted!.Origin, { X: 0, Y: 0 });
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     assert.deepEqual(inserted!.BBoxLow, { X: -25, Y: -25 });
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     assert.deepEqual(inserted!.BBoxHigh, { X: 15, Y: 15 });
//     assert.deepEqual(inserted!.GeometryStream, "{\"bytes\":123}");
//     assert.typeOf(inserted!.FederationGuid, "string");
//     assert.typeOf(inserted!.LastMod, "string");
//     assert.equal(inserted!.Category.Id, drawingCategoryId);
//     assert.isNotEmpty(inserted!.Category.RelECClassId);

//     // --- DrawingModel Updated (New + Old) ---
//     const modelInstances = instances.filter((i) => i.ECInstanceId === drawingModelId);
//     assert.equal(modelInstances.length, 2);
//     const modelNew = modelInstances.find((i) => i.$meta.stage === "New");
//     const modelOld = modelInstances.find((i) => i.$meta.stage === "Old");
//     assert.isDefined(modelNew);
//     assert.isDefined(modelOld);
//     assert.equal(modelNew!.$meta.op, "Updated");
//     assert.equal(modelOld!.$meta.op, "Updated");
//     assert.isNotNull(modelNew!.LastMod);
//     assert.isUndefined(modelOld!.LastMod);

//     rwIModel.close();
//   });
// });

// -------------------------------------------------------------------------------------------------
// Drill-down suite: four local txns × three modes × rowOptions variants
// See core/backend/src/ECChangesetReader-txn-drilldown-plan.md for the full spec.
// -------------------------------------------------------------------------------------------------

/** Open a txn, drive the unifier, log and return all merged instances. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readTxn(
  db: any,
  txnId: string,
  mode?: IModelJsNative.ECChangesetReader.Mode,
  rowOptions?: IModelJsNative.ECSqlRowAdaptorOptions,
): ECNativeChangeInstance[] {
  using reader = ECChangesetReader.openTxn({ db, txnId, mode, rowOptions });
  using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
  while (reader.step())
    pcu.appendFrom(reader);
  const instances = Array.from(pcu.instances);
  return instances;
}

describe("ECChangesetReader â€” insert-full", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rwIModel: any;
  let fullElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;

  before(async () => {
    HubMock.startup("ECChangesetInsertFull", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "insertFull", description: "insertFull", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

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
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(rwIModel, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    rwIModel.saveChanges("setup");

    // Txn 2: insert FULL element â€” every EC primitive type populated
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const geom: GeometryStreamProps = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ].map((a) => IModelJson.Writer.toIModelJson(a));

    fullElementId = rwIModel.elements.insertElement({
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
    rwIModel.saveChanges("insert full element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
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
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    // Object.keys
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.deepEqual([...modelNew!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.deepEqual([...modelNew!.$meta.changeIndexes].sort(), [3].sort());
    assert.equal(modelNew!.$meta.nativeKey, `${drawingModelId}-0xaf`);
    assert.equal(modelNew!.$meta.mode, 0);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    // Object.keys
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    // $meta keys
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.deepEqual([...modelOld!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.equal(modelOld!.$meta.mode, 0);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal(elem!.ECClassId, "0x176");
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "0x63" });
    assert.isString(elem!.LastMod);
    assert.deepEqual(elem!.CodeSpec, { Id: "0x1", RelECClassId: "0x6b" });
    assert.deepEqual(elem!.CodeScope, { Id: "0x1", RelECClassId: "0x6d" });
    assert.isString(elem!.FederationGuid);
    assert.deepEqual(elem!.Category, { Id: drawingCategoryId, RelECClassId: "0x6f" });
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
    assert.deepEqual(elem!.RelatedElem, { Id: drawingCategoryId, RelECClassId: "0x177" });
    // Object.keys
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem", "BinProp"
    ].sort());
    // $meta keys
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${fullElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps].sort(), [
      'BBoxHigh', 'BBoxLow', 'BinProp', 'BoolProp', 'Category.Id', 'CodeScope.Id',
      'CodeSpec.Id', 'CodeValue', 'DblProp', 'DtProp', 'ECClassId', 'ECInstanceId',
      'FederationGuid', 'GeometryStream', 'IntArrProp', 'IntProp', 'JsonProperties',
      'LastMod', 'LongProp', 'Model.Id', 'Origin', 'Parent', 'Pt2dProp', 'Pt3dProp',
      'RelatedElem', 'Rotation', 'StrArrProp', 'StrProp', 'StructArrProp', 'StructProp.Label',
      'StructProp.Pt2d', 'StructProp.Pt3d', 'StructProp.X', 'StructProp.Y', 'StructProp.Z',
      'TypeDefinition', 'UserLabel'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
  });

  it("txn1 insert-full | Bis_Element_Properties", () => {
    const instances = readTxn(rwIModel, txnId, IModelJsNative.ECChangesetReader.Mode.Bis_Element_Properties);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 1);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 1);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement Inserted New (Bis_Element_Properties: no custom props) ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal(elem!.ECClassId, "0x176");
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
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${fullElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 1);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "ECClassId"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
  });

  it("txn1 insert-full | Instance_Key", () => {
    const instances = readTxn(rwIModel, txnId, IModelJsNative.ECChangesetReader.Mode.Instance_Key);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.deepEqual([...modelNew!.$meta.tables].sort(), ["bis_Model"].sort());
    assert.deepEqual([...modelNew!.$meta.changeIndexes].sort(), [3].sort());
    assert.equal(modelNew!.$meta.nativeKey, `${drawingModelId}-0xaf`);
    assert.equal(modelNew!.$meta.mode, 2);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 2);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement Inserted New (only ECInstanceId + ECClassId) ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal(elem!.ECClassId, "0x176");
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.Model);
    assert.isUndefined(elem!.Category);
    assert.isUndefined(elem!.LastMod);
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${fullElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 2);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "ECClassId"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
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
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 0);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true });

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "BisCore.DrawingModel");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 0);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true });

    // --- instances[2]: Test2dElement Inserted New (ECClassId + all RelECClassId = class names) ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal(elem!.ECClassId, "TestDomain.Test2dElement");
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
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true });
    assert.deepEqual([...elem!.$meta.changesetFetchedProps].sort(),
      ["ECInstanceId", "ECClassId", "Model.Id", "LastMod", "CodeSpec.Id", "CodeScope.Id",
        "CodeValue", "UserLabel", "Parent", "FederationGuid", "JsonProperties", "Category.Id",
        "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream", "TypeDefinition", "StrProp",
        "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp", "BinProp", "Pt2dProp", "Pt3dProp",
        "StructProp.X", "StructProp.Y", "StructProp.Z", "StructProp.Label", "StructProp.Pt2d",
        "StructProp.Pt3d", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem"].sort());
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
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 0);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { useJsName: true });

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.id, drawingModelId);
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelOld!.ECInstanceId);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["id", "className", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 0);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { useJsName: true });

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
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps].sort(), [
      'BBoxHigh', 'BBoxLow', 'BinProp', 'BoolProp', 'Category.Id', 'CodeScope.Id',
      'CodeSpec.Id', 'CodeValue', 'DblProp', 'DtProp', 'ECClassId',
      'ECInstanceId', 'FederationGuid', 'GeometryStream', 'IntArrProp', 'IntProp',
      'JsonProperties', 'LastMod', 'LongProp', 'Model.Id', 'Origin', 'Parent', 'Pt2dProp',
      'Pt3dProp', 'RelatedElem', 'Rotation', 'StrArrProp', 'StrProp', 'StructArrProp', 'StructProp.Label',
      'StructProp.Pt2d', 'StructProp.Pt3d', 'StructProp.X', 'StructProp.Y',
      'StructProp.Z', 'TypeDefinition', 'UserLabel'
    ].sort());
    assert.deepEqual(elem!.$meta.rowOptions, { useJsName: true });
  });

  it("txn1 | rowOptions: abbreviateBlobs", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: true });
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf"); // still raw hex
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 0);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: true });

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 0);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: true });

    // --- instances[2]: Test2dElement Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, fullElementId);
    assert.equal(elem!.ECClassId, "0x176"); // still raw hex (no classIdsToClassNames)
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "0x63" });
    assert.isString(elem!.LastMod);
    assert.deepEqual(elem!.CodeSpec, { Id: "0x1", RelECClassId: "0x6b" });
    assert.deepEqual(elem!.CodeScope, { Id: "0x1", RelECClassId: "0x6d" });
    assert.isString(elem!.FederationGuid);
    assert.deepEqual(elem!.Category, { Id: drawingCategoryId, RelECClassId: "0x6f" });
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
    assert.deepEqual(elem!.RelatedElem, { Id: drawingCategoryId, RelECClassId: "0x177" });
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta",
      "Category", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "GeometryStream",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem", "BinProp"
    ].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual(elem!.$meta.rowOptions, { abbreviateBlobs: true });
  });

  it("txn1 | rowOptions: classIdsToClassNames + useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true, useJsName: true });
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
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 0);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.id === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.id, drawingModelId);
    assert.equal(modelOld!.className, "BisCore.DrawingModel");
    assert.isUndefined(modelOld!.ECInstanceId);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["id", "className", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 0);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });

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
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps].sort(), [
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
  });
});

describe("ECChangesetReader â€” insert-partial", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rwIModel: any;
  let partialElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;

  before(async () => {
    HubMock.startup("ECChangesetInsertPartial", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "insertPartial", description: "insertPartial", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

    // Txn 1: import schema + drawing model setup, then push
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <!-- Rich struct: scalar fields + nested point2d/3d sub-properties -.
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
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(rwIModel, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    rwIModel.saveChanges("setup");

    // Txn 2: insert PARTIAL element â€” only mandatory props
    partialElementId = rwIModel.elements.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      // StrProp, IntProp, LongProp, DblProp, BoolProp, DtProp, BinProp intentionally absent
    } as any);
    rwIModel.saveChanges("insert partial element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
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
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 0);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    // Model Old has LastMod and GeometryGuid when previous txn's model New values survive
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 0);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement (partial) Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal(elem!.ECClassId, "0x176");
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "0x63" });
    assert.isString(elem!.LastMod);
    assert.deepEqual(elem!.CodeSpec, { Id: "0x1", RelECClassId: "0x6b" });
    assert.deepEqual(elem!.CodeScope, { Id: "0x1", RelECClassId: "0x6d" });
    assert.isString(elem!.FederationGuid);
    assert.deepEqual(elem!.Category, { Id: drawingCategoryId, RelECClassId: "0x6f" });
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
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${partialElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps].sort(), [
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
  });

  it("txn2 insert-partial | Bis_Element_Properties", () => {
    const instances = readTxn(rwIModel, txnId, IModelJsNative.ECChangesetReader.Mode.Bis_Element_Properties);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 1);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 1);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement (partial) Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal(elem!.ECClassId, "0x176");
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.IntProp);
    assert.isUndefined(elem!.Model);
    assert.isUndefined(elem!.Category);
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${partialElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 1);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "ECClassId"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
  });

  it("txn2 insert-partial | Instance_Key", () => {
    const instances = readTxn(rwIModel, txnId, IModelJsNative.ECChangesetReader.Mode.Instance_Key);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 2);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 2);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement (partial) Inserted New ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal(elem!.ECClassId, "0x176");
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.Model);
    assert.isUndefined(elem!.LastMod);
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.stage, "New");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${partialElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 2);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "ECClassId"].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
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
    assert.equal(elem!.$meta.mode, 0);
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
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual(elem!.$meta.rowOptions, { useJsName: true });
  });

  it("txn2 insert-partial | rowOptions: abbreviateBlobs", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECClassId, "0xaf"); // still raw hex
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: true });

    // Partial element has no blob props; ECClassId stays as raw hex
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "New");
    expect(elem).to.exist;
    assert.equal(elem!.ECClassId, "0x176");
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "0x63" });
    assert.isUndefined(elem!.StrProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta", "Category",
    ].sort());
    assert.equal(elem!.$meta.op, "Inserted");
    assert.equal(elem!.$meta.mode, 0);
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
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
  });

});


describe("ECChangesetReader â€” update-full", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rwIModel: any;
  let fullElementId: Id64String;
  let partialElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;

  before(async () => {
    HubMock.startup("ECChangesetUpdateFull", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "updateFull", description: "updateFull", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

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
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(rwIModel, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    rwIModel.saveChanges("setup");

    // Txn 2: insert FULL element (needed as update target)
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const geom: GeometryStreamProps = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ].map((a) => IModelJson.Writer.toIModelJson(a));

    fullElementId = rwIModel.elements.insertElement({
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
    rwIModel.saveChanges("insert full element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;

    // Txn 3: insert PARTIAL element (needed as RelatedElem target in the update)
    partialElementId = rwIModel.elements.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      // StrProp, IntProp, LongProp, DblProp, BoolProp, DtProp, BinProp intentionally absent
    } as any);
    rwIModel.saveChanges("insert partial element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;

    // Txn 4: update FULL element â€” this is the txn under test
    // Txn 3: update FULL element — change several property types
    await rwIModel.locks.acquireLocks({ exclusive: fullElementId });
    rwIModel.elements.updateElement({
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
    } as any);
    rwIModel.saveChanges("update full element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("txn3 update-full | All_Properties | default rowOptions", () => {
    const instances = readTxn(rwIModel, txnId);
    assert.equal(instances.length, 4);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.isString(modelNew!.LastMod);
    assert.isUndefined(modelNew!.GeometryGuid); // no GeometryGuid in update txn model row
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 0);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.isString(modelOld!.LastMod);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 0);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

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
    assert.deepEqual(elemNew!.RelatedElem, { Id: partialElementId, RelECClassId: "0x177" });
    assert.isString(elemNew!.LastMod);
    // Object.keys — update row: custom-prop columns first, then $meta and LastMod at the end
    assert.deepEqual(Object.keys(elemNew!).sort(), [
      "ECInstanceId", "ECClassId",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem",
      "$meta", "LastMod", "BinProp"
    ].sort());
    assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.stage, "New");
    assert.deepEqual([...elemNew!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.deepEqual([...elemNew!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elemNew!.$meta.nativeKey, `${fullElementId}-0x176`);
    assert.equal(elemNew!.$meta.mode, 0);
    assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), [
      "BoolProp", "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp",
      "StrProp", "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z", "BinProp"
    ].sort());
    assert.deepEqual(elemNew!.$meta.rowOptions, {});

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
    assert.deepEqual(elemOld!.RelatedElem, { Id: drawingCategoryId, RelECClassId: "0x177" });
    assert.isString(elemOld!.LastMod);
    assert.deepEqual(Object.keys(elemOld!).sort(), [
      "ECInstanceId", "ECClassId",
      "StrProp", "IntProp", "LongProp", "DblProp", "BoolProp", "DtProp",
      "Pt2dProp", "Pt3dProp", "StructProp", "IntArrProp", "StrArrProp", "StructArrProp", "RelatedElem",
      "$meta", "LastMod", "BinProp"
    ].sort());
    assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elemOld!.$meta.op, "Updated");
    assert.equal(elemOld!.$meta.stage, "Old");
    assert.deepEqual([...elemOld!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.equal(elemOld!.$meta.mode, 0);
    assert.deepEqual([...elemOld!.$meta.changesetFetchedProps].sort(), [
      "BoolProp", "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp",
      "StrProp", "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z", "BinProp"
    ].sort());
    assert.deepEqual(elemOld!.$meta.rowOptions, {});
  });

  it("txn3 update-full | Bis_Element_Properties", () => {
    const instances = readTxn(rwIModel, txnId, IModelJsNative.ECChangesetReader.Mode.Bis_Element_Properties);
    assert.equal(instances.length, 4);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.isString(modelNew!.LastMod);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 1);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.isString(modelOld!.LastMod);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 1);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement Updated New (no custom props) ---
    const elemNew = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.ECInstanceId, fullElementId);
    assert.equal(elemNew!.ECClassId, "0x176");
    assert.isUndefined(elemNew!.StrProp);
    assert.isUndefined(elemNew!.IntProp);
    assert.isUndefined(elemNew!.Model);
    assert.isUndefined(elemNew!.Category);
    assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.stage, "New");
    assert.deepEqual([...elemNew!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.deepEqual([...elemNew!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elemNew!.$meta.nativeKey, `${fullElementId}-0x176`);
    assert.equal(elemNew!.$meta.mode, 1);
    assert.deepEqual([...elemNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(elemNew!.$meta.rowOptions, {});

    // --- instances[3]: Test2dElement Updated Old ---
    const elemOld = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.ECInstanceId, fullElementId);
    assert.equal(elemOld!.ECClassId, "0x176");
    assert.isUndefined(elemOld!.StrProp);
    assert.isUndefined(elemOld!.IntProp);
    assert.isUndefined(elemOld!.Model);
    assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elemOld!.$meta.op, "Updated");
    assert.equal(elemOld!.$meta.stage, "Old");
    assert.deepEqual([...elemOld!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.equal(elemOld!.$meta.mode, 1);
    assert.deepEqual([...elemOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(elemOld!.$meta.rowOptions, {});
  });

  it("txn3 update-full | Instance_Key", () => {
    const instances = readTxn(rwIModel, txnId, IModelJsNative.ECChangesetReader.Mode.Instance_Key);
    assert.equal(instances.length, 4);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 2);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 2);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement Updated New ---
    const elemNew = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.ECInstanceId, fullElementId);
    assert.equal(elemNew!.ECClassId, "0x176");
    assert.isUndefined(elemNew!.StrProp);
    assert.isUndefined(elemNew!.Model);
    assert.isUndefined(elemNew!.LastMod);
    assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.equal(elemNew!.$meta.stage, "New");
    assert.deepEqual([...elemNew!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.deepEqual([...elemNew!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elemNew!.$meta.nativeKey, `${fullElementId}-0x176`);
    assert.equal(elemNew!.$meta.mode, 2);
    assert.deepEqual([...elemNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(elemNew!.$meta.rowOptions, {});

    // --- instances[3]: Test2dElement Updated Old ---
    const elemOld = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "Old");
    expect(elemOld).to.exist;
    assert.equal(elemOld!.ECInstanceId, fullElementId);
    assert.equal(elemOld!.ECClassId, "0x176");
    assert.isUndefined(elemOld!.StrProp);
    assert.isUndefined(elemOld!.Model);
    assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elemOld!.$meta.op, "Updated");
    assert.equal(elemOld!.$meta.stage, "Old");
    assert.deepEqual([...elemOld!.$meta.tables].sort(), ["bis_GeometricElement2d", "bis_Element"].sort());
    assert.equal(elemOld!.$meta.mode, 2);
    assert.deepEqual([...elemOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(elemOld!.$meta.rowOptions, {});
  });

  it("txn3 update-full | rowOptions: useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { useJsName: true });
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
    assert.equal(elemNew!.$meta.mode, 0);
    assert.deepEqual(elemNew!.$meta.rowOptions, { useJsName: true });
    assert.deepEqual(Object.keys(elemNew!).sort(), ["$meta", "binProp", "boolProp", "className",
      "dblProp", "dtProp", "id", "intArrProp", "intProp", "lastMod", "longProp", "pt2dProp",
      "pt3dProp", "relatedElem", "strArrProp", "strProp", "structArrProp", "structProp"].sort());
    assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ["BinProp", "BoolProp",
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
    assert.deepEqual([...elemOld!.$meta.changesetFetchedProps].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());
  });

  it("txn3 update-full | rowOptions: abbreviateBlobs", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: true });
    assert.equal(instances.length, 4);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: true });

    const elemNew = instances.find((i) => i.ECInstanceId === fullElementId && i.$meta.stage === "New");
    expect(elemNew).to.exist;
    assert.equal(elemNew!.ECClassId, "0x176");
    assert.equal(elemNew!.StrProp, "updated");
    // BinProp is a blob â€” should be abbreviated to { bytes: N }
    assert.include(String(elemNew!.BinProp), "bytes");
    assert.equal(elemNew!.$meta.op, "Updated");
    assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: true });
    assert.deepEqual(Object.keys(elemNew!).sort(), ["$meta", "BinProp", "BoolProp",
      "DblProp", "DtProp", "IntArrProp", "IntProp", "LastMod", "LongProp",
      "Pt2dProp", "Pt3dProp", "RelatedElem", "StrArrProp", "StrProp", "StructArrProp", "StructProp", "ECClassId", "ECInstanceId"].sort());
    assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ["BinProp", "BoolProp",
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
    assert.deepEqual([...elemOld!.$meta.changesetFetchedProps].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());
  });

  it("txn3 update-full | rowOptions: classIdsToClassNames + useJsName", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true, useJsName: true });
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
    assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ["BinProp", "BoolProp",
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
    assert.deepEqual([...elemOld!.$meta.changesetFetchedProps].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());
  });

  it("txn3 update-full | rowOptions: classIdsToClassNames", () => {

    const instances = readTxn(rwIModel, txnId, undefined, { classIdsToClassNames: true });
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
    assert.equal(elemNew!.$meta.mode, 0);
    assert.deepEqual(elemNew!.$meta.rowOptions, { classIdsToClassNames: true });

    assert.deepEqual(Object.keys(elemNew!).sort(), ["$meta", "BinProp", "BoolProp",
      "DblProp", "DtProp", "IntArrProp", "IntProp", "LastMod", "LongProp",
      "Pt2dProp", "Pt3dProp", "RelatedElem", "StrArrProp", "StrProp", "StructArrProp", "StructProp", "ECClassId", "ECInstanceId"].sort());
    assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ["BinProp", "BoolProp",
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
    assert.deepEqual([...elemOld!.$meta.changesetFetchedProps].sort(), ["BinProp", "BoolProp",
      "DblProp", "DtProp", "ECInstanceId", "IntArrProp", "IntProp", "LastMod",
      "LongProp", "Pt2dProp", "Pt3dProp.X", "Pt3dProp.Y", "RelatedElem.Id", "StrArrProp", "StrProp",
      "StructArrProp", "StructProp.Label", "StructProp.Pt2d", "StructProp.Pt3d", "StructProp.X",
      "StructProp.Y", "StructProp.Z"].sort());
  });

});

describe("ECChangesetReader â€” delete-partial", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rwIModel: any;
  let partialElementId: Id64String;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;
  let txnId: string;

  before(async () => {
    HubMock.startup("ECChangesetDeletePartial", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "deletePartial", description: "deletePartial", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

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
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrillDownDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "DrillDownCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(rwIModel, IModel.dictionaryId, "DrillDownCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    rwIModel.saveChanges("setup");

    // Txn 2: insert PARTIAL element
    partialElementId = rwIModel.elements.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      // StrProp, IntProp, LongProp, DblProp, BoolProp, DtProp, BinProp intentionally absent
    } as any);
    rwIModel.saveChanges("insert partial element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
    setTimeout(() => {
      //added so that LastMod gets updated in bis_Model
    }, 2000);
    await rwIModel.locks.acquireLocks({ exclusive: partialElementId });
    rwIModel.elements.deleteElement(partialElementId);
    rwIModel.saveChanges("delete partial element");
    txnId = rwIModel.txns.getLastSavedTxnProps()!.id;
  });

  after(() => {
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
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 0);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.isString(modelOld!.LastMod);
    assert.isString(modelOld!.GeometryGuid);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 0);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement (partial) Deleted Old ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal(elem!.ECClassId, "0x176");
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "0x63" });
    assert.isString(elem!.LastMod);
    assert.deepEqual(elem!.CodeSpec, { Id: "0x1", RelECClassId: "0x6b" });
    assert.deepEqual(elem!.CodeScope, { Id: "0x1", RelECClassId: "0x6d" });
    assert.isString(elem!.FederationGuid);
    assert.deepEqual(elem!.Category, { Id: drawingCategoryId, RelECClassId: "0x6f" });
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
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${partialElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps!].sort(), [].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
  });

  it("txn4 delete-partial | Bis_Element_Properties", () => {
    const instances = readTxn(rwIModel, txnId, IModelJsNative.ECChangesetReader.Mode.Bis_Element_Properties);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.isString(modelNew!.LastMod);
    assert.isString(modelNew!.GeometryGuid);
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 1);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.isString(modelOld!.LastMod);
    assert.isString(modelOld!.GeometryGuid);
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "LastMod", "GeometryGuid", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 1);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId", "LastMod", "GeometryGuid"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement (partial) Deleted Old ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal(elem!.ECClassId, "0x176");
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.Model);
    assert.isUndefined(elem!.Category);
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${partialElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 1);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps!].sort(), [].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
  });

  it("txn4 delete-partial | Instance_Key", () => {
    const instances = readTxn(rwIModel, txnId, IModelJsNative.ECChangesetReader.Mode.Instance_Key);
    assert.equal(instances.length, 3);

    // --- instances[0]: DrawingModel Updated New ---
    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECInstanceId, drawingModelId);
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelNew!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelNew!.$meta.stage, "New");
    assert.equal(modelNew!.$meta.mode, 2);
    assert.deepEqual([...modelNew!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelNew!.$meta.rowOptions, {});

    // --- instances[1]: DrawingModel Updated Old ---
    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECInstanceId, drawingModelId);
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(Object.keys(modelOld!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(modelOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.stage, "Old");
    assert.equal(modelOld!.$meta.mode, 2);
    assert.deepEqual([...modelOld!.$meta.changesetFetchedProps!].sort(), ["ECInstanceId"].sort());
    assert.deepEqual(modelOld!.$meta.rowOptions, {});

    // --- instances[2]: Test2dElement (partial) Deleted Old ---
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECInstanceId, partialElementId);
    assert.equal(elem!.ECClassId, "0x176");
    assert.isUndefined(elem!.StrProp);
    assert.isUndefined(elem!.Model);
    assert.isUndefined(elem!.LastMod);
    assert.deepEqual(Object.keys(elem!).sort(), ["ECInstanceId", "ECClassId", "$meta"].sort());
    assert.deepEqual(Object.keys(elem!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "nativeKey", "mode", "changesetFetchedProps", "rowOptions"].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.deepEqual([...elem!.$meta.tables].sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
    assert.deepEqual([...elem!.$meta.changeIndexes].sort(), [1, 2].sort());
    assert.equal(elem!.$meta.nativeKey, `${partialElementId}-0x176`);
    assert.equal(elem!.$meta.mode, 2);
    assert.deepEqual([...elem!.$meta.changesetFetchedProps!].sort(), [].sort());
    assert.deepEqual(elem!.$meta.rowOptions, {});
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
    assert.equal(elem!.$meta.mode, 0);
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
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual(elem!.$meta.rowOptions, { useJsName: true });
  });

  it("txn4 delete-partial | rowOptions: abbreviateBlobs", () => {
    const instances = readTxn(rwIModel, txnId, undefined, { abbreviateBlobs: true });
    assert.equal(instances.length, 3);

    const modelNew = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "New");
    expect(modelNew).to.exist;
    assert.equal(modelNew!.ECClassId, "0xaf");
    assert.deepEqual(modelNew!.$meta.rowOptions, { abbreviateBlobs: true });

    const modelOld = instances.find((i) => i.ECInstanceId === drawingModelId && i.$meta.stage === "Old");
    expect(modelOld).to.exist;
    assert.equal(modelOld!.ECClassId, "0xaf");
    assert.deepEqual(modelOld!.$meta.rowOptions, { abbreviateBlobs: true });

    // Partial element had no blobs; ECClassId still raw hex
    const elem = instances.find((i) => i.ECInstanceId === partialElementId && i.$meta.stage === "Old");
    expect(elem).to.exist;
    assert.equal(elem!.ECClassId, "0x176");
    assert.deepEqual(elem!.Model, { Id: drawingModelId, RelECClassId: "0x63" });
    assert.isUndefined(elem!.StrProp);
    assert.deepEqual(Object.keys(elem!).sort(), [
      "ECInstanceId", "ECClassId", "Model", "LastMod", "CodeSpec", "CodeScope", "FederationGuid", "$meta", "Category",
    ].sort());
    assert.equal(elem!.$meta.op, "Deleted");
    assert.equal(elem!.$meta.stage, "Old");
    assert.equal(elem!.$meta.mode, 0);
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
    assert.equal(elem!.$meta.mode, 0);
    assert.deepEqual(elem!.$meta.rowOptions, { classIdsToClassNames: true, useJsName: true });
  });

});


describe("ECChangesetReader API (bugs)", async () => {
  let iTwinId: GuidString;

  before(() => {
    HubMock.startup("ECChangesetReaderBugsTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });

  after(() => HubMock.shutdown());

  it("openFile() reads the middle changeset of an insert → update → delete lifecycle", async () => {
    const adminToken = "super manager token";
    const iModelName = "bugTest";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "BugTest", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

    // --- Push 1: import schema + set up drawing model and two categories ---
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);

    let categoryId1 = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "Category1");
    if (undefined === categoryId1)
      categoryId1 = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "Category1", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    let categoryId2 = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "Category2");
    if (undefined === categoryId2)
      categoryId2 = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "Category2", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,0,255)").toJSON() }));

    rwIModel.saveChanges("setup");
    await rwIModel.pushChanges({ description: "setup", accessToken: adminToken });

    // --- Push 2 (insert): insert element in drawingModel with category1 ---
    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];
    const geometryStream: GeometryStreamProps = [];
    for (const geom of geomArray)
      geometryStream.push(IModelJson.Writer.toIModelJson(geom));

    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const elementId: Id64String = rwIModel.elements.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: categoryId1,
      code: Code.createEmpty(),
      geom: geometryStream,
      s: "initial",
    } as any);
    assert.isTrue(Id64.isValidId64(elementId));
    rwIModel.saveChanges("insert element");
    await rwIModel.pushChanges({ description: "insert element", accessToken: adminToken });

    // --- Push 3 (middle/update): update element — change category to category2 and update s ---
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    const elemProps = rwIModel.elements.getElementProps(elementId);
    rwIModel.elements.updateElement({
      ...elemProps,
      category: categoryId2,
    } as any);
    rwIModel.saveChanges("update element");
    await rwIModel.pushChanges({ description: "update element", accessToken: adminToken });

    // --- Push 4 (delete): delete the element ---
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    rwIModel.elements.deleteElement(elementId);
    rwIModel.saveChanges("delete element");
    await rwIModel.pushChanges({ description: "delete element", accessToken: adminToken });

    // --- Download all changesets and open the middle one (the update) ---
    // changesets: [setup, insert, update, delete] — 4 total; Math.floor(4/2) = index 2 = update
    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    expect(changesets.length).to.equal(4);
    const middleChangeset = changesets[Math.floor(changesets.length / 2)]; // index 2 = update

    using reader = ECChangesetReader.openFile({ db: rwIModel, fileName: middleChangeset.pathname });
    using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
    while (reader.step())
      pcu.appendFrom(reader);

    const instances = Array.from(pcu.instances);

    // console.log("Instances: ", JSON.stringify(instances, null, 2));
    instances.filter((i) => i.ECInstanceId === elementId && i.$meta.stage === "New").forEach((i) => console.log(rwIModel.getClassNameFromId(i.ECClassId)));

    rwIModel.close();
  });
});

describe("ECChangesetReader — openFile + openGroup", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rwIModel: any;
  let rwIModelId: string;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;

  before(async () => {
    HubMock.startup("ECChangesetOpenFileGroup", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "openFileGroup", description: "openFileGroup", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

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
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "OpenFileDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "OpenFileCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(rwIModel, IModel.dictionaryId, "OpenFileCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,128,255)").toJSON() }));

    rwIModel.saveChanges("setup");
    await rwIModel.pushChanges({ description: "setup", accessToken: adminToken });
  });

  after(() => {
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("openFile reads insert and update changesets independently; openGroup reads both as a stream", async () => {
    const adminToken = "super manager token";
    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    // --- Push 2: insert element — only Y and Z set on Pt3dProp, X omitted (defaults to 0) ---
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const elementId: Id64String = rwIModel.elements.insertElement({
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
    rwIModel.saveChanges("insert element");
    await rwIModel.pushChanges({ description: "insert element", accessToken: adminToken });


    let changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    expect(changesets.length).to.equal(2);
    const insertCs = changesets[1];
    // === openFile: insert changeset ===
    {
      using reader = ECChangesetReader.openFile({ db: rwIModel, fileName: insertCs.pathname, rowOptions: { abbreviateBlobs: false } });
      using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      expect(elemNew).to.exist;
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "mode", "rowOptions", "changesetFetchedProps", "nativeKey"].sort());
      assert.equal(elemNew!.$meta.op, "Inserted");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.deepEqual(elemNew!.$meta.tables.sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
      assert.deepEqual(elemNew!.$meta.mode, 0);
      assert.deepEqual(elemNew!.$meta.changeIndexes.sort(), [1, 2].sort());
      assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: false });

      expect(elemNew!.Category).to.exist;
      expect(elemNew!.CodeScope).to.exist;
      expect(elemNew!.CodeSpec).to.exist;
      expect(elemNew!.LastMod).to.exist;
      expect(elemNew!.Model).to.exist;
      expect(elemNew!.FederationGuid).to.exist;
      assert.isNotNull(elemNew!.BinProp);
      assert.deepEqual(elemNew!.BinProp, new Uint8Array([1, 2, 3, 4]));
      assert.deepEqual(elemNew!.GuidArrProp, [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ]);
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Model", "CodeSpec",
        "CodeScope", "FederationGuid", "$meta", "Category", "LastMod",
        "BinProp", "GuidArrProp"].sort())
      assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp',
        'Category.Id', 'CodeScope.Id', 'CodeSpec.Id', 'CodeValue',
        'ECClassId', 'ECInstanceId', 'FederationGuid', 'GeometryStream', 'GuidArrProp',
        'JsonProperties', 'LastMod', 'Model.Id', 'Origin', 'Parent', 'Pt3dProp', 'Rotation',
        'TypeDefinition', 'UserLabel'].sort());
    }

    // --- Push 3: update element — change all custom props ---
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    rwIModel.elements.updateElement({
      ...rwIModel.elements.getElementProps(elementId),
      Pt3dProp: { x: 1.0, y: 9.9, z: 7.7 },
      BinProp: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
      GuidArrProp: [
        "ffffffff-0000-1111-2222-333344445555",
      ],
    } as any);
    rwIModel.saveChanges("update element");
    await rwIModel.pushChanges({ description: "update element", accessToken: adminToken });

    // Download all changesets: [setup(0), insert(1), update(2)]
    changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    expect(changesets.length).to.equal(3);
    const updateCs = changesets[2];

    // === openFile: update changeset ===
    {
      using reader = ECChangesetReader.openFile({ db: rwIModel, fileName: updateCs.pathname, rowOptions: { abbreviateBlobs: false } });
      using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      const elemOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
      expect(elemNew).to.exist;
      expect(elemOld).to.exist;
      assert.equal(elemNew!.$meta.op, "Updated");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.equal(elemNew!.$meta.mode, 0);
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "mode", "rowOptions", "changesetFetchedProps", "nativeKey"].sort());
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
      assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp', 'ECInstanceId', 'GuidArrProp', 'LastMod', 'Origin', 'Pt3dProp', 'Rotation'].sort());

      assert.equal(elemOld!.$meta.op, "Updated");
      assert.equal(elemOld!.$meta.stage, "Old");
      assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "mode", "rowOptions", "changesetFetchedProps", "nativeKey"].sort());
      assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "BinProp", "GuidArrProp", "$meta",
        "LastMod"].sort());
      assert.deepEqual(elemOld!.BinProp, new Uint8Array([1, 2, 3, 4]));
      assert.deepEqual(elemOld!.GuidArrProp, [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ]);
      expect(elemNew!.LastMod).to.exist;
      assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp', 'ECInstanceId', 'GuidArrProp', 'LastMod', 'Origin', 'Pt3dProp', 'Rotation'].sort());
    }

    // === openGroup: insert + update as a single stream ===
    // After merging, the elem New key is shared between insert-New and update-New;
    // the update-New wins on overlapping props, so the final New reflects the updated state.
    // elem Old only comes from the update changeset.
    {
      using reader = ECChangesetReader.openGroup({ db: rwIModel, changesetFiles: [insertCs.pathname, updateCs.pathname], rowOptions: { abbreviateBlobs: false } });
      using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
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
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "mode", "rowOptions", "changesetFetchedProps", "nativeKey"].sort());
      assert.equal(elemNew!.$meta.op, "Inserted");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.deepEqual(elemNew!.$meta.tables.sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
      assert.deepEqual(elemNew!.$meta.mode, 0);
      assert.deepEqual(elemNew!.$meta.changeIndexes.sort(), [1, 2].sort());
      assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: false });
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Model", "CodeSpec",
        "CodeScope", "FederationGuid", "$meta", "Category", "LastMod",
        "BinProp", "GuidArrProp", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "Pt3dProp"].sort());
      assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ['BBoxHigh', 'BBoxLow',
        'BinProp', 'Category.Id', 'CodeScope.Id', 'CodeSpec.Id',
        'CodeValue', 'ECClassId', 'ECInstanceId', 'FederationGuid', 'GeometryStream',
        'GuidArrProp', 'JsonProperties', 'LastMod', 'Model.Id', 'Origin', 'Parent', 'Pt3dProp',
        'Rotation', 'TypeDefinition', 'UserLabel'].sort());
    }
  });
});

describe("ECChangesetReader — openLocalChanges + openInmemoryChanges", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rwIModel: any;
  let rwIModelId: string;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;

  before(async () => {
    HubMock.startup("ECChangesetOpenFileGroup", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "openFileGroup", description: "openFileGroup", accessToken: adminToken });
    rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

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
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "OpenFileDrawing";
    [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);

    const foundCat = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "OpenFileCategory");
    drawingCategoryId = foundCat ?? DrawingCategory.insert(rwIModel, IModel.dictionaryId, "OpenFileCategory",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,128,255)").toJSON() }));

    rwIModel.saveChanges("setup");
    await rwIModel.pushChanges({ description: "setup", accessToken: adminToken });
  });

  after(() => {
    rwIModel?.close();
    HubMock.shutdown();
  });

  it("opens local and in-memory changes", async () => {
    const adminToken = "super manager token";
    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    // --- Push 2: insert element — only Y and Z set on Pt3dProp, X omitted (defaults to 0) ---
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const elementId: Id64String = rwIModel.elements.insertElement({
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
    rwIModel.saveChanges("insert element");


    // === openFile: insert changeset ===
    {
      using reader = ECChangesetReader.openLocalChanges({ db: rwIModel, rowOptions: { abbreviateBlobs: false } });
      using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      expect(elemNew).to.exist;
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "mode", "rowOptions", "changesetFetchedProps", "nativeKey"].sort());
      assert.equal(elemNew!.$meta.op, "Inserted");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.deepEqual(elemNew!.$meta.tables.sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
      assert.deepEqual(elemNew!.$meta.mode, 0);
      assert.deepEqual(elemNew!.$meta.changeIndexes.sort(), [1, 2].sort());
      assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: false });

      expect(elemNew!.Category).to.exist;
      expect(elemNew!.CodeScope).to.exist;
      expect(elemNew!.CodeSpec).to.exist;
      expect(elemNew!.LastMod).to.exist;
      expect(elemNew!.Model).to.exist;
      expect(elemNew!.FederationGuid).to.exist;
      assert.isNotNull(elemNew!.BinProp);
      assert.deepEqual(elemNew!.BinProp, new Uint8Array([1, 2, 3, 4]));
      assert.deepEqual(elemNew!.GuidArrProp, [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ]);
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Model", "CodeSpec",
        "CodeScope", "FederationGuid", "$meta", "Category", "LastMod",
        "BinProp", "GuidArrProp"].sort())
      assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp',
        'Category.Id', 'CodeScope.Id', 'CodeSpec.Id', 'CodeValue',
        'ECClassId', 'ECInstanceId', 'FederationGuid', 'GeometryStream', 'GuidArrProp',
        'JsonProperties', 'LastMod', 'Model.Id', 'Origin', 'Parent', 'Pt3dProp', 'Rotation',
        'TypeDefinition', 'UserLabel'].sort());
    }

    // --- Push 3: update element — change all custom props ---
    await rwIModel.locks.acquireLocks({ exclusive: elementId });
    rwIModel.elements.updateElement({
      ...rwIModel.elements.getElementProps(elementId),
      Pt3dProp: { x: 1.0, y: 9.9, z: 7.7 },
      BinProp: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
      GuidArrProp: [
        "ffffffff-0000-1111-2222-333344445555",
      ],
    } as any);

    // === openFile: update changeset ===
    {
      using reader = ECChangesetReader.openInMemoryChanges({ db: rwIModel, rowOptions: { abbreviateBlobs: false } });
      using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
      while (reader.step())
        pcu.appendFrom(reader);
      const instances = Array.from(pcu.instances);

      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      const elemOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
      expect(elemNew).to.exist;
      expect(elemOld).to.exist;
      assert.equal(elemNew!.$meta.op, "Updated");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.equal(elemNew!.$meta.mode, 0);
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "mode", "rowOptions", "changesetFetchedProps", "nativeKey"].sort());
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
      assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp', 'ECInstanceId', 'GuidArrProp', 'LastMod', 'Origin', 'Pt3dProp', 'Rotation'].sort());

      assert.equal(elemOld!.$meta.op, "Updated");
      assert.equal(elemOld!.$meta.stage, "Old");
      assert.deepEqual(Object.keys(elemOld!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "mode", "rowOptions", "changesetFetchedProps", "nativeKey"].sort());
      assert.deepEqual(Object.keys(elemOld!).sort(), ["ECInstanceId", "ECClassId", "BinProp", "GuidArrProp", "$meta",
        "LastMod"].sort());
      assert.deepEqual(elemOld!.BinProp, new Uint8Array([1, 2, 3, 4]));
      assert.deepEqual(elemOld!.GuidArrProp, [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      ]);
      expect(elemNew!.LastMod).to.exist;
      assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ['BBoxHigh', 'BBoxLow', 'BinProp', 'ECInstanceId', 'GuidArrProp', 'LastMod', 'Origin', 'Pt3dProp', 'Rotation'].sort());
    }

    // === openGroup: insert + update as a single stream ===
    // After merging, the elem New key is shared between insert-New and update-New;
    // the update-New wins on overlapping props, so the final New reflects the updated state.
    // elem Old only comes from the update changeset.
    {
      using reader = ECChangesetReader.openLocalChanges({ db: rwIModel, includeInMemoryChanges: true, rowOptions: { abbreviateBlobs: false } });
      using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
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
      assert.deepEqual(Object.keys(elemNew!.$meta).sort(), ["op", "tables", "changeIndexes", "stage", "mode", "rowOptions", "changesetFetchedProps", "nativeKey"].sort());
      assert.equal(elemNew!.$meta.op, "Inserted");
      assert.equal(elemNew!.$meta.stage, "New");
      assert.deepEqual(elemNew!.$meta.tables.sort(), ["bis_Element", "bis_GeometricElement2d"].sort());
      assert.deepEqual(elemNew!.$meta.mode, 0);
      assert.deepEqual(elemNew!.$meta.changeIndexes.sort(), [1, 2].sort());
      assert.deepEqual(elemNew!.$meta.rowOptions, { abbreviateBlobs: false });
      assert.deepEqual(Object.keys(elemNew!).sort(), ["ECInstanceId", "ECClassId", "Model", "CodeSpec",
        "CodeScope", "FederationGuid", "$meta", "Category", "LastMod",
        "BinProp", "GuidArrProp", "Origin", "Rotation", "BBoxLow", "BBoxHigh", "Pt3dProp"].sort());
      assert.deepEqual([...elemNew!.$meta.changesetFetchedProps].sort(), ['BBoxHigh', 'BBoxLow',
        'BinProp', 'Category.Id', 'CodeScope.Id', 'CodeSpec.Id',
        'CodeValue', 'ECClassId', 'ECInstanceId', 'FederationGuid', 'GeometryStream',
        'GuidArrProp', 'JsonProperties', 'LastMod', 'Model.Id', 'Origin', 'Parent', 'Pt3dProp',
        'Rotation', 'TypeDefinition', 'UserLabel'].sort());
    }
  });
});

