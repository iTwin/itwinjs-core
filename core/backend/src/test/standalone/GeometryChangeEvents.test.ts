/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CompressedId64Set, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { LineSegment3d, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  Code, ColorByName, DomainOptions, Events, GeometricElement3dProps, GeometryStreamBuilder, IModel, ModelGeometryChangesProps, NativeAppRpcInterface, RpcManager, SubCategoryAppearance,
} from "@bentley/imodeljs-common";
import {
  EventSink, EventSinkManager, IModelHost, IModelJsFs, NativeAppBackend, PhysicalModel, SpatialCategory, StandaloneDb, VolumeElement,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Model geometry changes", () => {
  let imodel: StandaloneDb;
  let modelId: string;
  let categoryId: string;

  before(async () => {
    await IModelHost.shutdown();
    RpcManager.initializeInterface(NativeAppRpcInterface);
    await NativeAppBackend.startup();

    const testFileName = IModelTestUtils.prepareOutputFile("ModelGeometryTracking", "ModelGeometryTracking.bim");
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    IModelJsFs.copySync(seedFileName, testFileName);

    // Upgrade the schema to include the GeometryGuid and LastMod model properties.
    imodel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite, { domain: DomainOptions.Upgrade });
    modelId = PhysicalModel.insert(imodel, IModel.rootSubjectId, "TestModel");
    categoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));
    imodel.saveChanges("set up");
    imodel.nativeDb.deleteAllTxns();
  });

  after(async () => {
    imodel.nativeDb.setGeometricModelTrackingEnabled(false);
    imodel.close();
    await NativeAppBackend.shutdown();
    await IModelHost.startup();
  });

  interface GeometricModelChange {
    modelId: string;
    inserted?: string[];
    updated?: string[];
    deleted?: string[];
  }

  function expectChanges(sink: EventSink, expected: GeometricModelChange | undefined): void {
    // const sink = imodel.eventSink!; only on BriefcaseDb for some reason...
    // expect(sink).not.to.be.undefined;
    const events = sink.fetch(-1);
    if (!expected) {
      expect(events.length).to.equal(0);
      return;
    }

    expect(events.length).to.equal(1);
    const event = events[0];
    expect(event.namespace).to.equal(Events.NativeApp.namespace);
    expect(event.eventName).to.equal(Events.NativeApp.modelGeometryChanges);

    expect(Array.isArray(event.data)).to.be.true;
    expect(event.data.length).to.equal(1);
    const actual = event.data[0] as ModelGeometryChangesProps;
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
  }

  function expectNoChanges(sink: EventSink): void {
    const events = sink.fetch(-1);
    expect(events.length).to.equal(0);
  }

  it("emits events", async () => {
    expect(imodel.nativeDb.isGeometricModelTrackingSupported()).to.be.true;
    expect(imodel.nativeDb.setGeometricModelTrackingEnabled(true)).to.be.true;
    const sink = EventSinkManager.get("events test");
    imodel.nativeDb.setEventSink(sink);

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
    expectChanges(sink, { modelId, inserted: [ elemId0 ] });

    // Modify the element without touching its geometry.
    props.userLabel = "new label";
    props.id = elemId0;
    imodel.elements.updateElement(props);
    imodel.saveChanges("change label");
    expectNoChanges(sink);

    // Modify the element's geometry.
    props.placement = { origin: new Point3d(2, 1, 0), angles: new YawPitchRollAngles() };
    imodel.elements.updateElement(props);
    imodel.saveChanges("change placement");
    expectChanges(sink, { modelId, updated: [ elemId0 ] });

    // Insert another element.
    props.id = undefined;
    const elemId1 = imodel.elements.insertElement(props);
    imodel.saveChanges("insert elem 1");
    expectChanges(sink, { modelId, inserted: [ elemId1 ] });

    // Delete an element.
    imodel.elements.deleteElement(elemId0);
    imodel.saveChanges("delete elem 0");
    expectChanges(sink, { modelId, deleted: [ elemId0 ] });

    // Stop tracking geometry changes
    expect(imodel.nativeDb.setGeometricModelTrackingEnabled(false)).to.be.false;
    expect(imodel.nativeDb.isGeometricModelTrackingSupported()).to.be.true;

    // Modify element's geometry.
    props.id = elemId1;
    props.placement = { origin: new Point3d(2, 10, 0), angles: new YawPitchRollAngles() };
    imodel.elements.updateElement(props);
    imodel.saveChanges("change placement again without tracking");
    expectNoChanges(sink);

    // Restart tracking and undo everything.
    expect(imodel.nativeDb.setGeometricModelTrackingEnabled(true)).to.be.true;
    expect(imodel.txns.reverseTo(txnBeforeInsert)).to.equal(IModelStatus.Success);
    expectChanges(sink, { modelId, deleted: [ elemId0, elemId1 ] });

    // Redo everything.
    expect(imodel.txns.reinstateTxn()).to.equal(IModelStatus.Success);
    expectChanges(sink, { modelId, updated: [ elemId1 ], deleted: [ elemId0 ] });

    expect(imodel.nativeDb.setGeometricModelTrackingEnabled(false)).to.be.false;
  });
});
