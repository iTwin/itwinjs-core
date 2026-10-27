/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelStatus, OpenMode, UnexpectedErrors } from "@itwin/core-bentley";
import { Cartographic, EcefLocation, GeographicCRS, GeographicCRSProps } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { expect } from "chai";
import * as sinon from "sinon";
import { EditTxn, getAvailableVerticalCoordinateReferenceSystems, IModelJsFs, StandaloneDb, withEditTxn } from "../../core-backend";
import { _nativeDb, _refreshIModelProps } from "../../internal/Symbols";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { getIModelError } from "./IModelTestFixtures";

describe("iModel property updates", () => {
  let iModel: StandaloneDb;
  let fileName: string;
  const initialGcs: GeographicCRSProps = { horizontalCRS: { id: "LL84" }, verticalCRS: { id: "ELLIPSOID" } };
  const changedGcs: GeographicCRSProps = {
    ...initialGcs,
    additionalTransform: { helmert2DWithZOffset: { translationX: 1, translationY: 2, translationZ: 3, rotDeg: 0, scale: 1 } },
  };
  const extents = Range3d.createXYZXYZ(-10, -10, -10, 10, 10, 10);
  const changedGcsJson = new GeographicCRS(changedGcs).toJSON();

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ loadGcsWorkspaces: true });
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  beforeEach(() => {
    fileName = IModelTestUtils.prepareOutputFile("IModelProps", "IModelProps.bim");
    iModel = StandaloneDb.createEmpty(fileName, { rootSubject: { name: "IModelProps" }, enableTransactions: true });
    withEditTxn(iModel, (txn) => {
      iModel.setGeographicCoordinateSystem(initialGcs);
      txn.updateIModelProps();
    });
    expect(iModel[_nativeDb].getIModelProps().geographicCoordinateSystem?.verticalCRS?.id).to.equal("ELLIPSOID");
  });

  afterEach(() => {
    sinon.restore();
    if (iModel.isOpen)
      iModel.close();
    IModelJsFs.removeSync(fileName);
  });

  it("omits unchanged GCS data from general, extents, and ECEF updates", () => {
    const update = sinon.spy(iModel[_nativeDb], "updateIModelProps");
    const originalGcs = iModel[_nativeDb].getIModelProps().geographicCoordinateSystem;
    iModel.setGeographicCoordinateSystem(initialGcs);
    const ecef = EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 }));
    withEditTxn(iModel, (txn) => {
      txn.updateIModelProps();
      txn.updateProjectExtents(extents);
      txn.updateEcefLocation(ecef);
    });
    expect(update.callCount).to.equal(3);
    for (const call of update.getCalls())
      expect(call.args[0]).not.to.have.property("geographicCoordinateSystem");

    expect(iModel[_nativeDb].getIModelProps().geographicCoordinateSystem).to.deep.equal(originalGcs);
    expect(iModel[_nativeDb].getIModelProps().projectExtents).to.deep.equal(extents.toJSON());
  });

  it("preserves full named vertical metadata without asking native code to resolve it again", () => {
    const namedGcs: GeographicCRSProps = {
      horizontalCRS: { id: "LL84" },
      verticalCRS: { id: "GEOID", crsName: "EGM96 height" },
    };
    withEditTxn(iModel, (txn) => {
      iModel.setGeographicCoordinateSystem(namedGcs);
      txn.updateIModelProps();
    });
    iModel[_refreshIModelProps]();
    expect(iModel.geographicCoordinateSystem?.verticalCRS?.crsName).to.equal("EGM96 height");
    const property = { namespace: "dgn_Db", name: "DgnGCSVerticalCRS" };
    const storedDefinition = iModel.queryFilePropertyString(property);
    expect(storedDefinition).to.be.a("string").and.to.contain('"transforms"');
    const nativeUpdate = iModel[_nativeDb].updateIModelProps.bind(iModel[_nativeDb]);
    const update = sinon.stub(iModel[_nativeDb], "updateIModelProps").callsFake((props) => {
      if (props.geographicCoordinateSystem)
        throw new Error("GCS dictionary unavailable");
      nativeUpdate(props);
    });
    withEditTxn(iModel, (txn) => {
      txn.updateIModelProps();
      txn.updateProjectExtents(extents);
      txn.updateEcefLocation(EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 })));
    });
    expect(update.callCount).to.equal(3);
    for (const call of update.getCalls())
      expect(call.args[0]).not.to.have.property("geographicCoordinateSystem");
    expect(iModel.queryFilePropertyString(property)).to.equal(storedDefinition);

    iModel.close();
    iModel = StandaloneDb.openFile(fileName, OpenMode.ReadWrite);
    expect(iModel.geographicCoordinateSystem?.verticalCRS?.crsName).to.equal("EGM96 height");
    expect(iModel.queryFilePropertyString(property)).to.equal(storedDefinition);
  });

  it("preserves an inline named vertical definition that is absent from the dictionary", () => {
    const crsName = "EditTxn custom height";
    expect(getAvailableVerticalCoordinateReferenceSystems().some((entry) => entry.crsName === crsName)).to.be.false;
    const customGcs = {
      horizontalCRS: { id: "LL84" },
      verticalCRS: {
        id: "ELLIPSOID" as const,
        crsName,
        datumName: crsName,
        type: "ELLIPSOID",
        units: "Meter",
        extent: { southWest: { latitude: -90, longitude: -180 }, northEast: { latitude: 90, longitude: 180 } },
      },
    };
    withEditTxn(iModel, () => {
      iModel[_nativeDb].updateIModelProps({ ...iModel.toJSON(), geographicCoordinateSystem: customGcs });
    });
    iModel[_refreshIModelProps]();
    expect(iModel.geographicCoordinateSystem?.verticalCRS?.crsName).to.equal(crsName);
    const property = { namespace: "dgn_Db", name: "DgnGCSVerticalCRS" };
    const storedDefinition = iModel.queryFilePropertyString(property);
    expect(storedDefinition).to.be.a("string").and.to.contain(crsName);
    withEditTxn(iModel, (txn) => {
      txn.updateIModelProps();
      txn.updateProjectExtents(extents);
      txn.updateEcefLocation(EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 })));
    });
    expect(iModel.queryFilePropertyString(property)).to.equal(storedDefinition);
    iModel.close();
    iModel = StandaloneDb.openFile(fileName, OpenMode.ReadWrite);
    expect(iModel.geographicCoordinateSystem?.verticalCRS?.crsName).to.equal(crsName);
    expect(iModel.queryFilePropertyString(property)).to.equal(storedDefinition);
  });

  it("writes a pending GCS change through convenience methods only once", () => {
    const update = sinon.spy(iModel[_nativeDb], "updateIModelProps");
    iModel.setGeographicCoordinateSystem(changedGcs);
    withEditTxn(iModel, (txn) => {
      txn.updateProjectExtents(extents);
      txn.updateIModelProps();
      txn.saveChanges();
      txn.updateProjectExtents(extents);
    });
    expect(update.firstCall.args[0].geographicCoordinateSystem).to.deep.equal(changedGcsJson);
    expect(update.secondCall.args[0]).not.to.have.property("geographicCoordinateSystem");
    expect(update.thirdCall.args[0]).not.to.have.property("geographicCoordinateSystem");
    expect(iModel[_nativeDb].getIModelProps().geographicCoordinateSystem?.additionalTransform).to.deep.equal(changedGcs.additionalTransform);
  });

  it("restores the GCS and comparison baseline after abandoning an update", () => {
    const originalGcs = iModel[_nativeDb].getIModelProps().geographicCoordinateSystem;
    expect(originalGcs).not.to.equal(undefined);
    const txn = new EditTxn(iModel, "abandon GCS update");
    txn.start();
    iModel.setGeographicCoordinateSystem(changedGcs);
    txn.updateIModelProps();
    txn.abandonChanges();
    expect(iModel.geographicCoordinateSystem?.toJSON()).to.deep.equal(new GeographicCRS(originalGcs).toJSON());
    const update = sinon.spy(iModel[_nativeDb], "updateIModelProps");
    txn.updateProjectExtents(extents);
    expect(update.firstCall.args[0]).not.to.have.property("geographicCoordinateSystem");
    iModel.setGeographicCoordinateSystem(changedGcs);
    txn.updateIModelProps();
    expect(update.secondCall.args[0].geographicCoordinateSystem).to.deep.equal(changedGcsJson);
    txn.end("abandon");
  });

  it("does not treat a rejected native update as persisted", () => {
    iModel.setGeographicCoordinateSystem(changedGcs);
    const nativeUpdate = iModel[_nativeDb].updateIModelProps.bind(iModel[_nativeDb]);
    const update = sinon.stub(iModel[_nativeDb], "updateIModelProps");
    update.onFirstCall().throws(new Error("GCS update rejected"));
    update.onSecondCall().callsFake(nativeUpdate);
    withEditTxn(iModel, (txn) => {
      expect(() => txn.updateIModelProps()).to.throw("GCS update rejected");
      txn.updateIModelProps();
    });
    expect(update.firstCall.args[0].geographicCoordinateSystem).to.deep.equal(changedGcsJson);
    expect(update.secondCall.args[0].geographicCoordinateSystem).to.deep.equal(changedGcsJson);
    expect(iModel[_nativeDb].getIModelProps().geographicCoordinateSystem?.additionalTransform).to.deep.equal(changedGcs.additionalTransform);
  });

  it("rejects reentrant explicit and implicit writes while restoring an abandoned GCS", () => {
      sinon.stub(EditTxn, "implicitWriteEnforcement").value("allow");
      const unexpectedError = sinon.spy(UnexpectedErrors, "handle");
      const originalProps = iModel[_nativeDb].getIModelProps();
      const failure = new Error("abandon this edit");
      const listener = sinon.spy(() => {
        expect(() => iModel.getIndirectTxn().updateIModelProps()).to.throw("Cannot write while restoring the geographic coordinate system");
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Exercise the legacy implicit write path.
        expect(() => iModel.updateIModelProps()).to.throw("Cannot write while restoring the geographic coordinate system");
      });
      expect(() => withEditTxn(iModel, (txn) => {
        iModel.rootSubject = { name: "Abandoned root subject" };
        iModel.setGeographicCoordinateSystem(changedGcs);
        txn.updateIModelProps();
        iModel.onGeographicCoordinateSystemChanged.addListener(listener);
        throw failure;
      })).to.throw(failure);
      expect(listener.calledOnce).to.be.true;
      expect(unexpectedError.called).to.be.false;
      expect(iModel[_nativeDb].hasUnsavedChanges()).to.be.false;
      expect(iModel[_nativeDb].getIModelProps().rootSubject).to.deep.equal(originalProps.rootSubject);
      iModel.close();
      iModel = StandaloneDb.openFile(fileName, OpenMode.ReadWrite);
      expect(iModel.rootSubject).to.deep.equal(originalProps.rootSubject);
      expect(iModel.geographicCoordinateSystem?.toJSON()).to.deep.equal(new GeographicCRS(originalProps.geographicCoordinateSystem).toJSON());
    });

    it("releases the transaction and write guard when a rollback listener throws", () => {
      const unexpectedError = sinon.stub(UnexpectedErrors, "handle");
      const txn = new EditTxn(iModel, "rollback listener");
      txn.start();
      iModel.rootSubject = { name: "Abandoned root subject" };
      iModel.setGeographicCoordinateSystem(changedGcs);
      txn.updateIModelProps();
      const listener = sinon.spy(() => iModel.getIndirectTxn().updateIModelProps());
      const removeListener = iModel.onGeographicCoordinateSystemChanged.addListener(listener);
      try {
        txn.end("abandon");
        expect(listener.threw()).to.be.true;
        expect(listener.firstCall.exception).to.have.property("message", "Cannot write while restoring the geographic coordinate system");
        expect(unexpectedError.calledOnceWithExactly(listener.firstCall.exception)).to.be.true;
        expect(txn.isActive).to.be.false;
        expect(iModel[_nativeDb].hasUnsavedChanges()).to.be.false;
      } finally {
        removeListener();
      }
      withEditTxn(iModel, (nextTxn) => nextTxn.saveFileProperty({ namespace: "test", name: "after-rollback" }, "allowed"));
      iModel.close();
      iModel = StandaloneDb.openFile(fileName, OpenMode.ReadWrite);
      expect(iModel.rootSubject.name).to.equal("IModelProps");
      expect(iModel.queryFilePropertyString({ namespace: "test", name: "after-rollback" })).to.equal("allowed");
    });
  it("refreshes the GCS and its baseline after undo", () => {
    const originalGcs = iModel[_nativeDb].getIModelProps().geographicCoordinateSystem;
    withEditTxn(iModel, (txn) => {
      iModel.setGeographicCoordinateSystem(changedGcs);
      txn.updateIModelProps();
    });
    expect(iModel.txns.reverseTxns(1)).to.equal(IModelStatus.Success);
    expect(iModel.geographicCoordinateSystem?.toJSON()).to.deep.equal(new GeographicCRS(originalGcs).toJSON());
    const update = sinon.spy(iModel[_nativeDb], "updateIModelProps");
    withEditTxn(iModel, (txn) => txn.updateProjectExtents(extents));
    expect(update.firstCall.args[0]).not.to.have.property("geographicCoordinateSystem");
    expect(iModel[_nativeDb].getIModelProps().geographicCoordinateSystem).to.deep.equal(originalGcs);
  });

  it("refreshes the GCS and its baseline after redo", () => {
    withEditTxn(iModel, (txn) => {
      iModel.setGeographicCoordinateSystem(changedGcs);
      txn.updateIModelProps();
    });
    const persistedGcs = iModel[_nativeDb].getIModelProps().geographicCoordinateSystem;
    expect(iModel.txns.reverseTxns(1)).to.equal(IModelStatus.Success);
    expect(iModel.txns.reinstateTxn()).to.equal(IModelStatus.Success);
    expect(iModel.geographicCoordinateSystem?.toJSON()).to.deep.equal(new GeographicCRS(persistedGcs).toJSON());
    const update = sinon.spy(iModel[_nativeDb], "updateIModelProps");
    withEditTxn(iModel, (txn) => txn.updateProjectExtents(extents));
    expect(update.firstCall.args[0]).not.to.have.property("geographicCoordinateSystem");
  });

  it("refreshes an abandoned GCS even when there is nothing to undo", () => {
    iModel[_nativeDb].deleteAllTxns();
    const originalGcs = iModel[_nativeDb].getIModelProps().geographicCoordinateSystem;
    const txn = new EditTxn(iModel, "undo unsaved GCS");
    txn.start();
    iModel.setGeographicCoordinateSystem(changedGcs);
    txn.updateIModelProps();
    expect(iModel.txns.reverseTxns(1)).to.equal(IModelStatus.NothingToUndo);
    expect(iModel.geographicCoordinateSystem?.toJSON()).to.deep.equal(new GeographicCRS(originalGcs).toJSON());
    txn.end("abandon");
  });

  it("refreshes an abandoned GCS even when asynchronous redo fails", async () => {
    iModel[_nativeDb].deleteAllTxns();
    const originalGcs = iModel[_nativeDb].getIModelProps().geographicCoordinateSystem;
    const txn = new EditTxn(iModel, "redo unsaved GCS");
    txn.start();
    iModel.setGeographicCoordinateSystem(changedGcs);
    txn.updateIModelProps();
    const error = await getIModelError(iModel.txns.reinstateTxnAsync());
    expect(error?.errorNumber).to.equal(IModelStatus.NothingToRedo);
    expect(iModel.geographicCoordinateSystem?.toJSON()).to.deep.equal(new GeographicCRS(originalGcs).toJSON());
    txn.end("abandon");
  });

  it("rejects implicit listener writes during undo and redo cache restoration", () => {
    sinon.stub(EditTxn, "implicitWriteEnforcement").value("allow");
    const unexpectedError = sinon.spy(UnexpectedErrors, "handle");
    withEditTxn(iModel, (txn) => {
      iModel.setGeographicCoordinateSystem(changedGcs);
      txn.updateIModelProps();
    });
    const listener = sinon.spy(() => {
      expect(() => iModel.getIndirectTxn().updateIModelProps()).to.throw("Cannot write while restoring the geographic coordinate system");
    });
    const removeListener = iModel.onGeographicCoordinateSystemChanged.addListener(listener);
    try {
      expect(iModel.txns.reverseTxns(1)).to.equal(IModelStatus.Success);
      expect(iModel.txns.reinstateTxn()).to.equal(IModelStatus.Success);
      expect(listener.callCount).to.equal(2);
      expect(unexpectedError.called).to.be.false;
      expect(iModel[_nativeDb].hasUnsavedChanges()).to.be.false;
    } finally {
      removeListener();
    }
  });

  it("uses the reloaded GCS as its baseline", () => {
    iModel.close();
    iModel = StandaloneDb.openFile(fileName, OpenMode.ReadWrite);
    const update = sinon.spy(iModel[_nativeDb], "updateIModelProps");
    withEditTxn(iModel, (txn) => txn.updateIModelProps());
    expect(update.firstCall.args[0]).not.to.have.property("geographicCoordinateSystem");
    withEditTxn(iModel, (txn) => {
      iModel.setGeographicCoordinateSystem(changedGcs);
      txn.updateIModelProps();
    });
    iModel[_refreshIModelProps]();
    update.resetHistory();
    withEditTxn(iModel, (txn) => txn.updateProjectExtents(extents));
    expect(update.firstCall.args[0]).not.to.have.property("geographicCoordinateSystem");
  });
});
