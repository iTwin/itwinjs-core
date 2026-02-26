/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { _nativeDb, IModelJsFs, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { Code, IModel } from "@itwin/core-common";

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

    it("should delete txns on close", async() => {
      const fileName = IModelTestUtils.prepareOutputFile("StandaloneDb", "DeleteTxnsOnClose.bim");

      // Create with allowEdit using the traditional JSON.stringify pattern
      const iModel = StandaloneDb.createEmpty(fileName, {
        rootSubject: { name: "Test" },
        enableTransactions: true,
      });

      const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestDomain" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
          <ECEntityClass typeName="a1">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="prop1" typeName="string" />
          </ECEntityClass>
          <ECEntityClass typeName="A1Recipe2d">
              <BaseClass>bis:TemplateRecipe2d</BaseClass>
              <ECProperty propertyName="prop1" typeName="string" />
          </ECEntityClass>
          <ECRelationshipClass typeName="A1OwnsA1" modifier="None" strength="embedding">
              <BaseClass>bis:ElementOwnsChildElements</BaseClass>
              <Source multiplicity="(0..1)" roleLabel="owns" polymorphic="true">
                  <Class class="a1"/>
              </Source>
              <Target multiplicity="(0..*)" roleLabel="is owned by" polymorphic="false">
                  <Class class="a1"/>
              </Target>
          </ECRelationshipClass>
      </ECSchema>`;

      await iModel.importSchemaStrings([schema1]);
      iModel.saveChanges();

      const e1 = iModel.elements.insertElement({
        classFullName: "TestDomain:A1Recipe2d",
        model: IModel.dictionaryId,
        code: Code.createEmpty(),
      });

      iModel.saveChanges(`inserted element ${e1}`);
      expect(iModel.txns.hasPendingTxns).to.be.true;

      // load up concurrent queries to ensure they are shutdown on close
      const reader = iModel.createQueryReader(
        `SELECT [ECInstanceId] as [id] FROM [TestDomain]:[A1Recipe2d]`
      );

      await reader.step();
      expect(reader.current.id).to.equal(e1);

      // should delete pending txns on close without error
      iModel.close();

      const reopened = StandaloneDb.openFile(fileName);
      expect(reopened.txns.hasPendingTxns).to.be.false;
      expect(() => reopened.elements.getElement(e1)).to.not.throw();
      reopened.close();

      IModelJsFs.removeSync(fileName);
    });
  });

});
