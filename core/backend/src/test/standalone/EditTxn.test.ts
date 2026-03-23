/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger, OpenMode } from "@itwin/core-bentley";
import { expect } from "chai";
import * as sinon from "sinon";
import { EditTxnError } from "@itwin/core-common";
import { EditTxn, type IModelDb, IModelJsFs, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

class TestEditTxn extends EditTxn {
  public constructor(iModel: IModelDb) {
    super(iModel, "test");
  }

  public writeFileProperty(name: string, value: string | undefined): void {
    super.saveFileProperty({ name, namespace: "EditTxnTest" }, value);
  }
}

class SaveOnCloseEditTxn extends TestEditTxn {
  public override onClose(): void {
    if (this.isActive)
      this.saveChanges();
  }
}

function expectEditTxnError(fn: () => void, key: EditTxnError.Key): void {
  expect(fn).to.throw().that.satisfies((error: unknown) => EditTxnError.isError(error, key));
}

function legacyWriteFileProperty(iModel: StandaloneDb, name: string, value: string): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  iModel.saveFileProperty({ name, namespace: "EditTxnTest" }, value);
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
    EditTxn.editTxnEnforcement = "none";
    sinon.restore();

    if (iModel.isOpen)
      iModel.close();

    IModelJsFs.removeSync(fileName);
  });

  it("starts with the implicit txn active and restores it only when ended or canceled", () => {
    // Implicit IModelDb mutators should work before any explicit EditTxn starts.
    legacyWriteFileProperty(iModel, "legacy-before-start", "value");
    expect(iModel.queryFilePropertyString({ name: "legacy-before-start", namespace: "EditTxnTest" })).to.equal("value");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModel.abandonChanges();

    const txn = new TestEditTxn(iModel);
    txn.start();
    expect(txn.isActive).to.be.true;

    txn.writeFileProperty("cancelled", "value");
    txn.end("abandon");
    // After canceling, the implicit txn should be active again.
    expect(txn.isActive).to.be.false;
    legacyWriteFileProperty(iModel, "legacy-after-cancel", "value");
    expect(iModel.queryFilePropertyString({ name: "legacy-after-cancel", namespace: "EditTxnTest" })).to.equal("value");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModel.abandonChanges();
    expect(iModel.queryFilePropertyString({ name: "cancelled", namespace: "EditTxnTest" })).to.be.undefined;

    txn.start();
    txn.writeFileProperty("saved", "value");
    txn.saveChanges("save test");
    expect(txn.isActive).to.be.true;
    expect(iModel.queryFilePropertyString({ name: "saved", namespace: "EditTxnTest" })).to.equal("value");

    txn.end("commit", "end test");
    // Committing also restores the implicit txn.
    expect(txn.isActive).to.be.false;
    legacyWriteFileProperty(iModel, "legacy-after-end", "value");
    expect(iModel.queryFilePropertyString({ name: "legacy-after-end", namespace: "EditTxnTest" })).to.equal("value");
  });

  it("allows writes while inactive when enforcement is none", () => {
    const txn = new TestEditTxn(iModel);

    txn.writeFileProperty("inactive", "value");
    txn.saveChanges("save inactive");
    expect(iModel.queryFilePropertyString({ name: "inactive", namespace: "EditTxnTest" })).to.equal("value");
    expectEditTxnError(() => txn.end("abandon"), "not-active");

    txn.start();
    txn.writeFileProperty("saved", "value");
    txn.saveChanges();
    expect(txn.isActive).to.be.true;

    txn.end("commit");

    txn.writeFileProperty("inactive-again", "value");
    txn.saveChanges("save inactive again");
    expect(iModel.queryFilePropertyString({ name: "inactive-again", namespace: "EditTxnTest" })).to.equal("value");
    expectEditTxnError(() => txn.end("abandon"), "not-active");
  });

  it("logs and allows writes while inactive when enforcement is log", () => {
    EditTxn.editTxnEnforcement = "log";
    const logException = sinon.spy(Logger, "logException");
    const txn = new TestEditTxn(iModel);

    txn.writeFileProperty("inactive-log", "value");
    txn.saveChanges("save inactive log");

    expect(iModel.queryFilePropertyString({ name: "inactive-log", namespace: "EditTxnTest" })).to.equal("value");
    expect(logException.called).to.be.true;
    expectEditTxnError(() => txn.end("abandon"), "not-active");
  });

  it("throws when started with unsaved changes", () => {
    // Unsaved changes made through the implicit surface block a new explicit EditTxn.
    legacyWriteFileProperty(iModel, "unsaved", "value");

    const txn = new TestEditTxn(iModel);
    expectEditTxnError(() => txn.start(), "unsaved-changes");

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModel.abandonChanges();
    legacyWriteFileProperty(iModel, "legacy-after-abandon", "value");
    expect(iModel.queryFilePropertyString({ name: "legacy-after-abandon", namespace: "EditTxnTest" })).to.equal("value");
  });

  it("rejects starting an explicit txn while another explicit txn is active", () => {
    const first = new TestEditTxn(iModel);
    const second = new TestEditTxn(iModel);

    first.start();
    expect(first.isActive).to.be.true;

    // EditTxn.start() now requires the implicit txn to be active, so a second explicit txn cannot start yet.
    expectEditTxnError(() => second.start(), "already-active");
    expect(first.isActive).to.be.true;
    expect(second.isActive).to.be.false;

    first.end("abandon");
    expect(first.isActive).to.be.false;
  });

  it("allows deprecated mutating APIs while an explicit txn is active when enforcement is none", () => {
    const txn = new TestEditTxn(iModel);
    txn.start();

    // Deprecated IModelDb mutators continue to work in compatibility mode.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModel.saveFileProperty({ name: "legacy", namespace: "EditTxnTest" }, "value");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModel.saveChanges("legacy save");
    expect(iModel.queryFilePropertyString({ name: "legacy", namespace: "EditTxnTest" })).to.equal("value");

    txn.end("abandon");
    expect(txn.isActive).to.be.false;
  });

  it("allows starting a new explicit txn when only pending changes exist", () => {
    const first = new TestEditTxn(iModel);
    const second = new TestEditTxn(iModel);

    first.start();
    first.writeFileProperty("pending", "value");
    first.saveChanges("save pending");

    // Saved-but-unpushed changes are allowed; only unsaved local changes block start().
    expect(iModel.txns.hasPendingTxns).to.be.true;
    expect(iModel.txns.hasUnsavedChanges).to.be.false;

    first.end("abandon");
    expect(() => second.start()).to.not.throw();
    expect(first.isActive).to.be.false;
    expect(second.isActive).to.be.true;

    second.end("abandon");
    expect(second.isActive).to.be.false;
  });

  it("reverseTxns abandons unsaved changes from the active explicit txn", () => {
    const txn = new TestEditTxn(iModel);
    txn.start();
    txn.writeFileProperty("reverse", "value");

    // Reversing txns should abandon the active explicit txn's local changes and restore the legacy path.
    iModel.txns.reverseTxns(1);

    expect(txn.isActive).to.be.false;
    expect(iModel.txns.hasUnsavedChanges).to.be.false;
    expect(iModel.queryFilePropertyString({ name: "reverse", namespace: "EditTxnTest" })).to.be.undefined;
  });

  it("does not save unsaved changes from the active explicit txn when the iModel closes", () => {
    const txn = new TestEditTxn(iModel);
    txn.start();
    txn.writeFileProperty("unsaved-on-close", "value");

    iModel.close();
    iModel = StandaloneDb.openFile(fileName, OpenMode.Readonly);

    expect(iModel.queryFilePropertyString({ name: "unsaved-on-close", namespace: "EditTxnTest" })).to.be.undefined;
  });

  it("allows subclasses to save unsaved changes when the iModel closes", () => {
    const txn = new SaveOnCloseEditTxn(iModel);
    txn.start();
    txn.writeFileProperty("saved-on-close", "value");

    iModel.close();
    iModel = StandaloneDb.openFile(fileName, OpenMode.Readonly);

    expect(iModel.queryFilePropertyString({ name: "saved-on-close", namespace: "EditTxnTest" })).to.equal("value");
  });
});

