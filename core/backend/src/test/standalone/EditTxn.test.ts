/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { OpenMode } from "@itwin/core-bentley";
import { expect } from "chai";
import { EditTxnError } from "@itwin/core-common";
import { EditTxn, type IModelDb, IModelJsFs, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

class TestEditTxn extends EditTxn {
  public constructor(iModel: IModelDb) {
    super(iModel, "test");
  }

  public override start(): void {
    super.start();
  }

  public override end(commit: boolean, args?: string): void {
    super.end(commit, args);
  }

  public save(args?: string): void {
    super.saveChanges(args);
  }

  public writeFileProperty(name: string, value: string | undefined): void {
    super.saveFileProperty({ name, namespace: "EditTxnTest" }, value);
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
    txn.end(false);
    // After canceling, the implicit txn should be active again.
    expect(txn.isActive).to.be.false;
    legacyWriteFileProperty(iModel, "legacy-after-cancel", "value");
    expect(iModel.queryFilePropertyString({ name: "legacy-after-cancel", namespace: "EditTxnTest" })).to.equal("value");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModel.abandonChanges();
    expect(iModel.queryFilePropertyString({ name: "cancelled", namespace: "EditTxnTest" })).to.be.undefined;

    txn.start();
    txn.writeFileProperty("saved", "value");
    txn.save("save test");
    expect(txn.isActive).to.be.true;
    expect(iModel.queryFilePropertyString({ name: "saved", namespace: "EditTxnTest" })).to.equal("value");

    txn.end(true, "end test");
    // Committing also restores the implicit txn.
    expect(txn.isActive).to.be.false;
    legacyWriteFileProperty(iModel, "legacy-after-end", "value");
    expect(iModel.queryFilePropertyString({ name: "legacy-after-end", namespace: "EditTxnTest" })).to.equal("value");
  });

  it("throws when used while inactive", () => {
    const txn = new TestEditTxn(iModel);

    expectEditTxnError(() => txn.writeFileProperty("inactive", "value"), "not-active");
    expectEditTxnError(() => txn.save(), "not-active");
    expectEditTxnError(() => txn.end(false), "not-active");

    txn.start();
    txn.writeFileProperty("saved", "value");
    txn.save();
    expect(txn.isActive).to.be.true;

    txn.end(true);

    expectEditTxnError(() => txn.writeFileProperty("inactive-again", "value"), "not-active");
    expectEditTxnError(() => txn.save(), "not-active");
    expectEditTxnError(() => txn.end(false), "not-active");
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

    first.end(false);
    expect(first.isActive).to.be.false;
  });

  it("rejects deprecated mutating APIs while an explicit txn is active, even with no unsaved changes", () => {
    const txn = new TestEditTxn(iModel);
    txn.start();

    // The legacy IModelDb mutators should fail while an explicit EditTxn owns the write surface.
    expectEditTxnError(() => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      iModel.saveFileProperty({ name: "legacy", namespace: "EditTxnTest" }, "value");
    }, "not-active");
    expectEditTxnError(() => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      iModel.saveChanges("legacy save");
    }, "not-active");

    txn.end(false);
    expect(txn.isActive).to.be.false;
  });

  it("allows starting a new explicit txn when only pending changes exist", () => {
    const first = new TestEditTxn(iModel);
    const second = new TestEditTxn(iModel);

    first.start();
    first.writeFileProperty("pending", "value");
    first.save("save pending");

    // Saved-but-unpushed changes are allowed; only unsaved local changes block start().
    expect(iModel.txns.hasPendingTxns).to.be.true;
    expect(iModel.txns.hasUnsavedChanges).to.be.false;

    first.end(false);
    expect(() => second.start()).to.not.throw();
    expect(first.isActive).to.be.false;
    expect(second.isActive).to.be.true;

    second.end(false);
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

  it("saves unsaved changes from the active explicit txn when the iModel closes", () => {
    const txn = new TestEditTxn(iModel);
    txn.start();
    txn.writeFileProperty("saved-on-close", "value");

    iModel.close();
    iModel = StandaloneDb.openFile(fileName, OpenMode.Readonly);

    expect(iModel.queryFilePropertyString({ name: "saved-on-close", namespace: "EditTxnTest" })).to.equal("value");
  });
});

