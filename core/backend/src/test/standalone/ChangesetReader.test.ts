/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";
import { assert, expect } from "chai";
import * as path from "node:path";
import { DrawingCategory } from "../../Category";
import { ChangesetECAdaptor as ECChangesetAdaptor, PartialECChangeUnifier } from "../../ChangesetECAdaptor";
import { HubMock } from "../../HubMock";
import { BriefcaseDb, SnapshotDb } from "../../IModelDb";
import { SqliteChangeOp, SqliteChangesetReader } from "../../SqliteChangesetReader";
import { HubWrappers, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { _nativeDb, ChannelControl } from "../../core-backend";

describe("Changeset Reader API", async () => {
  let iTwinId: GuidString;

  before(() => {
    HubMock.startup("ChangesetReaderTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });
  after(() => HubMock.shutdown());
  it("Able to recover from when ExclusiveRootClassId is NULL for overflow table", async () => {
    /**
     * 1. Import schema with class that span overflow table.
     * 2. Insert a element for the class.
     * 3. Push changes to hub.
     * 4. Update the element.
     * 5. Push changes to hub.
     * 6. Delete the element.
     * 7. Set ExclusiveRootClassId to NULL for overflow table. (Simulate the issue)
     * 8. ECChangesetAdaptor should be able to read the changeset 2 in which element is updated against latest imodel where element is deleted.
     */
    const adminToken = "super manager token";
    const iModelName = "test";
    const nProps = 36;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    // 1. Import schema with class that span overflow table.
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            ${Array(nProps).fill(undefined).map((_, i) => `<ECProperty propertyName="p${i}" typeName="string"/>`).join("\n")}
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    // Insert element with 100 properties
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
    const props = Array(nProps).fill(undefined).map((_, i) => {
      return { [`p${i}`]: `test_${i}` };
    }).reduce((acc, curr) => {
      return { ...acc, ...curr };
    }, {});

    const geomElement = {
      classFullName: `TestDomain:Test2dElement`,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom: geometryStream,
      ...props,
    };

    // 2. Insert a element for the class.
    const id = rwIModel.elements.insertElement(geomElement);
    assert.isTrue(Id64.isValidId64(id), "insert worked");
    rwIModel.saveChanges();

    // 3. Push changes to hub.
    await rwIModel.pushChanges({ description: "insert element", accessToken: adminToken });

    // 4. Update the element.
    const updatedElementProps = Object.assign(
      rwIModel.elements.getElementProps(id),
      Array(nProps).fill(undefined).map((_, i) => {
        return { [`p${i}`]: `updated_${i}` };
      }).reduce((acc, curr) => {
        return { ...acc, ...curr };
      }, {}));

    await rwIModel.locks.acquireLocks({ exclusive: id });
    rwIModel.elements.updateElement(updatedElementProps);
    rwIModel.saveChanges();

    // 5. Push changes to hub.
    await rwIModel.pushChanges({ description: "update element", accessToken: adminToken });

    await rwIModel.locks.acquireLocks({ exclusive: id });

    // 6. Delete the element.
    rwIModel.elements.deleteElement(id);
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "delete element", accessToken: adminToken });

    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    const reader = SqliteChangesetReader.openFile({ fileName: changesets[1].pathname, db: rwIModel, disableSchemaCheck: true });

    // Set ExclusiveRootClassId to NULL for overflow table to simulate the issue
    expect(rwIModel[_nativeDb].executeSql("UPDATE ec_Table SET ExclusiveRootClassId=NULL WHERE Name='bis_GeometricElement2d_Overflow'")).to.be.eq(DbResult.BE_SQLITE_OK);

    const adaptor = new ECChangesetAdaptor(reader);
    let assertOnOverflowTable = false;

    const expectedInserted = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ECClassId: undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ECInstanceId: "",
      $meta: {
        tables: ["bis_GeometricElement2d_Overflow"],
        op: "Updated",
        classFullName: "BisCore:GeometricElement2d",
        fallbackClassId: "0x5e",
        changeIndexes: [3],
        stage: "New",
      },
    };
    const expectedDeleted = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ECClassId: undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ECInstanceId: "",
      $meta: {
        tables: ["bis_GeometricElement2d_Overflow"],
        op: "Updated",
        classFullName: "BisCore:GeometricElement2d",
        fallbackClassId: "0x5e",
        changeIndexes: [3],
        stage: "Old",
      },
    };

    while (adaptor.step()) {
      if (adaptor.op === "Updated" && adaptor.inserted?.$meta?.tables[0] === "bis_GeometricElement2d_Overflow") {
        assert.deepEqual(adaptor.inserted as any, expectedInserted);
        assert.deepEqual(adaptor.deleted as any, expectedDeleted);
        assertOnOverflowTable = true;
      }
    }

    assert.isTrue(assertOnOverflowTable);
    rwIModel.close();
  });
  it("Changeset reader / EC adaptor", async () => {
    const adminToken = "super manager token";
    const iModelName = "test";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.saveChanges("user 1: schema changeset");
    if ("push changes") {
      // Push the changes to the hub
      const prePushChangeSetId = rwIModel.changeset.id;
      await rwIModel.pushChanges({ description: "push schema changeset", accessToken: adminToken });
      const postPushChangeSetId = rwIModel.changeset.id;
      assert(!!postPushChangeSetId);
      expect(prePushChangeSetId !== postPushChangeSetId);
      rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    }
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    let totalEl = 0;
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    rwIModel.saveChanges("user 1: create drawing partition");
    if ("push changes") {
      // Push the changes to the hub
      const prePushChangeSetId = rwIModel.changeset.id;
      await rwIModel.pushChanges({ description: "user 1: create drawing partition", accessToken: adminToken });
      const postPushChangeSetId = rwIModel.changeset.id;
      assert(!!postPushChangeSetId);
      expect(prePushChangeSetId !== postPushChangeSetId);
    }

    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const insertElements = (imodel: BriefcaseDb, className: string = "Test2dElement", noOfElements: number = 10, userProp: (n: number) => object) => {
      for (let m = 0; m < noOfElements; ++m) {
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
        const prop = userProp(++totalEl);
        // Create props
        const geomElement = {
          classFullName: `TestDomain:${className}`,
          model: drawingModelId,
          category: drawingCategoryId,
          code: Code.createEmpty(),
          geom: geometryStream,
          ...prop,
        };
        const id = imodel.elements.insertElement(geomElement);
        assert.isTrue(Id64.isValidId64(id), "insert worked");
      }
    };
    const generatedStr = new Array(10).join("x");
    insertElements(rwIModel, "Test2dElement", 1, () => {
      return { s: generatedStr };
    });

    const updatedElements = async () => {
      await rwIModel.locks.acquireLocks({ exclusive: "0x20000000004" });
      const updatedElement = rwIModel.elements.getElementProps("0x20000000004");
      (updatedElement as any).s = "updated property";
      rwIModel.elements.updateElement(updatedElement);
      rwIModel.saveChanges("user 1: updated data");
      await rwIModel.pushChanges({ description: "user 1: update property id=0x20000000004", accessToken: adminToken });
    };

    rwIModel.saveChanges("user 1: data");

    if ("test local changes") {
      const reader = SqliteChangesetReader.openLocalChanges({ iModel: rwIModel[_nativeDb], db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      const cci = new PartialECChangeUnifier();
      while (adaptor.step()) {
        cci.appendFrom(adaptor);
      }
      const changes = Array.from(cci.instances);
      assert.equal(changes.length, 3);
      assert.equal(changes[0].ECInstanceId, "0x20000000004");
      assert.equal(changes[0].$meta?.classFullName, "TestDomain:Test2dElement");
      assert.equal(changes[0].$meta?.op, "Inserted");
      assert.equal(changes[0].$meta?.stage, "New");

      assert.equal(changes[1].ECInstanceId, "0x20000000001");
      assert.equal(changes[1].$meta?.classFullName, "BisCore:DrawingModel");
      assert.equal(changes[1].$meta?.op, "Updated");
      assert.equal(changes[1].$meta?.stage, "New");
      assert.isNotNull(changes[1].LastMod);
      assert.isNotNull(changes[1].GeometryGuid);

      assert.equal(changes[2].ECInstanceId, "0x20000000001");
      assert.equal(changes[2].$meta?.classFullName, "BisCore:DrawingModel");
      assert.equal(changes[2].$meta?.op, "Updated");
      assert.equal(changes[2].$meta?.stage, "Old");
      assert.isNull(changes[2].LastMod);
      assert.isNull(changes[2].GeometryGuid);

      const el = changes.filter((x) => x.ECInstanceId === "0x20000000004")[0];
      assert.equal(el.Rotation, 0);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.Origin, { X: 0, Y: 0 });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.BBoxLow, { X: -25, Y: -25 });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.BBoxHigh, { X: 15, Y: 15 });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.Category, { Id: "0x20000000002", RelECClassId: "0x6d" });
      assert.equal(el.s, "xxxxxxxxx");
      assert.isNull(el.CodeValue);
      assert.isNull(el.UserLabel);
      assert.isNull(el.JsonProperties);
      assert.instanceOf(el.GeometryStream, Uint8Array);
      assert.typeOf(el.FederationGuid, "string");
      assert.typeOf(el.LastMod, "string");
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.Parent, { Id: null, RelECClassId: null });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.TypeDefinition, { Id: null, RelECClassId: null });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.Category, { Id: "0x20000000002", RelECClassId: "0x6d" });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.CodeSpec, { Id: "0x1", RelECClassId: "0x69" });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.CodeScope, { Id: "0x1", RelECClassId: "0x6b" });

      assert.deepEqual(el.$meta, {
        tables: [
          "bis_GeometricElement2d",
          "bis_Element",
        ],
        op: "Inserted",
        classFullName: "TestDomain:Test2dElement",
        changeIndexes: [
          2,
          1,
        ],
        stage: "New",
        fallbackClassId: undefined,
      });
      adaptor.dispose();
    }
    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    await rwIModel.pushChanges({ description: "schema changeset", accessToken: adminToken });

    await updatedElements();

    const changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });
    if ("updated element") {
      const reader = SqliteChangesetReader.openFile({ fileName: changesets[3].pathname, db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      const cci = new PartialECChangeUnifier();
      while (adaptor.step()) {
        cci.appendFrom(adaptor);
      }

      const changes = Array.from(cci.instances);
      assert.equal(changes.length, 4);

      // new value
      assert.equal(changes[0].ECInstanceId, "0x20000000004");
      assert.equal(changes[0].ECClassId, "0x14d");
      assert.equal(changes[0].s, "updated property");
      assert.equal(changes[0].$meta?.classFullName, "TestDomain:Test2dElement");
      assert.equal(changes[0].$meta?.op, "Updated");
      assert.equal(changes[0].$meta?.stage, "New");

      // old value
      assert.equal(changes[1].ECInstanceId, "0x20000000004");
      assert.equal(changes[1].ECClassId, "0x14d");
      assert.equal(changes[1].s, "xxxxxxxxx");
      assert.equal(changes[1].$meta?.classFullName, "TestDomain:Test2dElement");
      assert.equal(changes[1].$meta?.op, "Updated");
      assert.equal(changes[1].$meta?.stage, "Old");
    }
    if ("updated element when no classId") {
      const otherDb = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
      const reader = SqliteChangesetReader.openFile({ fileName: changesets[3].pathname, db: otherDb, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      const cci = new PartialECChangeUnifier();
      while (adaptor.step()) {
        cci.appendFrom(adaptor);
      }

      const changes = Array.from(cci.instances);
      assert.equal(changes.length, 4);

      // new value
      assert.equal(changes[0].ECInstanceId, "0x20000000004");
      assert.isUndefined(changes[0].ECClassId);
      assert.isDefined(changes[0].$meta?.fallbackClassId);
      assert.equal(changes[0].$meta?.fallbackClassId, "0x3d");
      assert.isUndefined(changes[0].s);
      assert.equal(changes[0].$meta?.classFullName, "BisCore:GeometricElement2d");
      assert.equal(changes[0].$meta?.op, "Updated");
      assert.equal(changes[0].$meta?.stage, "New");

      // old value
      assert.equal(changes[1].ECInstanceId, "0x20000000004");
      assert.isUndefined(changes[1].ECClassId);
      assert.isDefined(changes[1].$meta?.fallbackClassId);
      assert.equal(changes[1].$meta?.fallbackClassId, "0x3d");
      assert.isUndefined(changes[1].s);
      assert.equal(changes[1].$meta?.classFullName, "BisCore:GeometricElement2d");
      assert.equal(changes[1].$meta?.op, "Updated");
      assert.equal(changes[1].$meta?.stage, "Old");
    }
    if ("test changeset file") {
      const reader = SqliteChangesetReader.openFile({ fileName: changesets[2].pathname, db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      const cci = new PartialECChangeUnifier();
      while (adaptor.step()) {
        cci.appendFrom(adaptor);
      }
      const changes = Array.from(cci.instances);
      assert.equal(changes.length, 3);
      assert.equal(changes[0].ECInstanceId, "0x20000000004");
      assert.equal(changes[0].$meta?.classFullName, "TestDomain:Test2dElement");
      assert.equal(changes[0].$meta?.op, "Inserted");
      assert.equal(changes[0].$meta?.stage, "New");

      assert.equal(changes[1].ECInstanceId, "0x20000000001");
      assert.equal(changes[1].$meta?.classFullName, "BisCore:DrawingModel");
      assert.equal(changes[1].$meta?.op, "Updated");
      assert.equal(changes[1].$meta?.stage, "New");
      assert.isNotNull(changes[1].LastMod);
      assert.isNotNull(changes[1].GeometryGuid);

      assert.equal(changes[2].ECInstanceId, "0x20000000001");
      assert.equal(changes[2].$meta?.classFullName, "BisCore:DrawingModel");
      assert.equal(changes[2].$meta?.op, "Updated");
      assert.equal(changes[2].$meta?.stage, "Old");
      assert.isNull(changes[2].LastMod);
      assert.isNull(changes[2].GeometryGuid);

      const el = changes.filter((x) => x.ECInstanceId === "0x20000000004")[0];
      assert.equal(el.Rotation, 0);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.Origin, { X: 0, Y: 0 });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.BBoxLow, { X: -25, Y: -25 });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.BBoxHigh, { X: 15, Y: 15 });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.Category, { Id: "0x20000000002", RelECClassId: "0x6d" });
      assert.equal(el.s, "xxxxxxxxx");
      assert.isNull(el.CodeValue);
      assert.isNull(el.UserLabel);
      assert.isNull(el.JsonProperties);
      assert.instanceOf(el.GeometryStream, Uint8Array);
      assert.typeOf(el.FederationGuid, "string");
      assert.typeOf(el.LastMod, "string");
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.Parent, { Id: null, RelECClassId: null });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.TypeDefinition, { Id: null, RelECClassId: null });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.Category, { Id: "0x20000000002", RelECClassId: "0x6d" });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.CodeSpec, { Id: "0x1", RelECClassId: "0x69" });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.CodeScope, { Id: "0x1", RelECClassId: "0x6b" });

      assert.deepEqual(el.$meta, {
        tables: [
          "bis_GeometricElement2d",
          "bis_Element",
        ],
        op: "Inserted",
        classFullName: "TestDomain:Test2dElement",
        changeIndexes: [
          2,
          1,
        ],
        stage: "New",
        fallbackClassId: undefined,
      });
      adaptor.dispose();
    }
    if ("test ChangesetAdaptor.acceptClass()") {
      const reader = SqliteChangesetReader.openFile({ fileName: changesets[2].pathname, db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      adaptor.acceptClass("TestDomain.Test2dElement");
      const cci = new PartialECChangeUnifier();
      while (adaptor.step()) {
        cci.appendFrom(adaptor);
      }
      const changes = Array.from(cci.instances);
      assert.equal(changes.length, 1);
      assert.equal(changes[0].$meta?.classFullName, "TestDomain:Test2dElement");
      adaptor.dispose();
    }
    if ("test ChangesetAdaptor.adaptor()") {
      const reader = SqliteChangesetReader.openFile({ fileName: changesets[2].pathname, db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      adaptor.acceptOp("Updated");
      const cci = new PartialECChangeUnifier();
      while (adaptor.step()) {
        cci.appendFrom(adaptor);
      }
      const changes = Array.from(cci.instances);
      assert.equal(changes.length, 2);
      assert.equal(changes[0].ECInstanceId, "0x20000000001");
      assert.equal(changes[0].$meta?.classFullName, "BisCore:DrawingModel");
      assert.equal(changes[0].$meta?.op, "Updated");
      assert.equal(changes[0].$meta?.stage, "New");
      assert.equal(changes[1].ECInstanceId, "0x20000000001");
      assert.equal(changes[1].$meta?.classFullName, "BisCore:DrawingModel");
      assert.equal(changes[1].$meta?.op, "Updated");
      assert.equal(changes[1].$meta?.stage, "Old");
      adaptor.dispose();
    }
    rwIModel.close();
  });
  it("revert timeline changes", async () => {
    const adminToken = "super manager token";
    const iModelName = "test";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    let nProps = 0;
    // 1. Import schema with class that span overflow table.
    const addPropertyAndImportSchema = async () => {
      await rwIModel.acquireSchemaLock();
      ++nProps;
      const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00.${nProps}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            ${Array(nProps).fill(undefined).map((_, i) => `<ECProperty propertyName="p${i + 1}" typeName="string"/>`).join("\n")}
        </ECEntityClass>
    </ECSchema>`;
      await rwIModel.importSchemaStrings([schema]);
    };
    await addPropertyAndImportSchema();
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "setup category", accessToken: adminToken });

    const createEl = async (args: { [key: string]: any }) => {
      await rwIModel.locks.acquireLocks({ exclusive: drawingModelId });
      const geomArray: Arc3d[] = [
        Arc3d.createXY(Point3d.create(0, 0), 5),
        Arc3d.createXY(Point3d.create(5, 5), 2),
        Arc3d.createXY(Point3d.create(-5, -5), 20),
      ];
      process.env
      const geometryStream: GeometryStreamProps = [];
      for (const geom of geomArray) {
        const arcData = IModelJson.Writer.toIModelJson(geom);
        geometryStream.push(arcData);
      }

      const e1 = {
        classFullName: `TestDomain:Test2dElement`,
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        geom: geometryStream,
        ...args,
      };
      return rwIModel.elements.insertElement(e1);;
    };
    const updateEl = async (id: Id64String, args: { [key: string]: any }) => {
      await rwIModel.locks.acquireLocks({ exclusive: id });
      const updatedElementProps = Object.assign(rwIModel.elements.getElementProps(id), args);
      rwIModel.elements.updateElement(updatedElementProps);
    }

    const deleteEl = async (id: Id64String) => {
      await rwIModel.locks.acquireLocks({ exclusive: id });
      rwIModel.elements.deleteElement(id);
    };
    const getChanges = async () => {
      return HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir: path.join(KnownTestLocations.outputDir, rwIModelId, "changesets") });
    };

    const findEl = (id: Id64String) => {
      try {
        return rwIModel.elements.getElementProps(id);
      } catch (e) {
        return undefined;
      }
    }
    // 2. Insert a element for the class
    const el1 = await createEl({ p1: "test1" });
    const el2 = await createEl({ p1: "test2" });
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "insert 2 elements" });

    // 3. Update the element.
    await updateEl(el1, { p1: "test3" });
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "update element 1" });

    // 4. Delete the element.
    await deleteEl(el2);
    const el3 = await createEl({ p1: "test4" });
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "delete element 2" });

    // 5. import schema and insert element 4 & update element 3
    await addPropertyAndImportSchema();
    const el4 = await createEl({ p1: "test5", p2: "test6" });
    await updateEl(el3, { p1: "test7", p2: "test8" });
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "import schema, insert element 4 & update element 3" });

    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    assert.deepEqual(Object.getOwnPropertyNames(rwIModel.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2"]);
    // 6. Revert to timeline 2
    await rwIModel.revertAndPushChanges({ toIndex: 2, description: "revert to timeline 2" });
    assert.equal((await getChanges()).at(-1)!.description, "revert to timeline 2");

    assert.isUndefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isUndefined(findEl(el3));
    assert.isUndefined(findEl(el4));
    assert.deepEqual(Object.getOwnPropertyNames(rwIModel.getMetaData("TestDomain:Test2dElement").properties), ["p1"]);

    await rwIModel.revertAndPushChanges({ toIndex: 6, description: "reinstate last reverted changeset" });
    assert.equal((await getChanges()).at(-1)!.description, "reinstate last reverted changeset");
    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    assert.deepEqual(Object.getOwnPropertyNames(rwIModel.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2"]);

    await addPropertyAndImportSchema();
    const el5 = await createEl({ p1: "test9", p2: "test10", p3: "test11" });
    await updateEl(el1, { p1: "test12", p2: "test13", p3: "test114" });
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "import schema, insert element 5 & update element 1" });
    assert.deepEqual(Object.getOwnPropertyNames(rwIModel.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    //skip schema changes & auto generated comment
    await rwIModel.revertAndPushChanges({ toIndex: 1, skipSchemaChanges: true });
    assert.equal((await getChanges()).at(-1)!.description, "Reverted changes from 8 to 1 (schema changes skipped)");
    assert.isUndefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isUndefined(findEl(el3));
    assert.isUndefined(findEl(el4));
    assert.isUndefined(findEl(el5));
    assert.deepEqual(Object.getOwnPropertyNames(rwIModel.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    await rwIModel.revertAndPushChanges({ toIndex: 9 });
    assert.equal((await getChanges()).at(-1)!.description, "Reverted changes from 9 to 9");
    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    assert.isDefined(findEl(el5));
    assert.deepEqual(Object.getOwnPropertyNames(rwIModel.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);
    rwIModel.close();
  });

  it("openGroup() & writeToFile()", async () => {
    const adminToken = "super manager token";
    const iModelName = "test";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    // 1. Import schema with class that span overflow table.
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "setup category", accessToken: adminToken });
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

    const e1 = {
      classFullName: `TestDomain:Test2dElement`,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      geom: geometryStream,
      ...{ p1: "test1" },
    };

    // 2. Insert a element for the class
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    const e1id = rwIModel.elements.insertElement(e1);
    assert.isTrue(Id64.isValidId64(e1id), "insert worked");
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "insert element", accessToken: adminToken });

    // 3. Update the element.
    const updatedElementProps = Object.assign(rwIModel.elements.getElementProps(e1id), { p1: "test2" });
    await rwIModel.locks.acquireLocks({ exclusive: e1id });
    rwIModel.elements.updateElement(updatedElementProps);
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "update element", accessToken: adminToken });

    // 4. Delete the element.
    await rwIModel.locks.acquireLocks({ exclusive: e1id });
    rwIModel.elements.deleteElement(e1id);
    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "delete element", accessToken: adminToken });

    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    const changesets = (await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir })).slice(1);

    if ("Grouping changeset [2,3,4] should not contain TestDomain:Test2dElement as insert+update+delete=noop") {
      const reader = SqliteChangesetReader.openGroup({ changesetFiles: changesets.map((c) => c.pathname), db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      const instances: ({ id: string, classId?: string, op: SqliteChangeOp, classFullName?: string })[] = [];
      while (adaptor.step()) {
        if (adaptor.inserted) {
          instances.push({ id: adaptor.inserted?.ECInstanceId, classId: adaptor.inserted.ECClassId, op: adaptor.op, classFullName: adaptor.inserted.$meta?.classFullName });
        } else if (adaptor.deleted) {
          instances.push({ id: adaptor.deleted?.ECInstanceId, classId: adaptor.deleted.ECClassId, op: adaptor.op, classFullName: adaptor.deleted.$meta?.classFullName });
        }
      }
      expect(instances.length).to.eq(1);
      expect(instances[0].id).to.eq("0x20000000001");
      expect(instances[0].classId).to.eq("0xa5");
      expect(instances[0].op).to.eq("Updated");
      expect(instances[0].classFullName).to.eq("BisCore:DrawingModel");
    }

    if ("Grouping changeset [3,4] should contain update+delete=delete TestDomain:Test2dElement") {
      const reader = SqliteChangesetReader.openGroup({ changesetFiles: changesets.slice(1).map((c) => c.pathname), db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      const instances: ({ id: string, classId?: string, op: SqliteChangeOp, classFullName?: string })[] = [];
      while (adaptor.step()) {
        if (adaptor.inserted) {
          instances.push({ id: adaptor.inserted?.ECInstanceId, classId: adaptor.inserted.ECClassId, op: adaptor.op, classFullName: adaptor.inserted.$meta?.classFullName });
        } else if (adaptor.deleted) {
          instances.push({ id: adaptor.deleted?.ECInstanceId, classId: adaptor.deleted.ECClassId, op: adaptor.op, classFullName: adaptor.deleted.$meta?.classFullName });
        }
      }
      expect(instances.length).to.eq(3);
      expect(instances[0]).deep.eq({
        id: "0x20000000004",
        classId: "0x14d",
        op: "Deleted",
        classFullName: "TestDomain:Test2dElement",
      });
      expect(instances[1]).deep.eq({
        id: "0x20000000004",
        classId: "0x14d",
        op: "Deleted",
        classFullName: "TestDomain:Test2dElement",
      });
      expect(instances[2]).deep.eq({
        id: "0x20000000001",
        classId: "0xa5",
        op: "Updated",
        classFullName: "BisCore:DrawingModel",
      });
    }
    const groupCsFile = path.join(KnownTestLocations.outputDir, "changeset_grouping.ec");
    if ("Grouping changeset [2,3] should contain insert+update=insert TestDomain:Test2dElement") {
      const reader = SqliteChangesetReader.openGroup({ changesetFiles: changesets.slice(0, 2).map((c) => c.pathname), db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      const instances: ({ id: string, classId?: string, op: SqliteChangeOp, classFullName?: string })[] = [];
      while (adaptor.step()) {
        if (adaptor.inserted) {
          instances.push({ id: adaptor.inserted?.ECInstanceId, classId: adaptor.inserted.ECClassId, op: adaptor.op, classFullName: adaptor.inserted.$meta?.classFullName });
        } else if (adaptor.deleted) {
          instances.push({ id: adaptor.deleted?.ECInstanceId, classId: adaptor.deleted.ECClassId, op: adaptor.op, classFullName: adaptor.deleted.$meta?.classFullName });
        }
      }
      expect(instances.length).to.eq(3);
      expect(instances[0]).deep.eq({
        id: "0x20000000004",
        classId: "0x14d",
        op: "Inserted",
        classFullName: "TestDomain:Test2dElement",
      });
      expect(instances[1]).deep.eq({
        id: "0x20000000004",
        classId: "0x14d",
        op: "Inserted",
        classFullName: "TestDomain:Test2dElement",
      });
      expect(instances[2]).deep.eq({
        id: "0x20000000001",
        classId: "0xa5",
        op: "Updated",
        classFullName: "BisCore:DrawingModel",
      });

      reader.writeToFile({ fileName: groupCsFile, containsSchemaChanges: false, overwriteFile: true });
    }
    if ("writeToFile() test") {
      const reader = SqliteChangesetReader.openFile({ fileName: groupCsFile, db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ECChangesetAdaptor(reader);
      const instances: ({ id: string, classId?: string, op: SqliteChangeOp, classFullName?: string })[] = [];
      while (adaptor.step()) {
        if (adaptor.inserted) {
          instances.push({ id: adaptor.inserted?.ECInstanceId, classId: adaptor.inserted.ECClassId, op: adaptor.op, classFullName: adaptor.inserted.$meta?.classFullName });
        } else if (adaptor.deleted) {
          instances.push({ id: adaptor.deleted?.ECInstanceId, classId: adaptor.deleted.ECClassId, op: adaptor.op, classFullName: adaptor.deleted.$meta?.classFullName });
        }
      }
      expect(instances.length).to.eq(3);
      expect(instances[0]).deep.eq({
        id: "0x20000000004",
        classId: "0x14d",
        op: "Inserted",
        classFullName: "TestDomain:Test2dElement",
      });
      expect(instances[1]).deep.eq({
        id: "0x20000000004",
        classId: "0x14d",
        op: "Inserted",
        classFullName: "TestDomain:Test2dElement",
      });
      expect(instances[2]).deep.eq({
        id: "0x20000000001",
        classId: "0xa5",
        op: "Updated",
        classFullName: "BisCore:DrawingModel",
      });
    }
    rwIModel.close();
  });
});
