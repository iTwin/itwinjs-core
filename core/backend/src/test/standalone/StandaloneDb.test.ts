/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { _nativeDb, IModelJsFs, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("StandaloneDb", () => {

  describe("transaction flags", () => {

    it("should enable transactions with legacy allowEdit string flag", () => {
      const fileName = IModelTestUtils.prepareOutputFile("StandaloneDb", "AllowEditString.bim");

      // Create with allowEdit set to any truthy string value
      const iModel = StandaloneDb.createEmpty(fileName, {
        rootSubject: { name: "Test" },
        allowEdit: "any string value",
      });

      // Verify the flag is set correctly in the database
      const value = iModel[_nativeDb].queryLocalValue("StandaloneEdit");
      assert.equal(value, `{ "txns": true }`);

      iModel.close();
      IModelJsFs.removeSync(fileName);
    });

    it("should enable transactions with legacy allowEdit JSON string", () => {
      const fileName = IModelTestUtils.prepareOutputFile("StandaloneDb", "AllowEditJSON.bim");

      // Create with allowEdit using the traditional JSON.stringify pattern
      const iModel = StandaloneDb.createEmpty(fileName, {
        rootSubject: { name: "Test" },
        allowEdit: JSON.stringify({ txns: true }),
      });

      // Verify the flag is set correctly
      const value = iModel[_nativeDb].queryLocalValue("StandaloneEdit");
      assert.equal(value, `{ "txns": true }`);

      iModel.close();
      IModelJsFs.removeSync(fileName);
    });

    it("should enable transactions with new enableTransactions boolean flag", () => {
      const fileName = IModelTestUtils.prepareOutputFile("StandaloneDb", "EnableTransactions.bim");

      // Create with the new boolean flag
      const iModel = StandaloneDb.createEmpty(fileName, {
        rootSubject: { name: "Test" },
        enableTransactions: true,
      });

      // Verify the flag is set correctly
      const value = iModel[_nativeDb].queryLocalValue("StandaloneEdit");
      assert.equal(value, `{ "txns": true }`);

      iModel.close();
      IModelJsFs.removeSync(fileName);
    });

    it("should enable transactions when either flag is set", () => {
      const fileName = IModelTestUtils.prepareOutputFile("StandaloneDb", "BothFlags.bim");

      // Create with both flags set
      const iModel = StandaloneDb.createEmpty(fileName, {
        rootSubject: { name: "Test" },
        allowEdit: "legacy",
        enableTransactions: true,
      });

      // Verify the flag is set correctly
      const value = iModel[_nativeDb].queryLocalValue("StandaloneEdit");
      assert.equal(value, `{ "txns": true }`);

      iModel.close();
      IModelJsFs.removeSync(fileName);
    });

    it("should enable transactions with enableTransactions true even if allowEdit is undefined", () => {
      const fileName = IModelTestUtils.prepareOutputFile("StandaloneDb", "OnlyEnableTransactions.bim");

      // Create with only the new flag
      const iModel = StandaloneDb.createEmpty(fileName, {
        rootSubject: { name: "Test" },
        enableTransactions: true,
      });

      // Verify the flag is set correctly
      const value = iModel[_nativeDb].queryLocalValue("StandaloneEdit");
      assert.equal(value, `{ "txns": true }`);

      iModel.close();
      IModelJsFs.removeSync(fileName);
    });

    it("should not enable transactions when both flags are false/undefined", () => {
      const fileName = IModelTestUtils.prepareOutputFile("StandaloneDb", "NoFlags.bim");

      // Create without enabling transactions
      const iModel = StandaloneDb.createEmpty(fileName, {
        rootSubject: { name: "Test" },
        enableTransactions: false,
      });

      // Verify the flag is not set
      const value = iModel[_nativeDb].queryLocalValue("StandaloneEdit");
      assert.isUndefined(value);

      iModel.close();
      IModelJsFs.removeSync(fileName);
    });

    it("should not enable transactions when no flags are provided", () => {
      const fileName = IModelTestUtils.prepareOutputFile("StandaloneDb", "NoFlagsDefault.bim");

      // Create without any edit flags
      const iModel = StandaloneDb.createEmpty(fileName, {
        rootSubject: { name: "Test" },
      });

      // Verify the flag is not set
      const value = iModel[_nativeDb].queryLocalValue("StandaloneEdit");
      assert.isUndefined(value);

      iModel.close();
      IModelJsFs.removeSync(fileName);
    });

  });

});
