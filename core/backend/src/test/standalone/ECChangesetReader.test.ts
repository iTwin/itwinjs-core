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
import { ECChangesetReader, ECNativeChangeUnifierCache, ECNativePartialChangeUnifier } from "../../ECChangesetReader";
import { HubWrappers, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("ECChangesetReader API", async () => {
  let iTwinId: GuidString;

  before(() => {
    HubMock.startup("ECChangesetReaderTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });

  after(() => HubMock.shutdown());

  it("openTxn() reads a saved transaction", async () => {
    const adminToken = "super manager token";
    const iModelName = "test";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

    // Import schema
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.saveChanges("import schema");
    await rwIModel.pushChanges({ description: "import schema", accessToken: adminToken });
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Setup drawing partition + category
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    rwIModel.saveChanges("setup drawing partition");
    await rwIModel.pushChanges({ description: "setup drawing partition", accessToken: adminToken });

    // Build geometry stream
    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];
    const geometryStream: GeometryStreamProps = [];
    for (const geom of geomArray) {
      const arcData = IModelJson.Writer.toIModelJson(geom);
      geometryStream.push(arcData);
    }

    // Insert element
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const elementId: Id64String = rwIModel.elements.insertElement({
      classFullName: "TestDomain:Test2dElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom: geometryStream,
      s: "hello",
    } as any);
    assert.isTrue(Id64.isValidId64(elementId));

    // Save — do NOT push, so the txn is still local
    rwIModel.saveChanges("insert element");

    // Open the last saved txn via ECChangesetReader
    const txnId = rwIModel.txns.getLastSavedTxnProps()?.id as string;
    expect(txnId).to.not.be.undefined;

    using reader = ECChangesetReader.openTxn({ db: rwIModel, txnId });
    using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
    while (reader.step()) {
      pcu.appendFrom(reader);
    }

    const instances = Array.from(pcu.instances);
    // DrawingModel Updated (New + Old) + Test2dElement Inserted = 3 instances
    assert.equal(instances.length, 3);

    // --- Inserted Test2dElement ---
    const inserted = instances.find((i) => i.ECInstanceId === elementId);
    assert.isDefined(inserted, "inserted element must be present");
    assert.equal(inserted!.$meta.op, "Inserted");
    assert.equal(inserted!.$meta.stage, "New");
    assert.isArray(inserted!.$meta.tables);
    assert.isNotEmpty(inserted!.$meta.tables);
    assert.isArray(inserted!.$meta.changeIndexes);
    assert.isNotEmpty(inserted!.$meta.changeIndexes);
    assert.isString(inserted!.$meta.nativeKey);
    assert.equal(inserted!.s, "hello");
    assert.equal(inserted!.Rotation, 0);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    assert.deepEqual(inserted!.Origin, { X: 0, Y: 0 });
    // eslint-disable-next-line @typescript-eslint/naming-convention
    assert.deepEqual(inserted!.BBoxLow, { X: -25, Y: -25 });
    // eslint-disable-next-line @typescript-eslint/naming-convention
    assert.deepEqual(inserted!.BBoxHigh, { X: 15, Y: 15 });
    assert.instanceOf(inserted!.GeometryStream, Uint8Array);
    assert.typeOf(inserted!.FederationGuid, "string");
    assert.typeOf(inserted!.LastMod, "string");
    assert.isNull(inserted!.CodeValue);
    assert.isNull(inserted!.UserLabel);
    assert.isNull(inserted!.JsonProperties);
    assert.equal(inserted!.Category.Id, drawingCategoryId);
    assert.isNotEmpty(inserted!.Category.RelECClassId);

    // --- DrawingModel Updated (New + Old) ---
    const modelInstances = instances.filter((i) => i.ECInstanceId === drawingModelId);
    assert.equal(modelInstances.length, 2);
    const modelNew = modelInstances.find((i) => i.$meta.stage === "New");
    const modelOld = modelInstances.find((i) => i.$meta.stage === "Old");
    assert.isDefined(modelNew);
    assert.isDefined(modelOld);
    assert.equal(modelNew!.$meta.op, "Updated");
    assert.equal(modelOld!.$meta.op, "Updated");
    assert.isNotNull(modelNew!.LastMod);
    assert.isNull(modelOld!.LastMod);

    rwIModel.close();
  });
});
