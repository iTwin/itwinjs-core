/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString, Id64 } from "@itwin/core-bentley";
import { Code, ColorDef, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";
import { assert, expect } from "chai";
import * as path from "node:path";
import { DrawingCategory } from "../../Category";
import { ChangesetECAdaptor as ECChangesetAdaptor, PartialECChangeUnifier } from "../../ChangesetECAdaptor";
import { HubMock } from "../../HubMock";
import { BriefcaseDb, SnapshotDb } from "../../IModelDb";
import { SqliteChangesetReader } from "../../SqliteChangesetReader";
import { HubWrappers, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("Changeset Reader API", async () => {
  let iTwinId: GuidString;

  before(() => {
    HubMock.startup("ChangesetReaderTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });
  after(() => HubMock.shutdown());

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
      const reader = SqliteChangesetReader.openLocalChanges({ iModel: rwIModel.nativeDb, db: rwIModel, disableSchemaCheck: true });
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
      assert.deepEqual(el.Category, { Id: "0x20000000002", RelECClassId: "0x60" });
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
      assert.deepEqual(el.Category, { Id: "0x20000000002", RelECClassId: "0x60" });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.CodeSpec, { Id: "0x1", RelECClassId: "0x5c" });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.CodeScope, { Id: "0x1", RelECClassId: "0x5e" });

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
      assert.equal(changes[0].ECClassId, "0x140");
      assert.equal(changes[0].s, "updated property");
      assert.equal(changes[0].$meta?.classFullName, "TestDomain:Test2dElement");
      assert.equal(changes[0].$meta?.op, "Updated");
      assert.equal(changes[0].$meta?.stage, "New");

      // old value
      assert.equal(changes[1].ECInstanceId, "0x20000000004");
      assert.equal(changes[1].ECClassId, "0x140");
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
      assert.deepEqual(el.Category, { Id: "0x20000000002", RelECClassId: "0x60" });
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
      assert.deepEqual(el.Category, { Id: "0x20000000002", RelECClassId: "0x60" });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.CodeSpec, { Id: "0x1", RelECClassId: "0x5c" });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assert.deepEqual(el.CodeScope, { Id: "0x1", RelECClassId: "0x5e" });

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
});
