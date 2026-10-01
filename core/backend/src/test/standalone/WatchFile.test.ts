/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("TxnManager.touchWatchFile", () => {
  let imodel: StandaloneDb;

  before(() => {
    imodel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("WatchFile", "WatchFile.bim"), { rootSubject: { name: "WatchFile" } });
  });

  after(() => imodel.close());

  afterEach(() => {
    sinon.restore();
    fs.rmSync(imodel.watchFilePathName, { force: true });
  });

  /** touchWatchFile doesn't return its promise; wait for the utimes call and its catch handler to settle. */
  async function touchAndSettle(): Promise<void> {
    const utimes = sinon.spy(fs.promises, "utimes");
    imodel.txns.touchWatchFile();
    expect(utimes.calledOnce).to.be.true;
    await utimes.returnValues[0].catch(() => { });
    await new Promise((resolve) => setImmediate(resolve));
  }

  it("updates the timestamp of an existing watch file", async () => {
    fs.writeFileSync(imodel.watchFilePathName, "");
    const old = new Date(2000, 0, 1);
    fs.utimesSync(imodel.watchFilePathName, old, old);

    await touchAndSettle();

    expect(fs.statSync(imodel.watchFilePathName).mtimeMs).to.be.greaterThan(old.getTime());
  });

  it("does not create a missing watch file or log a warning", async () => {
    const logWarning = sinon.spy(Logger, "logWarning");

    await touchAndSettle();

    expect(fs.existsSync(imodel.watchFilePathName)).to.be.false;
    expect(logWarning.called).to.be.false;
  });

  it("logs other errors instead of leaving an unhandled rejection", async () => {
    const error = Object.assign(new Error("permission denied"), { code: "EACCES" });
    sinon.stub(fs.promises, "utimes").rejects(error);
    const logWarning = sinon.stub(Logger, "logWarning");

    imodel.txns.touchWatchFile();
    await new Promise((resolve) => setImmediate(resolve));

    expect(logWarning.calledOnce).to.be.true;
    expect(logWarning.firstCall.args[1]).to.contain("permission denied");
  });
});
