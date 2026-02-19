/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe("WithQueryReaderTests", () => {
  let iModel: SnapshotDb;

  before(async () => {
    iModel = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
  });

  after(async () => {
    iModel.close();
  });
  it("check behvaiour if we call clearCaches in between", () => {
    let actualRowCount = 0;
    const expectedInstanceIds = ["0x1", "0xe", "0x10", "0x11", "0x12",
      "0x13", "0x14", "0x15", "0x16", "0x17"];

    expect(() => iModel.withQueryReader("SELECT * FROM bis.Element", (reader) => {
      let loopCount = 0;
      // First loop - read first 10 rows
      while (loopCount < 10) {
        reader.step()
        actualRowCount++;
        loopCount++;
        assert.isDefined(reader.current[0]);
        assert.equal(reader.current[0], expectedInstanceIds[actualRowCount - 1]);
      }
      assert.equal(loopCount, 10);
      iModel.clearCaches();

      reader.step(); // step should fail after clearCaches
    })).to.throw("Step failed");
  });
  it("should throw error if we try to step on a closed iModelDb object", () => {
    const imodelPath = iModel.pathName;
    expect(() => iModel.withQueryReader("SELECT * FROM bis.Element", (reader) => {
      let loopCount = 0;
      while (loopCount < 10) {
        reader.step();
        assert.isDefined(reader.current[0]);
        loopCount++;
      }
      assert.equal(loopCount, 10);
      iModel.close();

      iModel = SnapshotDb.openFile(imodelPath);
      reader.step(); // step should fail after iModelDb is closed
    })).to.throw("Statement is not prepared");
  });
  it("returning reader from withQueryReader callback should throw error if we try to step on it", () => {
    const readerObj = iModel.withQueryReader("SELECT * FROM bis.Element", (reader) => {
      return reader;
    });
    expect(() => readerObj.step()).to.throw("Statement is not prepared");
  });
});