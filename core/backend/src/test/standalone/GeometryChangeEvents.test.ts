/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CompressedId64Set, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { LineSegment3d, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  Code, ColorByName, GeometricElement3dProps, GeometryStreamBuilder, IModel, ModelGeometryChangesProps, SubCategoryAppearance,
} from "@bentley/imodeljs-common";
import {
  IModelHost, IModelJsFs, PhysicalModel, SpatialCategory, StandaloneDb, VolumeElement,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { IpcHost } from "../../IpcHost";

describe("Model geometry changes", () => {
  let imodel: StandaloneDb;
  let modelId: string;
  let categoryId: string;
  let lastChanges: ModelGeometryChangesProps[] | undefined;

  before(async () => {
    await IModelHost.shutdown();
    await IModelHost.startup();

    const testFileName = IModelTestUtils.prepareOutputFile("ModelGeometryTracking", "ModelGeometryTracking.bim");
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    IModelJsFs.copySync(seedFileName, testFileName);

    // Upgrade the schema to include the GeometryGuid and LastMod model properties.
    StandaloneDb.upgradeSchemas(testFileName);
    imodel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    modelId = PhysicalModel.insert(imodel, IModel.rootSubjectId, "TestModel");
    categoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));
    imodel.saveChanges("set up");
    imodel.nativeDb.deleteAllTxns();
    imodel.txns.onGeometryChanged.addListener((props) => lastChanges = props);
  });

  after(async () => {
    imodel.nativeDb.setGeometricModelTrackingEnabled(false);
    imodel.close();

    await IpcHost.shutdown();
    await IModelHost.startup();
  });

  interface GeometricModelChange {
    modelId: string;
    inserted?: string[];
    updated?: string[];
    deleted?: string[];
  }

  function expectChanges(expected: GeometricModelChange | undefined): void {
    if (!expected) {

      expect(lastChanges).to.be.undefined;
      return;
    }

    expect(lastChanges).to.be.not.undefined;
    expect(Array.isArray(lastChanges)).to.be.true;
    expect(lastChanges!.length).to.equal(1);
    const actual = lastChanges![0];
    expect(actual.id).to.equal(modelId);

    const expectElements = (ids?: CompressedId64Set, exp?: string[]) => {
      expect(undefined === ids).to.equal(undefined === exp);
      if (ids && exp) {
        const act = CompressedId64Set.decompressArray(ids);
        expect(act.length).to.equal(exp.length);
        expect(act.sort()).to.deep.equal(exp.sort());
      }
    };

    expectElements(actual.inserted?.ids, expected.inserted);
    expectElements(actual.updated?.ids, expected.updated);
    expectElements(actual.deleted, expected.deleted);
    lastChanges = undefined;
  }

  function expectNoChanges(): void {
    expect(lastChanges).to.be.undefined;
  }

  it("emits events", async () => {
    expect(imodel.nativeDb.isGeometricModelTrackingSupported()).to.be.true;
    expect(imodel.nativeDb.setGeometricModelTrackingEnabled(true).result).to.be.true;

    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(5, 0, 0)));

    // Insert a geometric element.
    const props: GeometricElement3dProps = {
      classFullName: VolumeElement.classFullName,
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
      placement: {
        origin: new Point3d(1, 2, 0),
        angles: new YawPitchRollAngles(),
      },
      geom: builder.geometryStream,
    };

    const txnBeforeInsert = imodel.txns.getCurrentTxnId();
    const elemId0 = imodel.elements.insertElement(props);
    imodel.saveChanges("insert elem 0");
    expectChanges({ modelId, inserted: [elemId0] });

    // Modify the element without touching its geometry.
    props.userLabel = "new label";
    props.id = elemId0;
    imodel.elements.updateElement(props);
    imodel.saveChanges("change label");
    expectNoChanges();

    // Modify the element's geometry.
    props.placement = { origin: new Point3d(2, 1, 0), angles: new YawPitchRollAngles() };
    imodel.elements.updateElement(props);
    imodel.saveChanges("change placement");
    expectChanges({ modelId, updated: [elemId0] });

    // Insert another element.
    props.id = undefined;
    const elemId1 = imodel.elements.insertElement(props);
    imodel.saveChanges("insert elem 1");
    expectChanges({ modelId, inserted: [elemId1] });

    // Delete an element.
    imodel.elements.deleteElement(elemId0);
    imodel.saveChanges("delete elem 0");
    expectChanges({ modelId, deleted: [elemId0] });

    // Stop tracking geometry changes
    expect(imodel.nativeDb.setGeometricModelTrackingEnabled(false).result).to.be.false;
    expect(imodel.nativeDb.isGeometricModelTrackingSupported()).to.be.true;

    // Modify element's geometry.
    props.id = elemId1;
    props.placement = { origin: new Point3d(2, 10, 0), angles: new YawPitchRollAngles() };
    imodel.elements.updateElement(props);
    imodel.saveChanges("change placement again without tracking");
    expectNoChanges();

    // Restart tracking and undo everything.
    expect(imodel.nativeDb.setGeometricModelTrackingEnabled(true).result).to.be.true;
    expect(imodel.txns.reverseTo(txnBeforeInsert)).to.equal(IModelStatus.Success);
    expectChanges({ modelId, deleted: [elemId0, elemId1] });

    // Redo everything.
    expect(imodel.txns.reinstateTxn()).to.equal(IModelStatus.Success);
    expectChanges({ modelId, updated: [elemId1], deleted: [elemId0] });

    expect(imodel.nativeDb.setGeometricModelTrackingEnabled(false).result).to.be.false;
  });
});
