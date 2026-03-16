/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EditTxn, type IModelDb, IModelJsFs, LegacyEditTxn, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

class TestEditTxn extends EditTxn {
  public constructor(iModel: IModelDb) {
    super(iModel);
  }

  public save(args?: string): void {
    super.saveChanges(args);
  }

  public writeFileProperty(name: string, value: string | undefined): void {
    super.saveFileProperty({ name, namespace: "EditTxnTest" }, value);
  }
}

describe("EditTxn", () => {
  let iModel: StandaloneDb;
  let fileName: string;

  beforeEach(() => {
    fileName = IModelTestUtils.prepareOutputFile("EditTxn", "EditTxn.bim");
    iModel = StandaloneDb.createEmpty(fileName, {
      rootSubject: { name: "EditTxn" },
      enableTransactions: true,
    });
  });

  afterEach(() => {
    if (!iModel.isClosed)
      iModel.close();

    IModelJsFs.removeSync(fileName);
  });

  it("starts with the legacy txn active and restores it only when ended or canceled", () => {
    expect(iModel.activeTxn).instanceof(LegacyEditTxn);

    const txn = new TestEditTxn(iModel);
    txn.start();
    expect(iModel.activeTxn).to.equal(txn);

    txn.writeFileProperty("cancelled", "value");
    txn.cancel();
    expect(iModel.activeTxn).instanceof(LegacyEditTxn);
    expect(iModel.queryFilePropertyString({ name: "cancelled", namespace: "EditTxnTest" })).to.be.undefined;

    txn.start();
    txn.writeFileProperty("saved", "value");
    txn.save("save test");
    expect(iModel.activeTxn).to.equal(txn);
    expect(iModel.queryFilePropertyString({ name: "saved", namespace: "EditTxnTest" })).to.equal("value");

    txn.end(true, "end test");
    expect(iModel.activeTxn).instanceof(LegacyEditTxn);
  });

  it("throws when used while inactive", () => {
    const txn = new TestEditTxn(iModel);

    expect(() => txn.writeFileProperty("inactive", "value")).to.throw("EditTxn is not active");
    expect(() => txn.save()).to.throw("EditTxn is not active");
    expect(() => txn.cancel()).to.throw("EditTxn is not active");

    txn.start();
    txn.writeFileProperty("saved", "value");
    txn.save();
    expect(iModel.activeTxn).to.equal(txn);

    txn.end(true);

    expect(() => txn.writeFileProperty("inactive-again", "value")).to.throw("EditTxn is not active");
    expect(() => txn.save()).to.throw("EditTxn is not active");
    expect(() => txn.cancel()).to.throw("EditTxn is not active");
  });

  it("throws when started with unsaved changes", () => {
    const legacyTxn = iModel.activeTxn as LegacyEditTxn;
    legacyTxn.saveFileProperty({ name: "unsaved", namespace: "EditTxnTest" }, "value");

    const txn = new TestEditTxn(iModel);
    expect(() => txn.start()).to.throw("Cannot start a new EditTxn with unsaved changes");

    iModel.abandonChanges();
    expect(iModel.activeTxn).instanceof(LegacyEditTxn);
  });

  it("allows replacing another explicit txn when there are no unsaved changes", () => {
    const first = new TestEditTxn(iModel);
    const second = new TestEditTxn(iModel);

    first.start();
    expect(iModel.activeTxn).to.equal(first);

    second.start();
    expect(iModel.activeTxn).to.equal(second);

    second.cancel();
    expect(iModel.activeTxn).instanceof(LegacyEditTxn);
  });

  it("allows starting a new explicit txn when only pending changes exist", () => {
    const first = new TestEditTxn(iModel);
    const second = new TestEditTxn(iModel);

    first.start();
    first.writeFileProperty("pending", "value");
    first.save("save pending");

    expect(iModel.txns.hasPendingTxns).to.be.true;
    expect(iModel.txns.hasUnsavedChanges).to.be.false;

    expect(() => second.start()).to.not.throw();
    expect(iModel.activeTxn).to.equal(second);

    second.cancel();
    expect(iModel.activeTxn).instanceof(LegacyEditTxn);
  });

  it("reverseTxns abandons unsaved changes from the active explicit txn", () => {
    const txn = new TestEditTxn(iModel);
    txn.start();
    txn.writeFileProperty("reverse", "value");

    iModel.txns.reverseTxns(1);

    expect(iModel.activeTxn).instanceof(LegacyEditTxn);
    expect(iModel.txns.hasUnsavedChanges).to.be.false;
    expect(iModel.queryFilePropertyString({ name: "reverse", namespace: "EditTxnTest" })).to.be.undefined;
  });
});
